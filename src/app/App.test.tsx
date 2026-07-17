import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../test/api-stub';
import { App } from './App';

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
});
