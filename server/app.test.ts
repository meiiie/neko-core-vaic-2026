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
const OTHER_STUDENT_EMAIL = 'chi@nekopath.edu.vn';

async function loginCookie(app: Awaited<ReturnType<typeof makeApp>>, email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: DEMO_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((c) => c.name === 'nekopath_sid');
  expect(cookie).toBeTruthy();
  return { nekopath_sid: cookie!.value };
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

  it('returns a truthful empty teacher dashboard before students answer', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);

    const response = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dataSource: 'SERVER',
      classId: 'class-7a',
      rosterCount: 40,
      evaluatedLearnerCount: 0,
      answerEventCount: 0,
      groups: [],
    });
    await app.close();
  });

  it('builds teacher evidence only from answers stored by the backend', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Kiểm tra căn bản về phân số',
        questionIds: [
          'bank-K01-CHECK-1',
          'bank-K01-CHECK-2',
          'bank-K02-CHECK-1',
          'bank-K02-CHECK-2',
        ],
        dueAt: null,
        allowRetake: false,
        shuffleAnswers: false,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;
    const student = await loginCookie(app, STUDENT_EMAIL);

    for (const [questionId, choiceId] of [
      ['bank-K01-CHECK-1', 'a'],
      ['bank-K01-CHECK-2', 'a'],
      ['bank-K02-CHECK-1', 'b'],
      ['bank-K02-CHECK-2', 'b'],
    ] as const) {
      const answer = await app.inject({
        method: 'POST',
        url: `/api/assignments/${assignmentId}/answers`,
        cookies: student,
        payload: { questionId, choiceId },
      });
      expect(answer.statusCode).toBe(200);
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(response.statusCode).toBe(200);
    const dashboard = response.json() as {
      evaluatedLearnerCount: number;
      answerEventCount: number;
      groups: {
        rootKcId?: string;
        reviewLearnerRate: number;
        wrongAnswerRate: number;
        recommendedKcIds: string[];
        recommendedQuestionIds: string[];
        learners: { id: string; displayLabel: string }[];
        wrongQuestions: {
          prompt: string;
          answers: {
            learnerName: string;
            selectedChoiceLabel: string;
            correctChoiceLabel: string;
          }[];
        }[];
      }[];
    };
    expect(dashboard.evaluatedLearnerCount).toBe(1);
    expect(dashboard.answerEventCount).toBe(4);
    const group = dashboard.groups.find((candidate) => candidate.rootKcId === 'K02');
    expect(group?.learners).toContainEqual(
      expect.objectContaining({
        id: 'user-student-an',
        displayLabel: 'Trần Ngọc An',
      }),
    );
    expect(group?.wrongQuestions).toHaveLength(2);
    expect(group).toMatchObject({
      reviewLearnerRate: 1,
      wrongAnswerRate: 0.5,
      recommendedKcIds: ['K02'],
      recommendedQuestionIds: ['bank-K02-CHECK-1', 'bank-K02-CHECK-2'],
    });
    expect(group?.wrongQuestions[0]?.answers[0]).toMatchObject({
      learnerName: 'Trần Ngọc An',
      selectedChoiceLabel: expect.any(String),
      correctChoiceLabel: expect.any(String),
    });
    await app.close();
  });

  it('persists teacher adjustments on the server with an audit reason', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);

    const saved = await app.inject({
      method: 'POST',
      url: '/api/teacher/overrides',
      cookies: teacher,
      payload: {
        learnerId: 'user-student-an',
        targetKcId: 'K10',
        decision: 'SET_ROOT',
        rootKcId: 'K07',
        reason: 'Đã xem bài làm và trao đổi trực tiếp với học sinh.',
      },
    });
    expect(saved.statusCode).toBe(201);

    const response = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { overrides: unknown[] }).overrides).toContainEqual(
      expect.objectContaining({
        learnerId: 'user-student-an',
        rootKcId: 'K07',
        reason: 'Đã xem bài làm và trao đổi trực tiếp với học sinh.',
      }),
    );
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

  it('delivers a targeted review assignment only to its selected learners', async () => {
    const app = await makeApp();
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Ôn tập phân số bằng nhau',
        questionIds: ['bank-K02-CHECK-1'],
        learnerIds: ['user-student-an'],
        dueAt: null,
        allowRetake: false,
        shuffleAnswers: false,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;

    const recipient = await loginCookie(app, STUDENT_EMAIL);
    const recipientList = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: recipient,
    });
    expect(
      (recipientList.json() as { assignments: { id: string }[] }).assignments.map(
        (assignment) => assignment.id,
      ),
    ).toContain(assignmentId);

    const nonRecipient = await loginCookie(app, OTHER_STUDENT_EMAIL);
    const nonRecipientList = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: nonRecipient,
    });
    expect(
      (nonRecipientList.json() as { assignments: { id: string }[] }).assignments.map(
        (assignment) => assignment.id,
      ),
    ).not.toContain(assignmentId);

    for (const request of [
      { method: 'GET' as const, url: `/api/assignments/${assignmentId}` },
      { method: 'POST' as const, url: `/api/assignments/${assignmentId}/open` },
      {
        method: 'POST' as const,
        url: `/api/assignments/${assignmentId}/answers`,
        payload: { questionId: 'bank-K02-CHECK-1', choiceId: 'a' },
      },
    ]) {
      const response = await app.inject({ ...request, cookies: nonRecipient });
      expect(response.statusCode).toBe(403);
    }

    const teacherList = await app.inject({
      method: 'GET',
      url: '/api/assignments',
      cookies: teacher,
    });
    const row = (
      teacherList.json() as {
        assignments: { id: string; recipientCount: number; recipientNames: string[] }[];
      }
    ).assignments.find((assignment) => assignment.id === assignmentId);
    expect(row).toMatchObject({
      recipientCount: 1,
      recipientNames: ['Trần Ngọc An'],
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
    const teacherDashboardForbidden = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: student,
    });
    expect(teacherDashboardForbidden.statusCode).toBe(403);
    const teacher = await loginCookie(app, TEACHER_EMAIL);
    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(dashboard.json()).toMatchObject({
      evaluatedLearnerCount: 1,
      answerEventCount: 1,
    });
    await app.close();
  });

  it('quarantines a resent event ID whose content differs instead of overwriting', async () => {
    const app = await makeApp();
    const student = await loginCookie(app, STUDENT_EMAIL);
    const original = {
      id: 'evt-clash-1',
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
});

interface GradeShape {
  correct: boolean;
  note: string;
  hints: string[];
}
