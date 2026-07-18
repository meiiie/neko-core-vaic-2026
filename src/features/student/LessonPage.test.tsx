import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../../test/api-stub';
import { App } from '../../app/App';
import { LESSON_SUMMARIES } from '../../content';

describe('lesson summaries (EXPLAIN step, offline content pack)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('covers every KC in the content graph slice', () => {
    const kcIds = LESSON_SUMMARIES.map((lesson) => lesson.kcId);
    expect(new Set(kcIds).size).toBe(12);
    // Every lesson stays honestly labelled until a named reviewer accepts it.
    expect(LESSON_SUMMARIES.every((lesson) => lesson.reviewState === 'UNREVIEWED')).toBe(true);
  });

  it('renders the K02 summary with the mandatory draft label and practice CTA', async () => {
    installApiStub('an@nekopath.edu.vn');
    render(
      <MemoryRouter initialEntries={['/student/lesson/K02']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Phân số bằng nhau' }),
    ).toBeTruthy();
    expect(screen.getByText('Ý chính cần nhớ')).toBeTruthy();
    expect(screen.getByText('Lỗi thường gặp')).toBeTruthy();
    expect(screen.getByText(/chưa được giáo viên duyệt/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bắt đầu luyện tập' })).toBeTruthy();
  });

  it('shows a calm empty state for an unknown lesson', async () => {
    installApiStub('an@nekopath.edu.vn');
    render(
      <MemoryRouter initialEntries={['/student/lesson/K99']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Chưa có tóm tắt cho phần này' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về lộ trình học' })).toBeTruthy();
  });
});
