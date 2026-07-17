import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('NekoPath MVP entry and shell (real-API session, stubbed transport)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('opens on the real login screen with the server directory', async () => {
    installApiStub(null);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Đăng nhập bằng tài khoản mẫu' }),
    ).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Trần Ngọc An/ })).toBeTruthy();
    expect(screen.getByText(/không chứa thông tin học sinh thật/i)).toBeTruthy();
  });

  it('signs in as a student and shows the role-specific sidebar', async () => {
    installApiStub(null);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /Trần Ngọc An/ }));
    expect(await screen.findByRole('navigation', { name: 'Điều hướng chính' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Bài kiểm tra/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Bài được giao/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Ngân hàng câu hỏi/ })).toBeNull();
  });

  it('restores a teacher session from the server and shows teacher tools', async () => {
    installApiStub('co.ha');
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: /Ngân hàng câu hỏi/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Giao bài/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Bài kiểm tra/ })).toBeNull();
  });

  it('redirects protected routes to login when the server has no session', async () => {
    installApiStub(null);
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Đăng nhập bằng tài khoản mẫu' }),
    ).toBeTruthy();
  });

  it('keeps mobile drawer focus and exit behavior continuous', async () => {
    installMobileViewport();
    installApiStub('co.ha');
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

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(menu));
    expect(sidebar?.hasAttribute('inert')).toBe(true);

    await user.click(menu);
    await waitFor(() => expect(document.activeElement).toBe(currentRoute));
    await user.click(screen.getByRole('button', { name: 'Đóng điều hướng' }));
    await waitFor(() => expect(document.activeElement).toBe(menu));
    expect(sidebar?.hasAttribute('inert')).toBe(true);

    await user.click(menu);
    await user.click(await screen.findByRole('link', { name: /Nhóm can thiệp/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Nhóm can thiệp' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe('main-content'));
    expect(sidebar?.hasAttribute('inert')).toBe(true);
  });
});
