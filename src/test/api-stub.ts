import { vi } from 'vitest';
import type { TeacherDashboardDto } from '../features/teacher/teacher-api';
import { LESSON_SUMMARIES } from '../content/lessons.v1';

/**
 * Deterministic fetch stub for UI tests: emulates the real API contract
 * (config / login / me / logout) without a network. Server behaviour itself is
 * covered by server/app.test.ts against the real Fastify app.
 */

export interface StubUser {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
  name: string;
  initials: string;
  shortName: string;
  subtitle: string;
  learnerProfile: string | null;
}

const PASSWORD = 'Nekopath@2026';

export const TEACHER_QUESTION_FIXTURE = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `bank-K02-REVIEW-${index + 1}`,
    kcId: 'K02',
    prompt: `Câu ôn phân số bằng nhau ${index + 1}`,
    difficulty: index < 2 ? 'EASY' : index < 5 ? 'MEDIUM' : 'HARD',
  })),
  {
    id: 'bank-K01-REVIEW-1',
    kcId: 'K01',
    prompt: 'Câu ôn ý nghĩa phân số',
    difficulty: 'EASY',
  },
] as const;

export const TEACHER_DASHBOARD_FIXTURE: TeacherDashboardDto = {
  dataSource: 'SERVER',
  generatedAt: '2026-07-18T08:00:00.000Z',
  latestAnswerAt: '2026-07-18T07:55:00.000Z',
  classId: 'class-7a',
  className: 'Lớp 7A',
  rosterCount: 2,
  evaluatedLearnerCount: 2,
  answerEventCount: 4,
  learners: [
    { id: 'user-student-an', displayLabel: 'Trần Ngọc An', eventCount: 2 },
    { id: 'user-student-chi', displayLabel: 'Nguyễn Minh Chi', eventCount: 2 },
  ],
  groups: [
    {
      id: 'root:K02',
      status: 'ACTIONABLE_ROOT',
      rootKcId: 'K02',
      learnerIds: ['user-student-an', 'user-student-chi'],
      sufficientEvidenceCount: 2,
      totalLearnerCount: 2,
      blockedDescendantCount: 3,
      priorityScore: 8,
      representativeEventIds: ['evt-an-k02', 'evt-chi-k02'],
      suggestedActionId: 'RETEACH_K02',
      reviewLearnerRate: 1,
      wrongAnswerCount: 2,
      evidenceAnswerCount: 4,
      wrongAnswerRate: 0.5,
      recommendedKcIds: ['K02'],
      recommendedQuestionIds: ['bank-K02-CHECK-1', 'bank-K02-CHECK-2'],
      learners: [
        { id: 'user-student-an', displayLabel: 'Trần Ngọc An', eventCount: 2 },
        { id: 'user-student-chi', displayLabel: 'Nguyễn Minh Chi', eventCount: 2 },
      ],
      wrongQuestions: [
        {
          questionId: 'bank-K02-CHECK-1',
          kcId: 'K02',
          prompt: 'Phân số nào bằng 2/3?',
          wrongLearnerCount: 2,
          answers: [
            {
              eventId: 'evt-an-k02',
              learnerId: 'user-student-an',
              learnerName: 'Trần Ngọc An',
              questionId: 'bank-K02-CHECK-1',
              prompt: 'Phân số nào bằng 2/3?',
              selectedChoiceId: 'b',
              selectedChoiceLabel: '4/5',
              correctChoiceId: 'a',
              correctChoiceLabel: '4/6',
              correct: false,
              occurredAt: '2026-07-18T07:50:00.000Z',
              assignmentId: 'assignment-k02',
              assignmentTitle: 'Ôn tập phân số bằng nhau',
            },
            {
              eventId: 'evt-chi-k02',
              learnerId: 'user-student-chi',
              learnerName: 'Nguyễn Minh Chi',
              questionId: 'bank-K02-CHECK-1',
              prompt: 'Phân số nào bằng 2/3?',
              selectedChoiceId: 'c',
              selectedChoiceLabel: '2/6',
              correctChoiceId: 'a',
              correctChoiceLabel: '4/6',
              correct: false,
              occurredAt: '2026-07-18T07:55:00.000Z',
              assignmentId: 'assignment-k02',
              assignmentTitle: 'Ôn tập phân số bằng nhau',
            },
          ],
        },
      ],
    },
  ],
  classWideGaps: [
    {
      rootKcId: 'K02',
      learnerCount: 2,
      classSize: 2,
      rate: 1,
      thresholdRate: 0.3,
      thresholdCount: 8,
    },
  ],
  attentionPlan: {
    policyVersion: 'teacher-budget-v1',
    budgetMinutes: 15,
    usedMinutes: 10,
    remainingMinutes: 5,
    selected: [
      {
        groupId: 'root:K02',
        actionId: 'RETEACH_K02',
        minutes: 10,
        attentionValue: 8,
        valuePerMinute: 0.8,
        reasonCode: 'ROOT_BOTTLENECK',
      },
    ],
    deferred: [],
  },
  overrides: [],
};

const USERS: Record<string, StubUser> = {
  'an@nekopath.edu.vn': {
    id: 'user-student-an',
    email: 'an@nekopath.edu.vn',
    role: 'STUDENT',
    name: 'Trần Ngọc An',
    initials: 'NA',
    shortName: 'An',
    subtitle: 'Học sinh • Lớp 7A',
    learnerProfile: 'an',
  },
  'chi@nekopath.edu.vn': {
    id: 'user-student-chi',
    email: 'chi@nekopath.edu.vn',
    role: 'STUDENT',
    name: 'Nguyễn Minh Chi',
    initials: 'MC',
    shortName: 'Chi',
    subtitle: 'Học sinh • Lớp 7A',
    learnerProfile: 'chi',
  },
  'hs01@nekopath.edu.vn': {
    id: 'user-student-7a-01',
    email: 'hs01@nekopath.edu.vn',
    role: 'STUDENT',
    name: 'Nguyễn Gia Hân',
    initials: 'GH',
    shortName: 'Hân',
    subtitle: 'Học sinh • Lớp 7A',
    learnerProfile: null,
  },
  'co.ha@nekopath.edu.vn': {
    id: 'user-teacher-ha',
    email: 'co.ha@nekopath.edu.vn',
    role: 'TEACHER',
    name: 'Nguyễn Thu Hà',
    initials: 'TH',
    shortName: 'Cô Hà',
    subtitle: 'Giáo viên Toán • Lớp 7A',
    learnerProfile: null,
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Install the stub; returns a handle to control the signed-in user by email. */
export function installApiStub(
  initialEmail: string | null = null,
  teacherDashboard: TeacherDashboardDto = TEACHER_DASHBOARD_FIXTURE,
  dashboardAfterOverride?: TeacherDashboardDto,
) {
  const state = { email: initialEmail, teacherDashboard };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/auth/directory')) {
        return json({
          accounts: Object.values(USERS).map((user) => ({
            email: user.email,
            name: user.name,
            role: user.role,
            subtitle: user.subtitle,
          })),
        });
      }
      if (url.endsWith('/api/auth/me')) {
        const user = state.email ? USERS[state.email] : undefined;
        return user ? json({ user }) : json({ error: 'UNAUTHENTICATED' }, 401);
      }
      if (url.endsWith('/api/auth/login')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          email?: string;
          password?: string;
        };
        const user = body.email ? USERS[body.email] : undefined;
        if (!user || body.password !== PASSWORD) {
          return json({ error: 'INVALID_CREDENTIALS' }, 401);
        }
        state.email = body.email ?? null;
        return json({ user });
      }
      if (url.endsWith('/api/auth/logout')) {
        state.email = null;
        return json({ ok: true });
      }
      if (url.endsWith('/api/teacher/dashboard')) return json(state.teacherDashboard);
      if (url.endsWith('/api/teacher/overrides') && init?.method === 'POST') {
        if (dashboardAfterOverride) state.teacherDashboard = dashboardAfterOverride;
        return json({ id: 'override-test', updatedAt: '2026-07-18T08:05:00.000Z' }, 201);
      }
      if (url.endsWith('/api/questions')) return json({ questions: TEACHER_QUESTION_FIXTURE });
      if (url.endsWith('/api/assignments') && init?.method === 'POST') {
        return json({ id: 'assignment-test' }, 201);
      }
      if (url.endsWith('/api/assignments')) return json({ assignments: [] });
      if (url.endsWith('/api/lessons')) {
        return json({
          lessons: LESSON_SUMMARIES.map((lesson) => ({
            kcId: lesson.kcId,
            title: lesson.titleVi,
            keyPoints: lesson.keyPointsVi,
            exampleProblem: lesson.workedExampleVi.problem,
            exampleSteps: lesson.workedExampleVi.steps,
            commonMistake: lesson.commonMistakeVi,
            status: 'DRAFT',
            updatedAt: '2026-07-18T00:00:00.000Z',
            updatedByName: null,
          })),
        });
      }
      return json({ error: 'NOT_FOUND' }, 404);
    }),
  );
  return state;
}
