import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DemoSessionProvider, useDemoSession } from './demo-session';

function Probe() {
  const { role, learnerId, setRole, setLearnerId } = useDemoSession();
  return (
    <div>
      <output data-testid="role">{role}</output>
      <output data-testid="learner">{learnerId}</output>
      <button type="button" onClick={() => setRole('TEACHER')}>
        to-teacher
      </button>
      <button type="button" onClick={() => setLearnerId('binh')}>
        to-binh
      </button>
    </div>
  );
}

describe('DemoSession', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to STUDENT role with learner an', () => {
    render(
      <DemoSessionProvider>
        <Probe />
      </DemoSessionProvider>,
    );
    expect(screen.getByTestId('role').textContent).toBe('STUDENT');
    expect(screen.getByTestId('learner').textContent).toBe('an');
  });

  it('switches role and learner and persists the choice', async () => {
    const user = userEvent.setup();
    render(
      <DemoSessionProvider>
        <Probe />
      </DemoSessionProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'to-teacher' }));
    await user.click(screen.getByRole('button', { name: 'to-binh' }));

    expect(screen.getByTestId('role').textContent).toBe('TEACHER');
    expect(screen.getByTestId('learner').textContent).toBe('binh');

    const persisted = JSON.parse(
      window.localStorage.getItem('nekopath.demo-session.v1') ?? 'null',
    ) as { role: string; learnerId: string } | null;
    expect(persisted).toEqual({ role: 'TEACHER', learnerId: 'binh' });
  });
});
