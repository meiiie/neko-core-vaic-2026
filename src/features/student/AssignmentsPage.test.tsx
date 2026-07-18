import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssignmentsPage } from './AssignmentsPage';

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
