import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignmentsPage, AssignmentTakePage } from './AssignmentsPage';

describe('student assignments', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the teacher message on the assigned work card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              assignments: [
                {
                  id: 'assignment-review',
                  title: 'Ôn tập phân số bằng nhau',
                  questionCount: 3,
                  myAnswerCount: 0,
                  teacherMessage: 'Cô gửi em bài ôn này. Em làm kỹ từng câu nhé.',
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    render(
      <MemoryRouter>
        <AssignmentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Lời nhắn của giáo viên')).toBeTruthy();
    expect(screen.getByText('Cô gửi em bài ôn này. Em làm kỹ từng câu nhé.')).toBeTruthy();
  });
});

const { recordConfirmedAnswerWithReview } = vi.hoisted(() => ({
  recordConfirmedAnswerWithReview: vi.fn(async () => 'APPENDED' as const),
}));

vi.mock('../../app/session', () => ({
  useSession: () => ({
    account: {
      id: 'user-student-an',
      role: 'STUDENT',
      learnerId: 'user-student-an',
      simulationProfileId: 'an',
    },
  }),
}));

vi.mock('../../app/adapters/student-context', () => ({
  studentContextForAccount: () => ({
    learnerId: 'user-student-an',
    simulationProfileId: 'an',
  }),
  useStudentEvents: () => ({
    records: [],
    migrationError: false,
    retryMigration: vi.fn(),
  }),
}));

vi.mock('../../services/sync', () => ({ recordConfirmedAnswerWithReview }));

describe('assigned-answer evidence loop', () => {
  beforeEach(() => {
    recordConfirmedAnswerWithReview.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/open')) return new Response('{}', { status: 200 });
        if (url.endsWith('/answers')) {
          return new Response(
            JSON.stringify({
              correct: false,
              correctChoiceId: 'a',
              explanation: '',
              note: 'Hãy nhân cả tử và mẫu.',
              hints: ['Nhân cả tử và mẫu với cùng một số.'],
              event: {
                id: 'evt-assignment-1',
                learnerId: 'user-student-an',
                itemId: 'bank-K02-CHECK-1',
                sequence: 1,
                occurredAt: '2026-07-18T09:00:00.000Z',
                kind: 'ASSIGNMENT_ANSWER',
                payload:
                  '{"choiceId":"b","correct":false,"methodValidity":"INVALID","misconceptionId":"ADDITIVE_EQUIVALENCE"}',
              },
              reviewEvent: {
                id: 'review-evt-assignment-1',
                learnerId: 'user-student-an',
                itemId: 'bank-K02-CHECK-1',
                sequence: 2,
                occurredAt: '2026-07-18T09:00:00.000Z',
                kind: 'REVIEW_SCHEDULED',
                payload:
                  '{"version":"review-schedule-v1","kcId":"K02","sourceEventId":"evt-assignment-1","dueAt":"2026-07-19T09:00:00.000Z","intervalDays":1,"reason":"REMEDIATE_SOON"}',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            id: 'assignment-seed-k02',
            title: 'Ôn tập phân số bằng nhau',
            questions: [
              {
                id: 'bank-K02-CHECK-1',
                kcId: 'K02',
                prompt: 'Phân số nào bằng 2/3?',
                choices: [
                  { id: 'a', label: '4/6' },
                  { id: 'b', label: '4/5' },
                ],
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );
  });

  it('persists the server-confirmed answer before showing the next action', async () => {
    render(
      <MemoryRouter initialEntries={['/student/assignments/assignment-seed-k02']}>
        <Routes>
          <Route path="/student/assignments/:assignmentId" element={<AssignmentTakePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('radio', { name: /4\/5/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nộp câu trả lời/ }));

    await waitFor(() => expect(recordConfirmedAnswerWithReview).toHaveBeenCalledTimes(1));
    expect(recordConfirmedAnswerWithReview).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt-assignment-1',
        learnerId: 'user-student-an',
        itemId: 'bank-K02-CHECK-1',
        sequence: 8,
        kind: 'ASSIGNMENT_ANSWER',
      }),
      expect.objectContaining({
        id: 'review-evt-assignment-1',
        learnerId: 'user-student-an',
        itemId: 'bank-K02-CHECK-1',
        sequence: 9,
        kind: 'REVIEW_SCHEDULED',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Chưa đúng' })).toBeTruthy();
  });
});
