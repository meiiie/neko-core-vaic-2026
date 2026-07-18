import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../test/api-stub';
import { App } from './App';

function installMobileViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(max-width: 52rem)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  );
}

describe('NekoPath MVP entry and shell (class-roll dropdown auth, stubbed transport)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.style.overflow = '';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens on the class-roll combobox — folded by default, no password field, no Google', async () => {
    installApiStub(null);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
    const combo = await screen.findByRole('combobox', { name: 'Chọn tên của bạn' });
    expect(combo.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull(); // dropdown folded until tapped
    expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull();
    expect(screen.queryByText(/tài khoản mẫu/i)).toBeNull();
    expect(screen.queryByText(/Google/)).toBeNull();
  });

  it('signs in by opening the dropdown, filtering and picking a name — no password typing', async () => {
    installApiStub(null);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    const combo = await screen.findByRole('combobox', { name: 'Chọn tên của bạn' });
    await user.click(combo);
    expect(screen.getByRole('listbox')).toBeTruthy();
    // Diacritic-insensitive filter: "ngoc an" finds "Trần Ngọc An".
    await user.type(combo, 'ngoc an');
    await user.click(screen.getByRole('option', { name: /Trần Ngọc An/ }));
    // Picking folds the dropdown and shows the chosen name in the field.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect((combo as HTMLInputElement).value).toBe('Trần Ngọc An');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    const navigation = await screen.findByRole('navigation', { name: 'Điều hướng chính' });
    expect([...navigation.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'Hôm nay',
      'Kiểm tra thích ứng',
      'Lộ trình học',
      'Luyện tập',
      'Bài được giao',
      'Dữ liệu & ngoại tuyến',
    ]);
    expect(navigation.querySelector('.nav-index')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đổi hồ sơ' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Bài được giao/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Ngân hàng câu hỏi/ })).toBeNull();
  });

  it('restores a teacher session from the server and shows teacher tools', async () => {
    installApiStub('co.ha@nekopath.edu.vn');
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /Ngân hàng câu hỏi/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Giao bài/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Bài kiểm tra/ })).toBeNull();
    expect(screen.getByText('Đã đánh giá')).toBeTruthy();
    expect(screen.getByText('Cần đánh giá thêm')).toBeTruthy();
    expect(screen.getByText('Phân bổ thời gian giáo viên')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kế hoạch trong 15 phút' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Giải thích chỉ số Đã đánh giá' })).toBeTruthy();
    expect(screen.queryByText('Đủ bằng chứng')).toBeNull();
  });

  it('redirects protected routes to login when the server has no session', async () => {
    installApiStub(null);
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeTruthy();
  });

  it('bounds class-directory loading and retries in place', async () => {
    vi.useFakeTimers();
    let directoryAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/auth/me')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 }),
          );
        }
        if (url.endsWith('/api/auth/directory')) {
          directoryAttempts += 1;
          if (directoryAttempts === 1) {
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
                once: true,
              });
            });
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({
                accounts: [
                  {
                    email: 'an@nekopath.edu.vn',
                    name: 'Trần Ngọc An',
                    role: 'STUDENT',
                    subtitle: 'Học sinh • Lớp 7A',
                  },
                ],
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      }),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(screen.getByRole('alert').textContent).toContain('Không tải được danh sách lớp');

    screen.getByRole('button', { name: 'Thử lại' }).click();
    await act(async () => Promise.resolve());

    expect(screen.getByRole('combobox', { name: 'Chọn tên của bạn' })).toBeTruthy();
    expect(directoryAttempts).toBe(2);
  });

  it('keeps mobile drawer focus and exit behavior continuous', async () => {
    installMobileViewport();
    installApiStub('co.ha@nekopath.edu.vn');
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );

    const menu = await screen.findByRole('button', { name: 'Menu' });
    const sidebar = document.querySelector<HTMLElement>('#product-sidebar');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.hasAttribute('inert')).toBe(true);

    menu.focus();
    await user.tab();
    expect(sidebar?.contains(document.activeElement)).toBe(false);

    await user.click(menu);
    const currentRoute = await screen.findByRole('link', { name: /Tổng quan lớp/ });
    await waitFor(() => expect(document.activeElement).toBe(currentRoute));
    expect(sidebar?.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');

    const firstDrawerControl = sidebar?.querySelector<HTMLElement>('a[href]');
    const lastDrawerControl = sidebar?.querySelector<HTMLElement>('.sidebar-account button');
    expect(firstDrawerControl).not.toBeNull();
    expect(lastDrawerControl).not.toBeNull();

    lastDrawerControl?.focus();
    await user.tab();
    expect(document.activeElement).toBe(firstDrawerControl);
    expect(sidebar?.contains(document.activeElement)).toBe(true);

    firstDrawerControl?.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(lastDrawerControl);
    expect(sidebar?.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(menu));
    expect(sidebar?.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('');

    await user.click(menu);
    await waitFor(() => expect(document.activeElement).toBe(currentRoute));
    await user.click(screen.getByRole('button', { name: 'Đóng điều hướng' }));
    await waitFor(() => expect(document.activeElement).toBe(menu));
    expect(sidebar?.hasAttribute('inert')).toBe(true);

    await user.click(menu);
    await user.click(await screen.findByRole('link', { name: /Nhóm cần hỗ trợ/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Nhóm cần hỗ trợ' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('main-content'));
    expect(sidebar?.hasAttribute('inert')).toBe(true);
  });
});
