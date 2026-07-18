import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PathPage } from './PathPage';

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: 'user-student-minh',
      role: 'STUDENT',
      learnerId: 'user-student-minh',
      simulationProfileId: 'minh',
      shortName: 'Minh',
    },
  }),
}));

vi.mock('../../app/adapters/student-context', () => ({
  studentContextForAccount: () => ({
    learnerId: 'user-student-minh',
    simulationProfileId: 'minh',
  }),
  useStudentEvents: () => ({
    records: [],
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

vi.mock('../../services/lessons', () => ({ useLessonKcIds: () => new Set<string>() }));

describe('continuous student path', () => {
  it('offers evidence-based maintenance after the current remediation path is complete', () => {
    render(
      <MemoryRouter>
        <PathPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Ôn thông minh: Tìm giá trị chưa biết trong tỉ lệ thức',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('Kiểm tra lại phần từng sai nhiều nhưng gần đây đã cải thiện.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bắt đầu lượt ôn 3 câu' }).getAttribute('href')).toBe(
      '/student/check-in?mode=review',
    );
  });
});
