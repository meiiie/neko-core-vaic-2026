import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => {
  const state = { migrationShouldFail: true };
  return {
    state,
    listEventsByLearner: vi.fn(async () => []),
    migrateLearnerEvents: vi.fn(async () => {
      if (state.migrationShouldFail) throw new Error('IndexedDB unavailable');
      return 0;
    }),
  };
});

vi.mock('../../storage/event-repository', () => repository);

import { useStudentEvents } from './student-context';

const CONTEXT = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;

function Probe() {
  const { records, migrationError, retryMigration } = useStudentEvents(CONTEXT);
  return (
    <div>
      <output data-testid="state">
        {migrationError ? 'error' : records === undefined ? 'loading' : 'ready'}
      </output>
      <button type="button" onClick={retryMigration}>
        Thử lại
      </button>
    </div>
  );
}

describe('student event preparation', () => {
  it('keeps destination data gated after migration failure and can retry', async () => {
    render(<Probe />);

    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('error'));
    expect(repository.migrateLearnerEvents).toHaveBeenCalledTimes(1);
    expect(repository.listEventsByLearner).not.toHaveBeenCalled();

    repository.state.migrationShouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => expect(repository.migrateLearnerEvents).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(repository.listEventsByLearner).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'));
    expect(repository.listEventsByLearner).toHaveBeenCalledWith('user-student-an');
  });
});
