import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../test/api-stub';
import { SessionProvider, useSession } from './session';

function Probe() {
  const { account, ready, signIn, signOut } = useSession();
  return (
    <div>
      <output data-testid="ready">{String(ready)}</output>
      <output data-testid="who">{account ? `${account.role}:${account.shortName}` : 'none'}</output>
      <button type="button" onClick={() => void signIn('an.tn', 'nekopath-2026')}>
        in-good
      </button>
      <button type="button" onClick={() => void signIn('an.tn', 'sai')}>
        in-bad
      </button>
      <button type="button" onClick={() => signOut()}>
        out
      </button>
    </div>
  );
}

describe('API-backed session', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

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

  it('signs in with real credentials, caches identity, rejects bad passwords', async () => {
    installApiStub(null);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));

    screen.getByRole('button', { name: 'in-bad' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none'));

    screen.getByRole('button', { name: 'in-good' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('STUDENT:An'));
    expect(window.localStorage.getItem('nekopath.session-cache.v1')).toContain('an');

    screen.getByRole('button', { name: 'out' }).click();
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('none'));
    expect(window.localStorage.getItem('nekopath.session-cache.v1')).toBeNull();
  });

  it('falls back to the cached identity when the network is unreachable', async () => {
    window.localStorage.setItem(
      'nekopath.session-cache.v1',
      JSON.stringify({
        id: 'user-student-an',
        role: 'STUDENT',
        name: 'Trần Ngọc An',
        initials: 'NA',
        shortName: 'An',
        subtitle: 'Học sinh • Lớp 7A',
        learnerId: 'an',
      }),
    );
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
});
