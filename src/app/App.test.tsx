import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  it('renders header, simulation label and main navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'NekoPath' })).toBeTruthy();
    expect(screen.getByText('Dữ liệu mô phỏng')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Học sinh' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Giáo viên' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hệ thống' })).toBeTruthy();
  });

  it('renders the learner placeholder surface for /learn/:learnerId', () => {
    render(
      <MemoryRouter initialEntries={['/learn/an']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Bài luyện tập — an/ })).toBeTruthy();
  });
});
