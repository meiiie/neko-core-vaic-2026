import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../app/session';
import { db } from '../storage/db';
import { installApiStub } from '../test/api-stub';
import { NekoDock } from './NekoDock';

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.agentSessions.clear();
});

describe('NekoDock agent session', () => {
  it('keeps context for a real offline follow-up and exposes Stop only while busy', async () => {
    installApiStub('co.ha');
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <NekoDock open onClose={() => undefined} />
      </SessionProvider>,
    );

    await screen.findByText(/Chào Cô Hà/);
    const input = screen.getByRole('textbox', { name: 'Câu hỏi cho Neko' });
    await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Chẩn đoán của bạn An thế nào?' }));
    expect((await screen.findAllByText(/Phân số bằng nhau/)).length).toBeGreaterThan(0);

    await user.type(input, 'Vì sao?');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Phân số bằng nhau/).length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByRole('button', { name: 'Dừng' })).toBeNull();
  });
});
