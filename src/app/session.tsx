import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { disposeAgentSessions } from '../services/agent/agent-lifecycle';
import { AgentSessionStore } from '../services/agent/session-store';
import { db } from '../storage/db';

/**
 * Real API-backed session (HttpOnly cookie, server-side session store).
 * The browser never sees a token. For the organizer's offline constraint the
 * last confirmed identity is cached locally so an already-signed-in device can
 * keep practising without the network; any write still syncs when back online.
 */
export type Role = 'STUDENT' | 'TEACHER';

export interface Account {
  readonly id: string;
  readonly role: Role;
  readonly name: string;
  readonly initials: string;
  readonly shortName: string;
  readonly subtitle: string;
  readonly learnerId?: 'an' | 'binh' | 'chi' | 'minh';
}

interface ApiUser {
  id: string;
  role: Role;
  name: string;
  initials: string;
  shortName: string;
  subtitle: string;
  learnerProfile: string | null;
}

function toAccount(user: ApiUser): Account {
  const profile = user.learnerProfile;
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    initials: user.initials,
    shortName: user.shortName,
    subtitle: user.subtitle,
    learnerId:
      profile === 'an' || profile === 'binh' || profile === 'chi' || profile === 'minh'
        ? profile
        : undefined,
  };
}

export interface SessionState {
  readonly account: Account | null;
  readonly ready: boolean;
  readonly signIn: (username: string, password: string) => Promise<string | null>;
  /** Server-less entry (static/recovery deploy): local synthetic profiles only. */
  readonly enterLocalMode: (profileId: string) => void;
  readonly signOut: () => Promise<void>;
}

/** Built-in profiles for the no-server recovery mode. Synthetic, like the seed. */
export const LOCAL_PROFILES: readonly Account[] = [
  {
    id: 'local-teacher-ha',
    role: 'TEACHER',
    name: 'Nguyễn Thu Hà',
    initials: 'TH',
    shortName: 'Cô Hà',
    subtitle: 'Giáo viên Toán • Lớp 7A (cục bộ)',
  },
  {
    id: 'local-student-an',
    role: 'STUDENT',
    name: 'Trần Ngọc An',
    initials: 'NA',
    shortName: 'An',
    subtitle: 'Học sinh • Lớp 7A (cục bộ)',
    learnerId: 'an',
  },
  {
    id: 'local-student-binh',
    role: 'STUDENT',
    name: 'Lê Thanh Bình',
    initials: 'TB',
    shortName: 'Bình',
    subtitle: 'Học sinh • Lớp 7A (cục bộ)',
    learnerId: 'binh',
  },
  {
    id: 'local-student-chi',
    role: 'STUDENT',
    name: 'Nguyễn Minh Chi',
    initials: 'MC',
    shortName: 'Chi',
    subtitle: 'Học sinh • Lớp 7A (cục bộ)',
    learnerId: 'chi',
  },
  {
    id: 'local-student-minh',
    role: 'STUDENT',
    name: 'Phạm Quang Minh',
    initials: 'QM',
    shortName: 'Minh',
    subtitle: 'Học sinh • Lớp 7A (cục bộ)',
    learnerId: 'minh',
  },
];

const CACHE_KEY = 'nekopath.session-cache.v1';

function readCache(): Account | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

function writeCache(account: Account | null): void {
  try {
    if (account) window.localStorage.setItem(CACHE_KEY, JSON.stringify(account));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Cache is a convenience; the cookie session remains authoritative.
  }
}

const DemoSessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as { user: ApiUser };
          const next = toAccount(body.user);
          setAccount(next);
          writeCache(next);
        } else if (response.status === 401) {
          setAccount(null);
          writeCache(null);
        } else {
          // Server unhealthy (5xx / proxy error): behave like offline and
          // keep the cached identity so local-first work can continue.
          setAccount(readCache());
        }
      } catch {
        // Network unreachable: fall back to the cached identity so the
        // local-first core keeps working offline.
        if (!cancelled) setAccount(readCache());
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        return response.status === 401
          ? 'Sai tên đăng nhập hoặc mật khẩu.'
          : 'Máy chủ từ chối yêu cầu đăng nhập.';
      }
      const body = (await response.json()) as { user: ApiUser };
      const next = toAccount(body.user);
      setAccount(next);
      writeCache(next);
      return null;
    } catch {
      return 'Không kết nối được máy chủ. Kiểm tra mạng hoặc dùng thiết bị đã đăng nhập trước đó.';
    }
  }, []);

  const enterLocalMode = useCallback((profileId: string) => {
    const profile = LOCAL_PROFILES.find((candidate) => candidate.id === profileId);
    if (!profile) return;
    setAccount(profile);
    writeCache(profile);
  }, []);

  const signOut = useCallback(async () => {
    const accountId = account?.id;
    if (accountId) {
      await disposeAgentSessions(accountId);
      await new AgentSessionStore(db).clearAccount(accountId).catch(() => undefined);
    }
    setAccount(null);
    writeCache(null);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {
      // Cookie clearing is best-effort offline; the local state is already gone.
    });
  }, [account?.id]);

  const value = useMemo<SessionState>(
    () => ({ account, ready, signIn, enterLocalMode, signOut }),
    [account, ready, signIn, enterLocalMode, signOut],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
