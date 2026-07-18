import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeroSimulationProfileId } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { storedHeroRecords } from '../../test/hero-evidence';
import { PathPage } from './PathPage';

const state = vi.hoisted(() => ({
  profileId: 'minh' as HeroSimulationProfileId,
  records: [] as LearnerEventRecord[],
}));

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: `user-student-${state.profileId}`,
      role: 'STUDENT',
      learnerId: `user-student-${state.profileId}`,
      simulationProfileId: state.profileId,
      shortName: state.profileId === 'an' ? 'An' : state.profileId === 'chi' ? 'Chi' : 'Minh',
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

vi.mock('../../services/lessons', () => ({ useLessonKcIds: () => new Set(['K02']) }));

describe('continuous student path', () => {
  beforeEach(() => {
    state.profileId = 'minh';
    state.records = storedHeroRecords('minh');
  });

  it('shows an actionable cross-grade current step', () => {
    state.profileId = 'an';
    state.records = storedHeroRecords('an');
    render(
      <MemoryRouter>
        <PathPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Kiến thức nền lớp 5-6/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Bước hiện tại · Xem hoặc đọc/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Mở tóm tắt 2 phút' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Tóm tắt chữ có sẵn ngoại tuyến')).toBeTruthy();
  });

  it('does not render an empty timeline before check-in', () => {
    state.profileId = 'chi';
    state.records = storedHeroRecords('chi');
    render(
      <MemoryRouter>
        <PathPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Chưa tạo kế hoạch học' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Trả lời câu phân biệt tiếp theo' })).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'Từ kiến thức nền tới mục tiêu lớp 7' }),
    ).toBeNull();
  });

  it('offers evidence-based maintenance after the current remediation path is complete', () => {
    state.records = [
      ...storedHeroRecords('minh'),
      {
        id: 'answer-transfer',
        learnerId: 'user-student-minh',
        itemId: 'K10-TRANSFER',
        sequence: 100,
        occurredAt: '2020-01-01T08:00:00.000Z',
        kind: 'ANSWER',
        payload: '{"choiceId":"a","correct":true,"methodValidity":"UNKNOWN"}',
      },
      {
        id: 'review-answer-transfer',
        learnerId: 'user-student-minh',
        itemId: 'K10-TRANSFER',
        sequence: 101,
        occurredAt: '2020-01-01T08:00:00.000Z',
        kind: 'REVIEW_SCHEDULED',
        payload:
          '{"version":"review-schedule-v1","kcId":"K10","sourceEventId":"answer-transfer","dueAt":"2020-01-04T08:00:00.000Z","intervalDays":3,"reason":"RECOVERY_CHECK"}',
      },
    ];
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
    expect(screen.getByText('Kiểm tra lại phần từng sai sau một khoảng phục hồi.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bắt đầu lượt ôn 3 câu' }).getAttribute('href')).toBe(
      '/student/check-in?mode=review',
    );
  });
});
