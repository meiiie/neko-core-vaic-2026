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

describe('student remediation phase gate', () => {
  beforeEach(() => {
    state.records = storedHeroRecords('an');
    sync.recordAnswerWithReview.mockClear();
  });

  it('requires explain, then guided practice, then an independent post-check', async () => {
    const view = render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Xem hoặc đọc trước khi luyện' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mở tóm tắt 2 phút' })).toBeTruthy();

    state.records = [
      ...state.records,
      {
        id: 'view-k02',
        learnerId: 'user-student-an',
        itemId: 'text:K02',
        sequence: 100,
        occurredAt: '2026-07-18T10:00:00.000Z',
        kind: 'RESOURCE_VIEWED',
        payload: '{"kcId":"K02"}',
      },
    ];
    view.rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Củng cố: Phân số bằng nhau' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '4/6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    await vi.waitFor(() => expect(sync.recordAnswerWithReview).toHaveBeenCalled());
    expect(sync.recordAnswerWithReview.mock.calls[0]?.[0]).toMatchObject({
      itemId: 'K02-CHECK-1',
      kind: 'PRACTICE_ANSWER',
    });

    state.records = [
      ...state.records,
      {
        id: 'practice-k02',
        learnerId: 'user-student-an',
        itemId: 'K02-CHECK-1',
        sequence: 101,
        occurredAt: '2026-07-18T10:01:00.000Z',
        kind: 'PRACTICE_ANSWER',
        payload: '{"choiceId":"a","correct":true,"methodValidity":"UNKNOWN"}',
      },
    ];
    view.rerender(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Kiểm tra phần vừa học' })).toBeTruthy();
    expect(screen.getByText(/Câu này không có gợi ý/)).toBeTruthy();
  });
});
