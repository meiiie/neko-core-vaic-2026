import { vi } from 'vitest';
import type { TeacherDashboardDto } from '../features/teacher/teacher-api';

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
) {
  const state = { email: initialEmail };
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
      if (url.endsWith('/api/teacher/dashboard')) return json(teacherDashboard);
      if (url.endsWith('/api/teacher/overrides') && init?.method === 'POST') {
        return json({ id: 'override-test', updatedAt: '2026-07-18T08:05:00.000Z' }, 201);
      }
      if (url.endsWith('/api/assignments')) return json({ assignments: [] });
      return json({ error: 'NOT_FOUND' }, 404);
    }),
  );
  return state;
}
