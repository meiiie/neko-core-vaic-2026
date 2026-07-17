import { vi } from 'vitest';

/**
 * Deterministic fetch stub for UI tests: emulates the real API contract
 * (directory/login/me/logout) without a network. Server behaviour itself is
 * covered by server/app.test.ts against the real Fastify app.
 */

export interface StubUser {
  id: string;
  role: 'STUDENT' | 'TEACHER';
  name: string;
  initials: string;
  shortName: string;
  subtitle: string;
  learnerProfile: string | null;
}

export const STUB_DIRECTORY = [
  {
    username: 'an.tn',
    role: 'STUDENT',
    name: 'Trần Ngọc An',
    initials: 'NA',
    subtitle: 'Học sinh • Lớp 7A',
  },
  {
    username: 'chi.nm',
    role: 'STUDENT',
    name: 'Nguyễn Minh Chi',
    initials: 'MC',
    subtitle: 'Học sinh • Lớp 7A',
  },
  {
    username: 'co.ha',
    role: 'TEACHER',
    name: 'Nguyễn Thu Hà',
    initials: 'TH',
    subtitle: 'Giáo viên Toán • Lớp 7A',
  },
] as const;

const USERS: Record<string, StubUser> = {
  'an.tn': {
    id: 'user-student-an',
    role: 'STUDENT',
    name: 'Trần Ngọc An',
    initials: 'NA',
    shortName: 'An',
    subtitle: 'Học sinh • Lớp 7A',
    learnerProfile: 'an',
  },
  'chi.nm': {
    id: 'user-student-chi',
    role: 'STUDENT',
    name: 'Nguyễn Minh Chi',
    initials: 'MC',
    shortName: 'Chi',
    subtitle: 'Học sinh • Lớp 7A',
    learnerProfile: 'chi',
  },
  'co.ha': {
    id: 'user-teacher-ha',
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

/** Install the stub; returns a handle to control the signed-in user. */
export function installApiStub(initialUsername: string | null = null) {
  const state = { username: initialUsername };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/auth/directory')) return json({ accounts: STUB_DIRECTORY });
      if (url.endsWith('/api/auth/me')) {
        const user = state.username ? USERS[state.username] : undefined;
        return user ? json({ user }) : json({ error: 'UNAUTHENTICATED' }, 401);
      }
      if (url.endsWith('/api/auth/login')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          username?: string;
          password?: string;
        };
        const user = body.username ? USERS[body.username] : undefined;
        if (!user || body.password !== 'nekopath-2026') {
          return json({ error: 'INVALID_CREDENTIALS' }, 401);
        }
        state.username = body.username ?? null;
        return json({ user });
      }
      if (url.endsWith('/api/auth/logout')) {
        state.username = null;
        return json({ ok: true });
      }
      if (url.endsWith('/api/assignments')) return json({ assignments: [] });
      return json({ error: 'NOT_FOUND' }, 404);
    }),
  );
  return state;
}
