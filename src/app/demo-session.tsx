import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Local demo access for the event MVP. This deliberately behaves like a
 * role entry screen without pretending to be authentication or a security
 * boundary: there is no password, token, user database or remote session.
 */
export type DemoRole = 'STUDENT' | 'TEACHER';

export interface DemoAccount {
  readonly id: string;
  readonly role: DemoRole;
  readonly name: string;
  readonly initials: string;
  readonly shortName: string;
  readonly subtitle: string;
  readonly learnerId?: 'chi';
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: 'student-7a-chi',
    role: 'STUDENT',
    name: 'Nguyễn Minh Chi',
    initials: 'MC',
    shortName: 'Chi',
    subtitle: 'Học sinh • Lớp 7A',
    learnerId: 'chi',
  },
  {
    id: 'teacher-7a-ha',
    role: 'TEACHER',
    name: 'Nguyễn Thu Hà',
    initials: 'TH',
    shortName: 'Cô Hà',
    subtitle: 'Giáo viên Toán • Lớp 7A',
  },
] as const;

export interface DemoSessionState {
  readonly account: DemoAccount | null;
  readonly signIn: (accountId: string) => boolean;
  readonly signOut: () => void;
}

const STORAGE_KEY = 'nekopath.demo-session.v2';

function accountById(accountId: string | undefined): DemoAccount | null {
  return DEMO_ACCOUNTS.find((account) => account.id === accountId) ?? null;
}

function readPersisted(): DemoAccount | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'accountId' in parsed &&
      typeof parsed.accountId === 'string'
    ) {
      return accountById(parsed.accountId);
    }
  } catch {
    // A blocked/corrupt localStorage entry must never prevent opening the app.
  }
  return null;
}

const DemoSessionContext = createContext<DemoSessionState | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<DemoAccount | null>(readPersisted);

  const signIn = useCallback((accountId: string) => {
    const next = accountById(accountId);
    if (!next) return false;
    setAccount(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ accountId: next.id }));
    } catch {
      // The current tab still works when persistence is unavailable.
    }
    return true;
  }, []);

  const signOut = useCallback(() => {
    setAccount(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory session is already cleared.
    }
  }, []);

  const value = useMemo<DemoSessionState>(
    () => ({ account, signIn, signOut }),
    [account, signIn, signOut],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession(): DemoSessionState {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used inside <DemoSessionProvider>');
  return context;
}
