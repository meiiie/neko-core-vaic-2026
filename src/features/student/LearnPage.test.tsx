import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { storedHeroRecords } from '../../test/hero-evidence';
import { LearnPage } from './LearnPage';

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: 'user-student-an',
      role: 'STUDENT',
      learnerId: 'user-student-an',
      simulationProfileId: 'an',
      shortName: 'An',
    },
  }),
}));

vi.mock('../../app/adapters/student-context', () => ({
  studentContextForAccount: () => ({
    learnerId: 'user-student-an',
    simulationProfileId: 'an',
  }),
  useStudentEvents: () => ({
    records: storedHeroRecords('an'),
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

vi.mock('../../services/sync', () => ({ recordAnswerWithReview: vi.fn() }));

describe('adaptive student check-in', () => {
  it('returns a diagnosed learner to the current learning step', () => {
    render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Mở tóm tắt 2 phút' }).getAttribute('href')).toBe(
      '/student/lesson/K02',
    );
    expect(screen.queryByRole('button', { name: 'Kiểm tra lại phần đã học' })).toBeNull();
  });

  it('opens a bounded reassessment only from an explicit review link', () => {
    render(
      <MemoryRouter initialEntries={['/student/check-in?mode=review']}>
        <LearnPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Phân số nào bằng 2\/3/ })).toBeTruthy();
    expect(screen.getByText(/không tính điểm.*tối đa 3 câu/i)).toBeTruthy();
  });
});
