import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

const { setNeedRefresh, updateServiceWorker } = vi.hoisted(() => ({
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(async () => {}),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

describe('UpdatePrompt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('auto-applies a waiting update before a workspace becomes active', async () => {
    render(
      <MemoryRouter>
        <UpdatePrompt preWorkspace />
      </MemoryRouter>,
    );

    await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('keeps updates user-controlled inside an active workspace', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UpdatePrompt preWorkspace={false} />
      </MemoryRouter>,
    );

    expect(updateServiceWorker).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cập nhật ngay' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
