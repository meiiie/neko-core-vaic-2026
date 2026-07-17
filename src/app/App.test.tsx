import 'fake-indexeddb/auto';
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

  it('renders the shared target task for /learn/:learnerId', async () => {
    render(
      <MemoryRouter initialEntries={['/learn/an']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /Bài toán chung của lớp — an/ }),
    ).toBeTruthy();
  });

  it('shows the out-of-demo state for an unknown learner', async () => {
    render(
      <MemoryRouter initialEntries={['/learn/unknown-kid']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Ngoài phạm vi demo' })).toBeTruthy();
  });
});
