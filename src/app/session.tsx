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
import { fetchWithDeadline } from '../services/fetch-with-deadline';
import { bindBrowserProfile, markBrowserSignedOut } from '../services/profile-binding';

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
  /** Stable opaque storage/inference key. Every student uses the API user ID. */
  readonly learnerId?: string;
  /** Optional synthetic evidence fixture. Never used as the learner's storage key. */
  readonly simulationProfileId?: 'an' | 'binh' | 'chi' | 'minh';
}

export interface DeviceProfile extends Account {
  readonly email: string;
}

export interface SignInFailure {
  readonly message: string;
  /** True only when no authoritative server response was received. */
  readonly offlineEligible: boolean;
}

interface ApiUser {
  id: string;
  email: string | null;
  role: Role;
  name: string;
  initials: string;
  shortName: string;
  subtitle: string;
  learnerProfile: string | null;
}

function toAccount(user: ApiUser): Account {
  const profile = user.learnerProfile;
  const simulationProfileId =
    profile === 'an' || profile === 'binh' || profile === 'chi' || profile === 'minh'
      ? profile
      : undefined;
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    initials: user.initials,
    shortName: user.shortName,
    subtitle: user.subtitle,
    ...(user.role === 'STUDENT' ? { learnerId: user.id } : {}),
    ...(simulationProfileId ? { simulationProfileId } : {}),
  };
}

export interface SessionState {
  readonly account: Account | null;
  readonly deviceProfiles: readonly DeviceProfile[];
  readonly ready: boolean;
  readonly resumeOffline: (email: string) => boolean;
  readonly signIn: (email: string, password: string) => Promise<SignInFailure | null>;
  readonly signOut: () => Promise<void>;
}

const CACHE_KEY = 'nekopath.session-cache.v1';
export const DEVICE_PROFILES_KEY = 'nekopath.device-profiles.v1';
export const SESSION_RESTORE_DEADLINE_MS = 3_000;
export const SIGN_IN_DEADLINE_MS = 8_000;

function normalizeAccount(value: unknown): Account | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<Account>;
  if (
    typeof parsed.id !== 'string' ||
    (parsed.role !== 'STUDENT' && parsed.role !== 'TEACHER') ||
    typeof parsed.name !== 'string' ||
    typeof parsed.initials !== 'string' ||
    typeof parsed.shortName !== 'string' ||
    typeof parsed.subtitle !== 'string'
  ) {
    return null;
  }
  const legacyProfile = parsed.learnerId;
  const simulationProfileId =
    parsed.simulationProfileId ??
    (legacyProfile === 'an' ||
    legacyProfile === 'binh' ||
    legacyProfile === 'chi' ||
    legacyProfile === 'minh'
      ? legacyProfile
      : undefined);
  return {
    id: parsed.id,
    role: parsed.role,
    name: parsed.name,
    initials: parsed.initials,
    shortName: parsed.shortName,
    subtitle: parsed.subtitle,
    ...(parsed.role === 'STUDENT' ? { learnerId: parsed.id } : {}),
    ...(simulationProfileId ? { simulationProfileId } : {}),
  };
}

function readCache(): Account | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return normalizeAccount(JSON.parse(raw));
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

function normalizeDeviceProfile(value: unknown): DeviceProfile | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as Partial<DeviceProfile>;
  if (typeof profile.email !== 'string' || !profile.email.includes('@')) return null;
  const account = normalizeAccount(profile);
  return account ? { ...account, email: profile.email } : null;
}

function readDeviceProfiles(): DeviceProfile[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEVICE_PROFILES_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeDeviceProfile)
      .filter((profile): profile is DeviceProfile => profile !== null);
  } catch {
    return [];
  }
}

function storeDeviceProfiles(profiles: readonly DeviceProfile[]): void {
  try {
    window.localStorage.setItem(DEVICE_PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // Device profiles only improve offline entry; the server session still works without them.
  }
}

function upsertDeviceProfile(
  profiles: readonly DeviceProfile[],
  profile: DeviceProfile,
): DeviceProfile[] {
  const email = profile.email.toLocaleLowerCase('vi');
  const next = [
    ...profiles.filter((candidate) => candidate.email.toLocaleLowerCase('vi') !== email),
    profile,
  ];
  storeDeviceProfiles(next);
  return next;
}

const DemoSessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [deviceProfiles, setDeviceProfiles] = useState<DeviceProfile[]>(readDeviceProfiles);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const lifecycle = new AbortController();
    void (async () => {
      try {
        const response = await fetchWithDeadline('/api/auth/me', {
          credentials: 'include',
          deadlineMs: SESSION_RESTORE_DEADLINE_MS,
          signal: lifecycle.signal,
        });
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as { user: ApiUser };
          const next = toAccount(body.user);
          bindBrowserProfile(next.id);
          setAccount(next);
          writeCache(next);
          if (body.user.email) {
            setDeviceProfiles((current) =>
              upsertDeviceProfile(current, { ...next, email: body.user.email ?? '' }),
            );
          }
        } else if (response.status === 401) {
          markBrowserSignedOut();
          setAccount(null);
          writeCache(null);
        } else {
          // Server unhealthy (5xx / proxy error): behave like offline and
          // keep the cached identity so local-first work can continue.
          const cached = readCache();
          if (cached) bindBrowserProfile(cached.id);
          setAccount(cached);
        }
      } catch {
        // Network unreachable: fall back to the cached identity so the
        // local-first core keeps working offline.
        if (!cancelled) {
          const cached = readCache();
          if (cached) bindBrowserProfile(cached.id);
          setAccount(cached);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      lifecycle.abort();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetchWithDeadline('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
        deadlineMs: SIGN_IN_DEADLINE_MS,
      });
      if (!response.ok) {
        return {
          message:
            response.status === 401
              ? 'Email hoặc mật khẩu chưa đúng.'
              : 'Máy chủ từ chối yêu cầu đăng nhập.',
          offlineEligible: false,
        };
      }
      const body = (await response.json()) as { user: ApiUser };
      const next = toAccount(body.user);
      bindBrowserProfile(next.id);
      setAccount(next);
      writeCache(next);
      setDeviceProfiles((current) =>
        upsertDeviceProfile(current, { ...next, email: body.user.email ?? email }),
      );
      return null;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        return {
          message: 'Đăng nhập mất quá nhiều thời gian. Vui lòng thử lại.',
          offlineEligible: true,
        };
      }
      return {
        message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
        offlineEligible: true,
      };
    }
  }, []);

  const resumeOffline = useCallback(
    (email: string) => {
      const normalizedEmail = email.toLocaleLowerCase('vi');
      const profile = deviceProfiles.find(
        (candidate) => candidate.email.toLocaleLowerCase('vi') === normalizedEmail,
      );
      if (!profile) return false;
      bindBrowserProfile(profile.id);
      setAccount(profile);
      writeCache(profile);
      return true;
    },
    [deviceProfiles],
  );

  const signOut = useCallback(async () => {
    markBrowserSignedOut();
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
    () => ({ account, deviceProfiles, ready, resumeOffline, signIn, signOut }),
    [account, deviceProfiles, ready, resumeOffline, signIn, signOut],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
