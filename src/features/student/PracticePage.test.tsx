import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearnerEventRecord } from '../../storage/db';
import { storedHeroRecords } from '../../test/hero-evidence';
import { PracticePage } from './PracticePage';

const state = vi.hoisted(() => ({ records: [] as LearnerEventRecord[] }));
const sync = vi.hoisted(() => ({
  recordAnswerWithReview: vi.fn(
    async (_answer: LearnerEventRecord, _review: LearnerEventRecord) => undefined,
  ),
}));

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
  studentContextForAccount: () => ({ learnerId: 'user-student-an', simulationProfileId: 'an' }),
  useStudentEvents: () => ({
    records: state.records,
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

vi.mock('../../services/lessons', () => ({ useLesson: () => ({ lesson: null }) }));
vi.mock('../../services/sync', () => sync);
vi.mock('../../services/llm', () => ({
  resolveTutorLlm: () => ({
    complete: async (request: { fallbackText: string }) => ({
      status: 'FALLBACK',
      text: request.fallbackText,
      citationIds: [],
    }),
  }),
}));

const LEARNER = 'user-student-an';

function viewedRecord(seq: number): LearnerEventRecord {
  return {
    id: `view-k02-${seq}`,
    learnerId: LEARNER,
    itemId: 'text:K02',
    sequence: seq,
    occurredAt: '2026-07-18T10:00:00.000Z',
    kind: 'RESOURCE_VIEWED',
    payload: '{"kcId":"K02"}',
  };
}

function practiceRecord(
  seq: number,
  itemId: string,
  correct: boolean,
): LearnerEventRecord {
  return {
    id: `practice-${seq}`,
    learnerId: LEARNER,
    itemId,
    sequence: seq,
    occurredAt: '2026-07-18T10:01:00.000Z',
    kind: 'PRACTICE_ANSWER',
    payload: JSON.stringify({ choiceId: 'a', correct, kcId: 'K02' }),
  };
}

describe('student remediation phase gate', () => {
  beforeEach(() => {
    state.records = storedHeroRecords('an');
    sync.recordAnswerWithReview.mockClear();
  });

  // The guided pool rotates between authored variants, so the test must not
  // hard-code a specific itemId. All hero practice questions use choice 'a' as
  // the correct answer and render that choice as the first radio button, so
  // clicking the first radio submits a correct answer for whichever variant is
  // currently shown.
  async function submitCorrectGuidedAnswer(): Promise<string> {
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    await vi.waitFor(() => {
      expect(sync.recordAnswerWithReview).toHaveBeenCalled();
    });
    return sync.recordAnswerWithReview.mock.calls.at(-1)![0]!.itemId;
  }  it('requires explain, then a guided streak, then an independent post-check', async () => {
    const view = render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Xem hoặc đọc trước khi luyện' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mở tóm tắt 2 phút' })).toBeTruthy();

    state.records = [...state.records, viewedRecord(100)];
    view.rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Củng cố: Phân số bằng nhau' })).toBeTruthy();
    // Anti-guessing copy reflects the accuracy + final-streak gate for a 3-item
    // pool: "3/3 câu khác nhau" and "2 câu cuối phải đúng liên tiếp".
    expect(screen.getByText(/3\/3 câu khác nhau/)).toBeTruthy();
    expect(screen.getByText(/2 câu cuối phải đúng liên tiếp/)).toBeTruthy();
    // The guided pool rotates; whichever variant is shown, answering correctly
    // persists a PRACTICE_ANSWER for that KC.
    const firstItemId = await submitCorrectGuidedAnswer();
    expect(sync.recordAnswerWithReview.mock.calls[0]?.[0]).toMatchObject({
      itemId: firstItemId,
      kind: 'PRACTICE_ANSWER',
    });

    // One or two correct answers are not enough — the gate needs all three
    // distinct guided items correct AND a final 2-correct streak.
    const guidedPool = ['K02-CHECK-1', 'K02-CHECK-1b', 'K02-CHECK-1c'];
    const remaining = guidedPool.filter((id) => id !== firstItemId);

    state.records = [...state.records, practiceRecord(101, firstItemId, true)];
    view.rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', { name: 'Kiểm tra phần vừa học' })).toBeNull();

    state.records = [...state.records, practiceRecord(102, remaining[0]!, true)];
    view.rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', { name: 'Kiểm tra phần vừa học' })).toBeNull();

    // Third consecutive correct answer on the last unmastered variant satisfies
    // both accuracy (3 distinct) and the final streak (3 >= 2) → post-check.
    state.records = [...state.records, practiceRecord(103, remaining[1]!, true)];
    view.rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Kiểm tra phần vừa học' })).toBeTruthy();
    expect(screen.getByText(/Câu này không có gợi ý/)).toBeTruthy();
  });

  it('shows a non-blocking review nudge after several wrong guesses and keeps practice open', () => {
    state.records = [
      ...state.records,
      viewedRecord(100),
      practiceRecord(101, 'K02-CHECK-1', false),
      practiceRecord(102, 'K02-CHECK-1b', false),
      practiceRecord(103, 'K02-CHECK-1', false),
    ];
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    // The nudge is non-blocking: it offers to review the summary AND to keep
    // practising. The guided question itself stays on screen so the learner is
    // never stuck in a dead-end.
    expect(screen.getByTestId('review-nudge')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem lại tóm tắt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Luyện tiếp' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Củng cố: Phân số bằng nhau' })).toBeTruthy();
  });
});
