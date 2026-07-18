import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeacherStudentsPage } from './TeacherStudentsPage';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('TeacherStudentsPage', () => {
  it('shows teacher classes and real roster progress from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/teacher/classes')) {
          return json({
            classes: [
              {
                id: 'class-8b',
                name: 'Lớp 8B',
                subject: 'Toán',
                schoolYear: '2026–2027',
                createdAt: '2026-07-18T00:00:00.000Z',
                studentCount: 1,
                needsSupportCount: 1,
              },
            ],
          });
        }
        if (url.endsWith('/api/teacher/classes/class-8b/students')) {
          return json({
            class: { id: 'class-8b', name: 'Lớp 8B', subject: 'Toán', schoolYear: '2026–2027' },
            students: [
              {
                id: 'student-nam',
                name: 'Nguyễn Hải Nam',
                email: 'nam@example.edu.vn',
                initials: 'HN',
                shortName: 'Nam',
                progressPercent: 50,
                needsSupportCount: 1,
                latestActivityAt: '2026-07-18T08:00:00.000Z',
                lessonProgress: [],
              },
            ],
          });
        }
        return json({ error: 'NOT_FOUND' }, 404);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/teacher/students']}>
        <TeacherStudentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Quản lý học sinh' })).toBeTruthy();
    expect(await screen.findByText('Nguyễn Hải Nam')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem chi tiết' }).getAttribute('href')).toContain(
      'classId=class-8b',
    );
    expect(screen.getByText('1 bài')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tạo lớp học' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thêm học sinh' })).toBeNull();
  });
});
