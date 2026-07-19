import { render, screen } from '@testing-library/react';
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

  it('does not silently serve the transfer item when a completed learner opens a review round', () => {
    // Regression (PR #34): minh has finished the path (FAST_PATH) and the
    // transfer item is unused, so `result.nextItemId` points at it. A review
    // round (?mode=review) must never serve that transfer question under a
    // "review" entry — with no due review it surfaces an honest empty state.
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
