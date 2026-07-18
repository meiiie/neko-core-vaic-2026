// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { openDb } from './db.ts';
import { DEMO_PASSWORD, seed } from './seed.ts';

async function makeApp() {
  const db = openDb(':memory:');
  seed(db);
  const app = buildApp(db);
  await app.ready();
  return app;
}

const TEACHER_EMAIL = 'co.ha@nekopath.edu.vn';
const STUDENT_EMAIL = 'an@nekopath.edu.vn';

async function loginCookie(app: Awaited<ReturnType<typeof makeApp>>, email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: DEMO_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((c) => c.name === 'nekopath_sid');
  const profile = response.cookies.find((c) => c.name === 'nekopath_profile');
  expect(cookie).toBeTruthy();
  expect(profile).toBeTruthy();
  return { nekopath_sid: cookie!.value, nekopath_profile: profile!.value };
}

describe('NekoPath API', () => {
  it('rejects wrong credentials and unauthenticated access', async () => {
    const app = await makeApp();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEACHER_EMAIL, password: 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(me.statusCode).toBe(401);
    await app.close();
  });

  it('logs in, seeds 41 class members and 12 bank questions', async () => {
    const app = await makeApp();
    const cookies = await loginCookie(app, TEACHER_EMAIL);
    const roster = await app.inject({ method: 'GET', url: '/api/class/roster', cookies });
    expect(roster.statusCode).toBe(200);
    expect((roster.json() as { students: unknown[] }).students).toHaveLength(40);
    const questions = await app.inject({ method: 'GET', url: '/api/questions', cookies });
    expect((questions.json() as { questions: unknown[] }).questions).toHaveLength(12);
    await app.close();
  });

  it('lets a teacher author a question and assign it; student sees and answers it', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);

    const created = await app.inject({
      method: 'POST',
      url: '/api/questions',
      cookies: teacher,
      payload: {
        kcId: 'K08',
        difficulty: 'HARD',
        prompt: 'Hoàn thành tỉ số bằng nhau: 2 : 7 = 6 : ?',
        choices: [
          { id: 'a', label: '21' },
          { id: 'b', label: '11', noteVi: 'Cộng 4 là so sánh cộng, không phải nhân.' },
        ],
        correctChoiceId: 'a',
        hints: ['2 nhân mấy được 6?'],
        explanation: '2→6 là nhân 3 nên 7×3 = 21.',
      },
    });
    expect(created.statusCode).toBe(201);
    const questionId = (created.json() as { id: string }).id;

    const edited = await app.inject({
      method: 'PATCH',
      url: `/api/questions/${questionId}`,
      cookies: teacher,
      payload: {
        kcId: 'K08',
        difficulty: 'MEDIUM',
        prompt: 'Hoàn thành tỉ số bằng nhau: 2 : 7 = 8 : ?',
        choices: [
          { id: 'a', label: '28' },
          { id: 'b', label: '13', noteVi: 'Cộng 5 là so sánh cộng, không phải nhân.' },
        ],
        correctChoiceId: 'a',
        hints: ['2 nhân mấy được 8?'],
        explanation: '2→8 là nhân 4 nên 7×4 = 28.',
      },
    });
    expect(edited.statusCode).toBe(200);

    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Bài kiểm tra tỉ số',
        questionIds: [questionId],
        dueAt: '2099-07-20T10:00:00.000Z',
        allowRetake: true,
        shuffleAnswers: true,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;

    const student = await loginCookie(app, STUDENT_EMAIL);
    const opened = await app.inject({
      method: 'POST',
      url: `/api/assignments/${assignmentId}/open`,
      cookies: student,
    });
    expect(opened.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/api/assignments', cookies: student });
    const titles = (list.json() as { assignments: { title: string }[] }).assignments.map(
      (a) => a.title,
    );
    expect(titles).toContain('Bài kiểm tra tỉ số');

    // Students must not receive the answer key with the assignment payload.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/assignments/${assignmentId}`,
      cookies: student,
    });
    const firstQuestion = (detail.json() as { questions: Record<string, unknown>[] }).questions[0];
    expect(firstQuestion.correctChoiceId).toBeUndefined();

    const graded = await app.inject({
      method: 'POST',
      url: `/api/assignments/${assignmentId}/answers`,
      cookies: student,
      payload: { questionId, choiceId: 'b' },
    });
    expect(graded.statusCode).toBe(200);
    const verdict = graded.json() as GradeShape;
    expect(verdict.correct).toBe(false);
    expect(verdict.note).toContain('so sánh cộng');
    expect(verdict.hints[0]).toContain('nhân mấy');
    expect(verdict.event).toMatchObject({
      learnerId: 'user-student-an',
      itemId: questionId,
      kind: 'ASSIGNMENT_ANSWER',
    });
    expect(JSON.parse(verdict.event.payload)).toMatchObject({
      choiceId: 'b',
      correct: false,
      methodValidity: 'UNKNOWN',
    });

    // The teacher's assignment list now shows one submitted learner.
    const progress = await app.inject({ method: 'GET', url: '/api/assignments', cookies: teacher });
    const row = (
      progress.json() as {
        assignments: {
          id: string;
          submittedLearnerCount: number;
          openedLearnerCount: number;
          completedLearnerCount: number;
          inProgressLearnerCount: number;
          allowRetake: boolean;
          shuffleAnswers: boolean;
        }[];
      }
    ).assignments.find((a) => a.id === assignmentId);
    expect(row).toMatchObject({
      submittedLearnerCount: 1,
      openedLearnerCount: 1,
      completedLearnerCount: 1,
      inProgressLearnerCount: 0,
      allowRetake: true,
      shuffleAnswers: true,
    });
    await app.close();
  });

  it('blocks students from teacher endpoints and syncs events idempotently', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const forbidden = await app.inject({ method: 'GET', url: '/api/questions', cookies: student });
    expect(forbidden.statusCode).toBe(403);

    const event = {
      id: 'evt-local-1',
      learnerId: 'user-student-an',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt: new Date().toISOString(),
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    const first = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [event] },
    });
    expect((first.json() as { accepted: number }).accepted).toBe(1);
    const second = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [event] },
    });
    const secondBody = second.json() as { accepted: number; conflictIds: string[] };
    expect(secondBody.accepted).toBe(0);
    expect(secondBody.conflictIds).toEqual([]);
    await app.close();
  });

  it('returns structured misconception evidence for an assigned authored bank item', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: {
        events: [
          {
            id: 'evt-offline-before-assignment',
            learnerId: 'user-student-an',
            itemId: 'K02-DIAGNOSTIC',
            sequence: 12,
            occurredAt: '2026-07-18T08:00:00.000Z',
            kind: 'ANSWER',
            payload: '{"choiceId":"a","correct":true}',
          },
        ],
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments/assignment-seed-k02/answers',
      cookies: student,
      payload: { questionId: 'bank-K02-CHECK-1', choiceId: 'b' },
    });

    expect(response.statusCode).toBe(200);
    const result = response.json() as GradeShape;
    expect(result.event).toMatchObject({
      learnerId: 'user-student-an',
      itemId: 'bank-K02-CHECK-1',
      kind: 'ASSIGNMENT_ANSWER',
      sequence: 13,
    });
    expect(JSON.parse(result.event.payload)).toMatchObject({
      choiceId: 'b',
      correct: false,
      methodValidity: 'INVALID',
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
    });
    await app.close();
  });

  it('does not let a teacher submit a student assignment answer', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const response = await app.inject({
      method: 'POST',
      url: '/api/assignments/assignment-seed-k02/answers',
      cookies: teacher,
      payload: { questionId: 'bank-K02-CHECK-1', choiceId: 'a' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'FORBIDDEN' });
    await app.close();
  });

  it('quarantines a resent event ID whose content differs instead of overwriting', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const original = {
      id: 'evt-clash-1',
      learnerId: 'user-student-an',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt: '2026-07-18T03:00:00.000Z',
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [original] },
    });

    const tampered = { ...original, payload: '{"choiceId":"b","correct":false}' };
    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [tampered] },
    });
    const body = response.json() as { accepted: number; conflictIds: string[] };
    expect(body.accepted).toBe(0);
    expect(body.conflictIds).toEqual(['evt-clash-1']);

    // The stored event keeps its original content; both fingerprints are on file.
    const summary = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [original] },
    });
    expect((summary.json() as { conflictIds: string[] }).conflictIds).toEqual([]);
    await app.close();
  });

  it('quarantines an event ID collision across learner accounts', async () => {
    const app = await makeApp();
    const an = await loginCookie(app, STUDENT_EMAIL);
    const han = await loginCookie(app, 'hs01@nekopath.edu.vn');
    const occurredAt = '2026-07-18T03:00:00.000Z';
    const shared = {
      id: 'evt-cross-account-clash',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt,
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: an,
      payload: { events: [{ ...shared, learnerId: 'user-student-an' }] },
    });
    expect((first.json() as { accepted: number }).accepted).toBe(1);

    const collision = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: han,
      payload: { events: [{ ...shared, learnerId: 'user-student-7a-01' }] },
    });
    expect(collision.json()).toMatchObject({
      accepted: 0,
      conflictIds: ['evt-cross-account-clash'],
    });
    await app.close();
  });

  it('rejects stale browser bindings and cross-account event batches', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const staleBinding = { ...student, nekopath_profile: 'user-student-chi' };

    const staleRead = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: staleBinding,
    });
    expect(staleRead.statusCode).toBe(409);
    expect(staleRead.json()).toMatchObject({ error: 'SESSION_PROFILE_MISMATCH' });

    const crossProfileEvent = {
      id: 'evt-cross-profile',
      learnerId: 'user-student-chi',
      itemId: 'K02-CHECK-1',
      sequence: 1,
      occurredAt: new Date().toISOString(),
      kind: 'ANSWER',
      payload: '{"choiceId":"a","correct":true}',
    };
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/events',
      cookies: student,
      payload: { events: [crossProfileEvent] },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toMatchObject({ error: 'EVENT_ACCOUNT_MISMATCH' });
    await app.close();
  });
});

interface GradeShape {
  correct: boolean;
  note: string;
  hints: string[];
  event: {
    id: string;
    learnerId: string;
    itemId: string;
    sequence: number;
    occurredAt: string;
    kind: string;
    payload: string;
  };
}
