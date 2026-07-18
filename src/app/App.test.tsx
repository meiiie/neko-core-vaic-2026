import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../test/api-stub';
import { db } from '../storage/db';
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

function abortAwarePendingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(init.signal.reason);
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      }),
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

  it('opens a support group on a dedicated detail page', async () => {
    installApiStub('co.ha@nekopath.edu.vn');
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/teacher/class']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nhóm học sinh cần hỗ trợ' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Bài: Phân số bằng nhau' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Học sinh trong nhóm (12)' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Giao bài cho nhóm' })).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Xem chi tiết nhóm Phân số bằng nhau' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bài: Phân số bằng nhau' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quay lại danh sách nhóm' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Học sinh trong nhóm (12)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Câu nhiều học sinh trả lời sai' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Giao bài cho nhóm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải danh sách' })).toBeTruthy();
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

  it('shows a meaningful branded status while session restoration is pending', () => {
    vi.stubGlobal('fetch', abortAwarePendingFetch());

    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('NekoPath');
    expect(status.textContent).toContain('Đang mở không gian học tập');
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

  it('keeps the adaptive check-in focused and uses student-facing language', async () => {
    installApiStub('chi@nekopath.edu.vn');
    await db.events.clear();
    await db.outbox.clear();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/student/check-in']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bài kiểm tra nền tảng' }),
    ).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Thoát bài' })).toBeTruthy();
    expect(screen.getByText('Tiến trình đánh giá')).toBeTruthy();
    expect(screen.queryByText(/tối đa 3 câu/i)).toBeNull();
    expect(screen.queryByText('Chọn một đáp án')).toBeNull();
    expect(screen.queryByText('Cần thêm bằng chứng')).toBeNull();
    expect(screen.queryByText('Đang phân biệt')).toBeNull();
    expect(screen.getByText('Kỹ năng đang đánh giá')).toBeTruthy();
    expect(screen.getByText('Hệ thống cần thêm câu trả lời để đánh giá chính xác.')).toBeTruthy();
    expect(screen.getByText('Chọn một đáp án để tiếp tục')).toBeTruthy();
    expect(screen.getByText('Vì sao?')).toBeTruthy();

    const primary = screen.getByRole('button', { name: 'Xác nhận và tiếp tục' });
    expect((primary as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('radio', { name: /3:5/ }));
    expect((primary as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('Chọn một đáp án để tiếp tục')).toBeNull();

    await user.click(primary);
    expect(
      await screen.findByText('Đã lưu. Hệ thống sẽ chọn câu tiếp theo phù hợp với kết quả của em.'),
    ).toBeTruthy();
  });

  it('enters through a previously confirmed device profile when the class directory is offline', async () => {
    window.localStorage.setItem(
      'nekopath.device-profiles.v1',
      JSON.stringify([
        {
          email: 'an@nekopath.edu.vn',
          id: 'user-student-an',
          role: 'STUDENT',
          name: 'Trần Ngọc An',
          initials: 'NA',
          shortName: 'An',
          subtitle: 'Học sinh • Lớp 7A',
          learnerId: 'an',
        },
      ]),
    );
    window.localStorage.setItem('nekopath.last-email.v1', 'an@nekopath.edu.vn');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
      }
      if (url.endsWith('/api/auth/directory')) throw new TypeError('network down');
      if (url.endsWith('/api/auth/logout')) return new Response(JSON.stringify({ ok: true }));
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Đang dùng hồ sơ đã lưu trên thiết bị')).toBeTruthy();
    expect(
      (screen.getByRole('combobox', { name: 'Chọn tên của bạn' }) as HTMLInputElement).value,
    ).toBe('Trần Ngọc An');
    await user.click(screen.getByRole('button', { name: 'Vào ngoại tuyến' }));

    expect(await screen.findByRole('navigation', { name: 'Điều hướng chính' })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/auth/login'))).toBe(
      false,
    );
  });

  it('falls back to a confirmed profile when the network drops after loading the directory', async () => {
    window.localStorage.setItem(
      'nekopath.device-profiles.v1',
      JSON.stringify([
        {
          email: 'an@nekopath.edu.vn',
          id: 'user-student-an',
          role: 'STUDENT',
          name: 'Trần Ngọc An',
          initials: 'NA',
          shortName: 'An',
          subtitle: 'Học sinh • Lớp 7A',
          learnerId: 'an',
        },
      ]),
    );
    window.localStorage.setItem('nekopath.last-email.v1', 'an@nekopath.edu.vn');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
      }
      if (url.endsWith('/api/auth/directory')) {
        return new Response(
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
        );
      }
      if (url.endsWith('/api/auth/login')) throw new TypeError('network down');
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('navigation', { name: 'Điều hướng chính' })).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/api/auth/login')),
    ).toHaveLength(1);
    expect(document.cookie).toContain('nekopath_profile=user-student-an');
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
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nhóm học sinh cần hỗ trợ' }),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('main-content'));
    expect(sidebar?.hasAttribute('inert')).toBe(true);
  });
});
