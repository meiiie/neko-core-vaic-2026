import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../../test/api-stub';
import { App } from '../../app/App';
import { LESSON_SUMMARIES } from '../../content/lessons.v1';
import { refreshLessons } from '../../services/lessons';

describe('lesson materials (server-owned rows, device mirror for offline)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('seeds every KC in the slice and keeps drafts honestly labelled', () => {
    expect(new Set(LESSON_SUMMARIES.map((lesson) => lesson.kcId)).size).toBe(12);
    expect(LESSON_SUMMARIES.every((lesson) => lesson.reviewState === 'UNREVIEWED')).toBe(true);
  });

  it('renders a mirrored lesson with the draft label and practice CTA', async () => {
    installApiStub('an@nekopath.edu.vn');
    await refreshLessons(); // what the app shell does on start/reconnect

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
    expect(screen.getByText(/Kiến thức nền lớp 5-6 · phục vụ .* lớp 7/)).toBeTruthy();
    expect(screen.getByText(/Chưa có video\/PDF đã duyệt/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Luyện có gợi ý' })).toBeTruthy();
  });

  it('offers a retry instead of pretending when the lesson is not on the device', async () => {
    installApiStub('an@nekopath.edu.vn');
    render(
      <MemoryRouter initialEntries={['/student/lesson/K99']}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tài liệu chưa có trên thiết bị này' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải tài liệu' })).toBeTruthy();
  });
});
