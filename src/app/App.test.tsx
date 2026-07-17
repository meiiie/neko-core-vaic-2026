import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  it('renders brand, truth labels and the single mode navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'NekoPath' })).toBeTruthy();
    expect(screen.getByText('Dữ liệu mô phỏng')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Học sinh' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Giáo viên' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hệ thống' })).toBeTruthy();
    // Duplicate role buttons were removed; navigation is the only mode switch.
    expect(screen.queryByRole('button', { name: /Vai trò/ })).toBeNull();
  });

  it('shows the proof-oriented headline and primary comparison action on /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cùng một lỗi bề mặt — khác lỗ hổng gốc' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /So sánh An ↔ Bình/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Mở bảng lớp 40 học sinh/ })).toBeTruthy();
  });

  it('renders the student surface with human-readable label for /learn/:learnerId', async () => {
    render(
      <MemoryRouter initialEntries={['/learn/an']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: /Học sinh An/ })).toBeTruthy();
  });

  it('shows the out-of-demo state for an unknown learner', async () => {
    render(
      <MemoryRouter initialEntries={['/learn/unknown-kid']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ngoài phạm vi demo' }),
    ).toBeTruthy();
  });
});
