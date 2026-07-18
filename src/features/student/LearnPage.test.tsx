import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storedHeroRecords } from '../../test/hero-evidence';
import { LearnPage } from './LearnPage';

const { profile } = vi.hoisted(() => ({
  profile: { id: 'an' as 'an' | 'minh', learnerId: 'user-student-an' },
}));

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: 'user-student-an',
      role: 'STUDENT',
      learnerId: profile.learnerId,
      simulationProfileId: profile.id,
      shortName: 'An',
    },
  }),
}));

vi.mock('../../app/adapters/student-context', () => ({
  studentContextForAccount: () => ({
    learnerId: profile.learnerId,
    simulationProfileId: profile.id,
  }),
  useStudentEvents: () => ({
    records: storedHeroRecords(profile.id),
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

vi.mock('../../services/sync', () => ({ recordAnswerWithReview: vi.fn() }));

describe('adaptive student check-in', () => {
  beforeEach(() => {
    profile.id = 'an';
    profile.learnerId = 'user-student-an';
  });

  it('lets a diagnosed learner start a bounded reassessment round', () => {
    render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Xem lộ trình của tôi' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại để cập nhật lộ trình' }));

    expect(screen.getByRole('heading', { name: /Phân số nào bằng 2\/3/ })).toBeTruthy();
    expect(screen.getAllByText('Câu 1')).toHaveLength(2);
  });

  it('does not silently serve the transfer item when a completed learner opens a review round', () => {
    // Regression: minh has finished the path (FAST_PATH) and K10-TRANSFER is
    // unused, so `result.nextItemId` points at the transfer item. Previously a
    // review round (?mode=review) served that transfer item instead of the
    // scheduled review. With no persisted review schedule for minh the page must
    // surface an honest empty state, NOT the transfer question.
    profile.id = 'minh';
    profile.learnerId = 'user-student-minh';

    render(
      <MemoryRouter initialEntries={['/student/check-in?mode=review']}>
        <LearnPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Chưa có lượt ôn mới cho em lúc này' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', {
        name: /4 quyển vở|7 quyển cùng loại/,
      }),
    ).toBeNull();
  });
});
