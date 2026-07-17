import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoSessionProvider, useDemoSession } from './demo-session';

function Probe() {
  const { account, signIn, signOut } = useDemoSession();
  return (
    <div>
      <output data-testid="account">{account?.id ?? 'signed-out'}</output>
      <button type="button" onClick={() => signIn('teacher-7a-ha')}>
        Sign in teacher
      </button>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

describe('DemoSession', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts signed out instead of silently choosing a role', () => {
    render(
      <DemoSessionProvider>
        <Probe />
      </DemoSessionProvider>,
    );
    expect(screen.getByTestId('account').textContent).toBe('signed-out');
  });

  it('enters a named demo account, persists it and signs out', async () => {
    const user = userEvent.setup();
    render(
      <DemoSessionProvider>
        <Probe />
      </DemoSessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign in teacher' }));
    expect(screen.getByTestId('account').textContent).toBe('teacher-7a-ha');
    expect(JSON.parse(window.localStorage.getItem('nekopath.demo-session.v2') ?? 'null')).toEqual({
      accountId: 'teacher-7a-ha',
    });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByTestId('account').textContent).toBe('signed-out');
    expect(window.localStorage.getItem('nekopath.demo-session.v2')).toBeNull();
  });
});
