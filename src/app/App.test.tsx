import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('NekoPath MVP entry and shell', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens on a truthful one-click demo login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Đăng nhập bằng tài khoản mẫu' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nguyễn Minh Chi/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nguyễn Thu Hà/ })).toBeTruthy();
    expect(screen.getByText(/không chứa thông tin học sinh thật/i)).toBeTruthy();
  });

  it('enters the student workspace and shows the role-specific sidebar', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /Nguyễn Minh Chi/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Chào buổi chiều, Chi/ }),
    ).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: /Bài kiểm tra/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Nhóm can thiệp/ })).toBeNull();
  });

  it('restores the teacher account and renders the operational class overview', async () => {
    window.localStorage.setItem(
      'nekopath.demo-session.v2',
      JSON.stringify({ accountId: 'teacher-7a-ha' }),
    );
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Chào buổi chiều, Cô Hà/ }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Nhóm can thiệp/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Bài kiểm tra/ })).toBeNull();
  });

  it('redirects protected routes to login when no account is selected', () => {
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Đăng nhập bằng tài khoản mẫu' }),
    ).toBeTruthy();
  });
});
