import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearnerEventRecord } from '../../storage/db';
import { PracticePage } from './PracticePage';

const { practiceState } = vi.hoisted(() => ({
  practiceState: { records: [] as LearnerEventRecord[] },
}));

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: 'learner-practice-page',
      role: 'STUDENT',
      learnerId: 'learner-practice-page',
      shortName: 'Anh',
    },
  }),
}));

vi.mock('../../app/adapters/student-context', async () => {
  const actual = await vi.importActual<typeof import('../../app/adapters/student-context')>(
    '../../app/adapters/student-context',
  );
  return {
    ...actual,
    useStudentEvents: () => ({
      records: practiceState.records,
      migrationError: false,
      retryMigration: vi.fn(),
    }),
  };
});

vi.mock('../../services/lessons', () => ({
  useLesson: () => ({ lesson: null, source: 'device' }),
}));

vi.mock('../../services/llm', () => ({
  resolveTutorLlm: () => ({
    complete: () => Promise.resolve({ status: 'FALLBACK', text: 'Giải thích dự phòng.' }),
  }),
}));

function answer(sequence: number, itemId: string, correct: boolean): LearnerEventRecord {
  return {
    id: `practice-page-${sequence}`,
    learnerId: 'learner-practice-page',
    itemId,
    sequence,
    occurredAt: `2026-07-18T10:${String(sequence).padStart(2, '0')}:00.000Z`,
    kind: 'ANSWER',
    payload: JSON.stringify({ choiceId: correct ? 'a' : 'b', correct, methodValidity: 'UNKNOWN' }),
  };
}

const diagnosedK01 = [
  answer(1, 'K01-CHECK-1', false),
  answer(2, 'K01-CHECK-2', false),
  answer(3, 'K10-CHECK-1', false),
];

function renderPractice(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PracticePage />
    </MemoryRouter>,
  );
}

describe('multi-step practice flow', () => {
  beforeEach(() => {
    practiceState.records = [...diagnosedK01];
  });

  it('serves the requested current KC and blocks skipping an upcoming step', () => {
    const current = renderPractice('/student/practice?kc=K01');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Lấp lỗ hổng: Ý nghĩa phân số' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Một hình chữ nhật được chia thành 8 phần/,
      }),
    ).toBeTruthy();
    current.unmount();

    renderPractice('/student/practice?kc=K02');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hoàn thành Ý nghĩa phân số trước' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tiếp tục bước đang học' }).getAttribute('href')).toBe(
      '/student/practice?kc=K01',
    );
  });

  it('moves to K02 after K01 is repaired instead of ending the path', () => {
    practiceState.records = [
      ...diagnosedK01,
      answer(4, 'K01-CHECK-1', true),
      answer(5, 'K01-CHECK-2', true),
      answer(6, 'K01-CHECK-1', true),
    ];

    renderPractice('/student/practice?kc=K02');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bước tiếp theo: Phân số bằng nhau' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Phân số nào bằng 2/3?' })).toBeTruthy();
  });

  it('advances to the next KC in place when the requested step is already mastered', () => {
    // Regression: previously, once K01 flipped to COMPLETED the URL ?kc=K01
    // silently switched into repeat/review mode and looped the same two K01
    // questions instead of advancing the path. The live currentKcId must take
    // over so the learner lands on K02 without clicking "Lưu và thoát".
    practiceState.records = [
      ...diagnosedK01,
      answer(4, 'K01-CHECK-1', true),
      answer(5, 'K01-CHECK-2', true),
      answer(6, 'K01-CHECK-1', true),
    ];

    renderPractice('/student/practice?kc=K01');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Bước tiếp theo: Phân số bằng nhau' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Phân số nào bằng 2/3?' })).toBeTruthy();
    expect(screen.queryByText('Ôn lại')).toBeNull();
  });

  it('shows an honest evidence gap instead of repeating correct questions or completing', () => {
    practiceState.records = [
      ...diagnosedK01,
      answer(4, 'K01-CHECK-1', true),
      answer(5, 'K01-CHECK-2', true),
    ];

    renderPractice('/student/practice?kc=K01');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Đã làm hết câu hỏi khác nhau của bước Ý nghĩa phân số',
      }),
    ).toBeTruthy();
    expect(screen.queryByText('Lộ trình đã hoàn thành')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Làm một câu xác nhận lại' }).getAttribute('href'),
    ).toBe('/student/practice?kc=K01&mode=confirm');
  });

  it('labels an explicit confirmation retry instead of silently repeating a question', () => {
    practiceState.records = [
      ...diagnosedK01,
      answer(4, 'K01-CHECK-1', true),
      answer(5, 'K01-CHECK-2', true),
    ];

    renderPractice('/student/practice?kc=K01&mode=confirm');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Xác nhận bước: Ý nghĩa phân số' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Câu này được lặp lại có chủ đích vì ngân hàng hiện chưa có câu kiểm tra thứ ba đã duyệt.',
      ),
    ).toBeTruthy();
  });

  it('honours an explicit ?mode=review of a completed step instead of hijacking it with the path-complete panel', () => {
    // Regression: once the path is FAST_PATH, clicking "Ôn lại" on a completed
    // step (?mode=review) was bounced to the "Em đã vững các kiến thức nền"
    // panel and never let the learner review that KC. The explicit review
    // request must reach the active-practice branch.
    const fullyMastered = [
      ...diagnosedK01,
      answer(4, 'K01-CHECK-1', true),
      answer(5, 'K01-CHECK-2', true),
      answer(6, 'K01-CHECK-1', true),
      answer(7, 'K02-CHECK-1', true),
      answer(8, 'K02-CHECK-2', true),
      answer(9, 'K07-CHECK-1', true),
      answer(10, 'K07-CHECK-2', true),
      answer(11, 'K08-CHECK-1', true),
      answer(12, 'K08-CHECK-2', true),
      answer(13, 'K09-CHECK-1', true),
      answer(14, 'K09-CHECK-2', true),
      answer(15, 'K10-CHECK-1', true),
      answer(16, 'K10-CHECK-2', true),
    ];
    practiceState.records = fullyMastered;

    renderPractice('/student/practice?kc=K08&mode=review');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ôn lại: Các tỉ số bằng nhau' }),
    ).toBeTruthy();
    expect(screen.queryByText('Lộ trình đã hoàn thành')).toBeNull();
  });
});
