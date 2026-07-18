import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { storedHeroRecords } from '../../test/hero-evidence';
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
    records: [
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
    ],
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
    expect(screen.getByText('Kiểm tra lại phần từng sai sau một khoảng phục hồi.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bắt đầu lượt ôn 3 câu' }).getAttribute('href')).toBe(
      '/student/check-in?mode=review',
    );
  });
});
