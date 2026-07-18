import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentDiagnosisContext } from '../../app/adapters/hero-tutor';
import type { LearnerEventRecord } from '../../storage/db';
import { storedHeroRecords } from '../../test/hero-evidence';
import { PathPage } from './PathPage';

const { pathState } = vi.hoisted(() => ({
  pathState: {
    context: {
      learnerId: 'user-student-minh',
      simulationProfileId: 'minh',
    } as StudentDiagnosisContext,
    records: [] as LearnerEventRecord[],
  },
}));

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
  studentContextForAccount: () => pathState.context,
  useStudentEvents: () => ({
    records: pathState.records,
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

vi.mock('../../services/lessons', () => ({ useLessonKcIds: () => new Set<string>() }));

describe('continuous student path', () => {
  beforeEach(() => {
    pathState.context = {
      learnerId: 'user-student-minh',
      simulationProfileId: 'minh',
    };
    pathState.records = [
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
  });

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

  it('explains that a wrong answer is retained while the safe path waits for more evidence', () => {
    pathState.context = { learnerId: 'user-student-minh' };
    pathState.records = [
      {
        id: 'evt-assignment-wrong',
        learnerId: 'user-student-minh',
        itemId: 'bank-K10-CHECK-1',
        sequence: 1,
        occurredAt: '2026-07-18T09:00:00.000Z',
        kind: 'ASSIGNMENT_ANSWER',
        payload: '{"choiceId":"b","correct":false,"methodValidity":"UNKNOWN"}',
      },
    ];

    render(
      <MemoryRouter>
        <PathPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Câu trả lời đã được ghi nhận, nhưng chưa đủ để tìm nguyên nhân gốc',
      }),
    ).toBeTruthy();
    expect(screen.getByText(/1 câu trả lời đã được lưu trong hồ sơ/)).toBeTruthy();
    expect(screen.getByText(/Dữ liệu học tập không bị mất/)).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Trả lời câu xác minh để mở lộ trình' })
        .getAttribute('href'),
    ).toBe('/student/check-in');
  });
});
