// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { buildHydratedEventRecords, diagnoseHero } from '../src/app/adapters/hero-tutor.ts';
import { PRACTICE_QUESTIONS } from '../src/content/index.ts';
import type { LearnerEventRecord } from '../src/storage/db.ts';
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

async function loginCookie(app: Awaited<ReturnType<typeof makeApp>>, email: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: DEMO_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const session = response.cookies.find((cookie) => cookie.name === 'nekopath_sid');
  const profile = response.cookies.find((cookie) => cookie.name === 'nekopath_profile');
  expect(session).toBeTruthy();
  expect(profile).toBeTruthy();
  return { nekopath_sid: session!.value, nekopath_profile: profile!.value };
}

function choiceFor(itemId: string, correct: boolean): string {
  const question = PRACTICE_QUESTIONS.find((candidate) => candidate.itemId === itemId)!;
  return correct
    ? question.correctChoiceId
    : question.choices.find((choice) => choice.id !== question.correctChoiceId)!.id;
}

async function answerItems(
  app: Awaited<ReturnType<typeof makeApp>>,
  assignmentId: string,
  cookies: Awaited<ReturnType<typeof loginCookie>>,
  answers: readonly (readonly [itemId: string, correct: boolean])[],
) {
  for (const [itemId, correct] of answers) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/assignments/${assignmentId}/answers`,
      cookies,
      payload: { questionId: `bank-${itemId}`, choiceId: choiceFor(itemId, correct) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ correct });
  }
}

describe('adaptive tutoring end-to-end contract', () => {
  const apps: Awaited<ReturnType<typeof makeApp>>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it('turns the same surface errors into evidence-specific roots, paths, or abstention', async () => {
    const app = await makeApp();
    apps.push(app);
    const teacher = await loginCookie(app, 'co.ha@nekopath.edu.vn');
    const questionIds = [
      'K01-CHECK-1',
      'K01-CHECK-2',
      'K02-CHECK-1',
      'K02-CHECK-2',
      'K07-CHECK-1',
      'K07-CHECK-2',
      'K10-CHECK-1',
      'K10-CHECK-2',
    ];
    const assigned = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      cookies: teacher,
      payload: {
        title: 'Kiểm tra gốc kiến thức',
        questionIds: questionIds.map((itemId) => `bank-${itemId}`),
        dueAt: null,
        allowRetake: false,
        shuffleAnswers: false,
      },
    });
    expect(assigned.statusCode).toBe(201);
    const assignmentId = (assigned.json() as { id: string }).id;

    const learners = [
      {
        email: 'hs01@nekopath.edu.vn',
        learnerId: 'user-student-7a-01',
        answers: [
          ['K01-CHECK-1', true],
          ['K01-CHECK-2', true],
          ['K02-CHECK-1', false],
          ['K02-CHECK-2', false],
          ['K10-CHECK-1', false],
          ['K10-CHECK-2', false],
        ],
        expected: {
          status: 'DIAGNOSED',
          rootKcId: 'K02',
          pathKcIds: ['K02', 'K08', 'K09', 'K10'],
        },
      },
      {
        email: 'hs02@nekopath.edu.vn',
        learnerId: 'user-student-7a-02',
        answers: [
          ['K01-CHECK-1', true],
          ['K01-CHECK-2', true],
          ['K07-CHECK-1', false],
          ['K07-CHECK-2', false],
          ['K10-CHECK-1', false],
          ['K10-CHECK-2', false],
        ],
        expected: {
          status: 'DIAGNOSED',
          rootKcId: 'K07',
          pathKcIds: ['K07', 'K08', 'K09', 'K10'],
        },
      },
      {
        email: 'hs03@nekopath.edu.vn',
        learnerId: 'user-student-7a-03',
        answers: [
          ['K10-CHECK-1', false],
          ['K10-CHECK-2', false],
        ],
        expected: {
          status: 'NEEDS_MORE_EVIDENCE',
          rootKcId: undefined,
          pathKcIds: [],
        },
      },
    ] as const;

    for (const learner of learners) {
      const cookies = await loginCookie(app, learner.email);
      await answerItems(app, assignmentId, cookies, learner.answers);
      const history = await app.inject({ method: 'GET', url: '/api/events', cookies });
      expect(history.statusCode).toBe(200);
      const serverEvents = (history.json() as { events: LearnerEventRecord[] }).events;
      expect(serverEvents.every((event) => event.kind === 'ASSIGNMENT_ANSWER')).toBe(true);
      expect(
        serverEvents.filter(
          (event) =>
            event.itemId.startsWith('bank-K10-CHECK-') &&
            (JSON.parse(event.payload) as { correct: boolean }).correct === false,
        ),
      ).toHaveLength(2);
      const hydrated = buildHydratedEventRecords({ learnerId: learner.learnerId }, serverEvents);
      expect(hydrated).not.toBeNull();

      const diagnosis = diagnoseHero({ learnerId: learner.learnerId }, hydrated ?? []);
      expect(diagnosis).toMatchObject({
        status: learner.expected.status,
        pathKcIds: learner.expected.pathKcIds,
      });
      expect(diagnosis.rootKcId).toBe(learner.expected.rootKcId);
      expect(diagnosis.learnerId).toBe(learner.learnerId);
    }

    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/teacher/dashboard',
      cookies: teacher,
    });
    expect(dashboard.statusCode).toBe(200);
    const groups = (
      dashboard.json() as {
        groups: { status: string; rootKcId?: string; learnerIds: string[] }[];
      }
    ).groups;
    expect(groups.find((group) => group.rootKcId === 'K02')?.learnerIds).toContain(
      'user-student-7a-01',
    );
    expect(groups.find((group) => group.rootKcId === 'K07')?.learnerIds).toContain(
      'user-student-7a-02',
    );
    const sparseEvidenceGroup = groups.find((group) =>
      group.learnerIds.includes('user-student-7a-03'),
    );
    expect(['QUICK_CHECK', 'TEACHER_REVIEW']).toContain(sparseEvidenceGroup?.status);
    expect(sparseEvidenceGroup?.rootKcId).toBeUndefined();
  });
});
