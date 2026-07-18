import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../test/api-stub';
import { SessionProvider, useSession } from './session';

function Probe() {
  const { account, deviceProfiles, ready, resumeOffline, signIn, signOut } = useSession();
  const [signInError, setSignInError] = useState('');
  const [offlineEligible, setOfflineEligible] = useState('unset');
  return (
    <div>
      <output data-testid="ready">{String(ready)}</output>
      <output data-testid="who">{account ? `${account.role}:${account.shortName}` : 'none'}</output>
      <output data-testid="device-profiles">{deviceProfiles.length}</output>
      <output data-testid="sign-in-error">{signInError}</output>
      <output data-testid="offline-eligible">{offlineEligible}</output>
      <button
        type="button"
        onClick={() =>
          void signIn('an@nekopath.edu.vn', 'Nekopath@2026').then((failure) =>
            setSignInError(failure?.message ?? ''),
          )
        }
      >
        in-good
      </button>
      <button
        type="button"
        onClick={() =>
          void signIn('an@nekopath.edu.vn', 'sai').then((failure) =>
            setOfflineEligible(String(failure?.offlineEligible)),
          )
        }
      >
        in-bad
      </button>
      <button type="button" onClick={() => signOut()}>
        out
      </button>
      <button type="button" onClick={() => resumeOffline('an@nekopath.edu.vn')}>
        resume-an
      </button>
      <button type="button" onClick={() => resumeOffline('unknown@nekopath.edu.vn')}>
        resume-unknown
      </button>
    </div>
  );
}

const CACHED_AN = {
  id: 'user-student-an',
  role: 'STUDENT',
  name: 'Trần Ngọc An',
  initials: 'NA',
  shortName: 'An',
  subtitle: 'Học sinh • Lớp 7A',
  learnerId: 'an',
} as const;

function abortAwarePendingFetch(onSignal?: (signal: AbortSignal | null | undefined) => void) {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        onSignal?.(init?.signal);
        if (init?.signal?.aborted) {
          reject(init.signal.reason);
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      }),
  );
}

describe('API-backed session', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'nekopath_profile=; Path=/; Max-Age=0';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts signed-out when the server has no session', async () => {
    installApiStub(null);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('who').textContent).toBe('none');
  });

  it('signs in with real credentials and keeps the confirmed device profile after switching out', async () => {
    installApiStub(null);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));

    screen.getByRole('button', { name: 'in-bad' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none'));
    await waitFor(() => expect(screen.getByTestId('offline-eligible').textContent).toBe('false'));

    screen.getByRole('button', { name: 'in-good' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('STUDENT:An'));
    expect(window.localStorage.getItem('nekopath.session-cache.v1')).toContain('an');
    expect(screen.getByTestId('device-profiles').textContent).toBe('1');
    expect(window.localStorage.getItem('nekopath.device-profiles.v1')).toContain(
      'an@nekopath.edu.vn',
    );

    screen.getByRole('button', { name: 'out' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none'));
    expect(window.localStorage.getItem('nekopath.session-cache.v1')).toBeNull();
    expect(screen.getByTestId('device-profiles').textContent).toBe('1');
    expect(document.cookie).toContain('nekopath_profile=signed-out');

    screen.getByRole('button', { name: 'resume-an' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('STUDENT:An'));
    expect(document.cookie).toContain('nekopath_profile=user-student-an');
  });

  it('never resumes an account that was not confirmed on this device', async () => {
    installApiStub(null);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));

    screen.getByRole('button', { name: 'resume-unknown' }).click();

    expect(screen.getByTestId('who').textContent).toBe('none');
    expect(window.localStorage.getItem('nekopath.session-cache.v1')).toBeNull();
  });

  it('falls back to the cached identity when the network is unreachable', async () => {
    window.localStorage.setItem('nekopath.session-cache.v1', JSON.stringify(CACHED_AN));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    );
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('who').textContent).toBe('STUDENT:An');
  });

  it('stops restoring after three seconds and falls back to cached identity', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem('nekopath.session-cache.v1', JSON.stringify(CACHED_AN));
    vi.stubGlobal('fetch', abortAwarePendingFetch());

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId('ready').textContent).toBe('false');

    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    expect(screen.getByTestId('ready').textContent).toBe('true');
    expect(screen.getByTestId('who').textContent).toBe('STUDENT:An');
  });

  it('clears cached identity when the server authoritatively returns 401', async () => {
    window.localStorage.setItem('nekopath.session-cache.v1', JSON.stringify(CACHED_AN));
    installApiStub(null);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('who').textContent).toBe('none');
    expect(window.localStorage.getItem('nekopath.session-cache.v1')).toBeNull();
  });

  it('aborts session restoration when the provider unmounts', () => {
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      abortAwarePendingFetch((signal) => {
        requestSignal = signal;
      }),
    );

    const { unmount } = render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    unmount();

    expect(requestSignal?.aborted).toBe(true);
  });

  it('returns an actionable message when sign-in reaches its deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', abortAwarePendingFetch());

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(3_000));

    screen.getByRole('button', { name: 'in-good' }).click();
    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(screen.getByTestId('sign-in-error').textContent).toBe(
      'Đăng nhập mất quá nhiều thời gian. Vui lòng thử lại.',
    );
  });
});
