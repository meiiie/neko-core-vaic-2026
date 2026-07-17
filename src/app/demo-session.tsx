import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Real API-backed session (HttpOnly cookie, server-side session store).
 * The browser never sees a token. For the organizer's offline constraint the
 * last confirmed identity is cached locally so an already-signed-in device can
 * keep practising without the network; any write still syncs when back online.
 */
export type DemoRole = 'STUDENT' | 'TEACHER';

export interface DemoAccount {
  readonly id: string;
  readonly role: DemoRole;
  readonly name: string;
  readonly initials: string;
  readonly shortName: string;
  readonly subtitle: string;
  readonly learnerId?: 'an' | 'binh' | 'chi' | 'minh';
}

interface ApiUser {
  id: string;
  role: DemoRole;
  name: string;
  initials: string;
  shortName: string;
  subtitle: string;
  learnerProfile: string | null;
}

function toAccount(user: ApiUser): DemoAccount {
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

export interface DemoSessionState {
  readonly account: DemoAccount | null;
  readonly ready: boolean;
  readonly signIn: (username: string, password: string) => Promise<string | null>;
  readonly signOut: () => void;
}

const CACHE_KEY = 'nekopath.session-cache.v1';

function readCache(): DemoAccount | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DemoAccount) : null;
  } catch {
    return null;
  }
}

function writeCache(account: DemoAccount | null): void {
  try {
    if (account) window.localStorage.setItem(CACHE_KEY, JSON.stringify(account));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Cache is a convenience; the cookie session remains authoritative.
  }
}

const DemoSessionContext = createContext<DemoSessionState | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<DemoAccount | null>(null);
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

  const signOut = useCallback(() => {
    setAccount(null);
    writeCache(null);
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {
      // Cookie clearing is best-effort offline; the local state is already gone.
    });
  }, []);

  const value = useMemo<DemoSessionState>(
    () => ({ account, ready, signIn, signOut }),
    [account, ready, signIn, signOut],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession(): DemoSessionState {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used inside <DemoSessionProvider>');
  return context;
}
