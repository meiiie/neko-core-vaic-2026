import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeroSimulationProfileId } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { storedHeroRecords } from '../../test/hero-evidence';
import { StudentDashboardPage } from './StudentDashboardPage';

const state = vi.hoisted(() => ({
  profileId: 'chi' as HeroSimulationProfileId,
  records: [] as LearnerEventRecord[],
}));

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: `user-student-${state.profileId}`,
      role: 'STUDENT',
      learnerId: `user-student-${state.profileId}`,
      simulationProfileId: state.profileId,
      shortName: state.profileId === 'an' ? 'An' : 'Chi',
      className: '7A',
    },
  }),
}));

vi.mock('../../app/adapters/student-context', () => ({
  studentContextForAccount: () => ({
    learnerId: `user-student-${state.profileId}`,
    simulationProfileId: state.profileId,
  }),
  useStudentEvents: () => ({
    records: state.records,
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

describe('student dashboard state contract', () => {
  beforeEach(() => {
    state.profileId = 'chi';
    state.records = storedHeroRecords('chi');
  });

  it('explains the bounded, no-score check-in without audit jargon', () => {
    render(
      <MemoryRouter>
        <StudentDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Bắt đầu kiểm tra nền tảng' })).toBeTruthy();
    expect(screen.getByText(/Tối đa 3 câu · Không tính điểm/)).toBeTruthy();
    expect(screen.queryByText('Giả thuyết đang phân biệt')).toBeNull();
  });

  it('shows An one cross-grade action and the reason for it', () => {
    state.profileId = 'an';
    state.records = storedHeroRecords('an');
    render(
      <MemoryRouter>
        <StudentDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Mở tóm tắt 2 phút' })).toBeTruthy();
    expect(screen.getAllByText(/Kiến thức nền lớp 5-6/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Học bước 1: Phân số bằng nhau' })).toBeTruthy();
  });
});
