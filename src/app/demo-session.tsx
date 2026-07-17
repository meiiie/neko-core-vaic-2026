import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * DemoSession is a UI convenience for switching demo perspectives.
 * It is NOT authentication and NOT a security boundary: there is no login,
 * no token and no user database in this product (docs/IMPLEMENTATION_MASTER_PLAN.md §1).
 * All learner identities below are synthetic demo fixtures.
 */
export type DemoRole = 'STUDENT' | 'TEACHER';

export const HERO_LEARNER_IDS = ['an', 'binh', 'chi', 'minh'] as const;
export type HeroLearnerId = (typeof HERO_LEARNER_IDS)[number];

export interface DemoSessionState {
  role: DemoRole;
  learnerId: string;
  setRole: (role: DemoRole) => void;
  setLearnerId: (learnerId: string) => void;
}

const STORAGE_KEY = 'nekopath.demo-session.v1';

interface PersistedSession {
  role: DemoRole;
  learnerId: string;
}

function readPersisted(): PersistedSession {
  const fallback: PersistedSession = { role: 'STUDENT', learnerId: 'an' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'role' in parsed &&
      (parsed.role === 'STUDENT' || parsed.role === 'TEACHER') &&
      'learnerId' in parsed &&
      typeof parsed.learnerId === 'string'
    ) {
      return { role: parsed.role, learnerId: parsed.learnerId };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function persist(session: PersistedSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage may be unavailable (private mode / quota); the session still works in memory.
  }
}

const DemoSessionContext = createContext<DemoSessionState | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PersistedSession>(readPersisted);

  const setRole = useCallback((role: DemoRole) => {
    setSession((prev) => {
      const next = { ...prev, role };
      persist(next);
      return next;
    });
  }, []);

  const setLearnerId = useCallback((learnerId: string) => {
    setSession((prev) => {
      const next = { ...prev, learnerId };
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<DemoSessionState>(
    () => ({ role: session.role, learnerId: session.learnerId, setRole, setLearnerId }),
    [session.role, session.learnerId, setRole, setLearnerId],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession(): DemoSessionState {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) {
    throw new Error('useDemoSession must be used inside <DemoSessionProvider>');
  }
  return ctx;
}
