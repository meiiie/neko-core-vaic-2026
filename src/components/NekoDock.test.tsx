import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider } from '../app/session';
import { db } from '../storage/db';
import { installApiStub } from '../test/api-stub';
import { NekoDock } from './NekoDock';

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.agentSessions.clear();
});

describe('NekoDock agent session', () => {
  it('shows only Local, Gemma Web and ChatGPT without the removed cache gate', async () => {
    installApiStub('co.ha@nekopath.edu.vn');
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <NekoDock open onClose={() => undefined} />
      </SessionProvider>,
    );

    await screen.findByText(/Chào Cô Hà/);
    const select = screen.getByRole('combobox', { name: 'Chọn nguồn AI cho Neko' });
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Local · Ollama',
      'Gemma · trên thiết bị',
      'ChatGPT',
    ]);
    expect(screen.queryByText(/Cục bộ tức thời|OpenAI Responses/)).toBeNull();

    await user.selectOptions(select, 'web');

    expect(screen.getByText(/Gemma sẽ được tải tại đây/)).toBeTruthy();
    expect(screen.queryByText(/Dữ liệu & ngoại tuyến/)).toBeNull();
  });

  it('opens browser OAuth synchronously and navigates it to the official auth URL', async () => {
    installApiStub('co.ha@nekopath.edu.vn');
    const baseFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/ai/chatgpt/status')) {
          return Response.json({ available: true, authenticated: false });
        }
        if (url.endsWith('/api/ai/chatgpt/login')) {
          return Response.json({
            loginId: 'login-1',
            authUrl: 'https://auth.openai.com/authorize?client_id=codex',
          });
        }
        return baseFetch(input, init);
      }),
    );
    const assign = vi.fn();
    const popup = {
      opener: window,
      closed: false,
      location: { assign },
      close: vi.fn(),
    } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(popup);
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <NekoDock open onClose={() => undefined} />
      </SessionProvider>,
    );
    await screen.findByText(/Chào Cô Hà/);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Chọn nguồn AI cho Neko' }),
      'chatgpt',
    );

    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://auth.openai.com/authorize?client_id=codex'),
    );
    expect(screen.getByRole('button', { name: 'Kiểm tra đăng nhập' })).toBeTruthy();
  });

  it('shows the authenticated ChatGPT catalog and sends the selected model to the relay', async () => {
    installApiStub('co.ha@nekopath.edu.vn');
    const baseFetch = globalThis.fetch;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/ai/chatgpt/status')) {
        return Response.json({
          available: true,
          authenticated: true,
          defaultModel: 'gpt-default',
          models: [
            {
              id: 'gpt-default',
              model: 'gpt-default',
              displayName: 'GPT Default',
              description: 'Recommended',
              isDefault: true,
            },
            {
              id: 'gpt-fast',
              model: 'gpt-fast',
              displayName: 'GPT Fast',
              description: 'Fast',
              isDefault: false,
            },
          ],
        });
      }
      if (url.endsWith('/api/ai/chatgpt/complete')) {
        return new Response(
          'event: delta\ndata: {"text":"Xin chào từ model thật."}\n\n' +
            'event: done\ndata: {"content":"Xin chào từ model thật.","modelId":"gpt-fast"}\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }
      return baseFetch(input, init);
    });
    vi.stubGlobal('fetch', fetchImpl);
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <NekoDock open onClose={() => undefined} />
      </SessionProvider>,
    );
    await screen.findByText(/Chào Cô Hà/);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Chọn nguồn AI cho Neko' }),
      'chatgpt',
    );
    const modelPicker = await screen.findByRole('combobox', { name: 'Chọn mô hình ChatGPT' });
    expect([...modelPicker.querySelectorAll('option')].map((option) => option.textContent)).toEqual(
      ['GPT Default', 'GPT Fast'],
    );
    await user.selectOptions(modelPicker, 'gpt-fast');
    const input = screen.getByRole('textbox', { name: 'Câu hỏi cho Neko' });
    await waitFor(() => expect(input.hasAttribute('disabled')).toBe(false));
    await user.type(input, 'Xin chào');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    expect(await screen.findByText('Xin chào từ model thật.')).toBeTruthy();
    const completionCall = fetchImpl.mock.calls.find(([input]) =>
      String(input).endsWith('/api/ai/chatgpt/complete'),
    );
    expect(JSON.parse(String(completionCall?.[1]?.body))).toMatchObject({ model: 'gpt-fast' });
  });

  it('keeps context for a real offline follow-up and exposes Stop only while busy', async () => {
    installApiStub('co.ha@nekopath.edu.vn');
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
    expect(screen.getByText(/Dự phòng cục bộ · Tổng/)).toBeTruthy();
    expect(screen.queryByText(/\{"ok"|hoc_sinh/)).toBeNull();

    await user.type(input, 'Vì sao?');
    await user.click(screen.getByRole('button', { name: 'Gửi' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Phân số bằng nhau/).length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByRole('button', { name: 'Dừng' })).toBeNull();
  });
});
