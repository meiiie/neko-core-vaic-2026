import { vi } from 'vitest';

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
export function installApiStub(initialEmail: string | null = null) {
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
      if (url.endsWith('/api/assignments')) return json({ assignments: [] });
      return json({ error: 'NOT_FOUND' }, 404);
    }),
  );
  return state;
}
