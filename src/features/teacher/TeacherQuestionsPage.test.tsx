import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeacherQuestionsPage } from './TeacherQuestionsPage';

const QUESTIONS = [
  {
    id: 'q-z',
    kcId: 'K02',
    prompt: 'Câu Z về phân số bằng nhau',
    choices: [
      { id: 'a', label: '2/3' },
      { id: 'b', label: '3/4' },
    ],
    correctChoiceId: 'a',
    explanation: 'Hai phân số có cùng giá trị.',
    hints: [],
    difficulty: 'UNSPECIFIED',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'q-a',
    kcId: 'K01',
    prompt: 'Bài A về ý nghĩa phân số',
    choices: [
      { id: 'a', label: '3/8' },
      { id: 'b', label: '8/3' },
    ],
    correctChoiceId: 'a',
    explanation: 'Tử số là phần được chọn.',
    hints: [],
    difficulty: 'EASY',
    reviewState: 'ACCEPTED',
  },
];

const PAGINATED_QUESTIONS = Array.from({ length: 12 }, (_, index) => ({
  ...QUESTIONS[index % QUESTIONS.length],
  id: `page-question-${index + 1}`,
  prompt: `Câu phân trang ${String(index + 1).padStart(2, '0')}`,
}));

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Teacher question bank workflow', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sorts, reports partial selection across filters and restores an empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ questions: QUESTIONS })),
    );
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <TeacherQuestionsPage />
      </MemoryRouter>,
    );

    await screen.findByText(QUESTIONS[0].prompt);
    const firstRow = screen
      .getByRole('checkbox', { name: `Chọn câu hỏi: ${QUESTIONS[0].prompt}` })
      .closest('li');
    expect(firstRow).not.toBeNull();
    expect(
      within(firstRow as HTMLElement)
        .getByRole('button', {
          name: `Chỉnh sửa nhanh: ${QUESTIONS[0].prompt}`,
        })
        .querySelector('svg'),
    ).toBeTruthy();
    expect(
      within(firstRow as HTMLElement)
        .getByRole('button', {
          name: `Nhân bản: ${QUESTIONS[0].prompt}`,
        })
        .querySelector('svg'),
    ).toBeTruthy();
    expect(firstRow?.textContent).not.toContain('2 phương án');
    expect(firstRow?.textContent).not.toContain('Chưa phân loại');

    await user.click(screen.getByRole('button', { name: 'Tạo câu hỏi' }));
    const promptInput = screen.getByLabelText('Câu hỏi');
    await waitFor(() => expect(document.activeElement).toBe(promptInput));
    await user.click(screen.getByText('Đóng phần tạo'));

    const visiblePrompts = () =>
      [...container.querySelectorAll<HTMLElement>('.question-prompt')].map(
        (element) => element.textContent,
      );
    expect(visiblePrompts()).toEqual([QUESTIONS[0].prompt, QUESTIONS[1].prompt]);

    await user.selectOptions(screen.getByLabelText('Sắp xếp'), 'ALPHABETICAL');
    expect(visiblePrompts()).toEqual([QUESTIONS[1].prompt, QUESTIONS[0].prompt]);

    await user.click(
      screen.getByRole('checkbox', { name: `Chọn câu hỏi: ${QUESTIONS[0].prompt}` }),
    );
    expect(screen.getByRole('button', { name: 'Tạo bài tập với 1 câu' })).toBeTruthy();
    const selectAll = screen.getByRole('checkbox', {
      name: 'Chọn tất cả 2 câu trên trang',
    }) as HTMLInputElement;
    await waitFor(() => expect(selectAll.indeterminate).toBe(true));

    const search = screen.getByLabelText('Tìm kiếm');
    await user.clear(search);
    await user.type(search, 'Bài A');
    expect(screen.getByText(/1 ngoài bộ lọc/)).toBeTruthy();

    await user.clear(search);
    await user.type(search, 'không tồn tại');
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy câu hỏi' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => expect(visiblePrompts()).toHaveLength(2));
    await waitFor(() => expect(document.activeElement).toBe(search));
  });

  it('paginates the filtered list and keeps selected questions across pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ questions: PAGINATED_QUESTIONS })),
    );
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <TeacherQuestionsPage />
      </MemoryRouter>,
    );

    await screen.findByText(PAGINATED_QUESTIONS[0].prompt);
    expect(container.querySelectorAll('.question-prompt')).toHaveLength(10);
    expect(screen.getByText('1–10 / 12 câu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trang 1' }).getAttribute('aria-current')).toBe(
      'page',
    );

    await user.click(screen.getByRole('checkbox', { name: 'Chọn tất cả 10 câu trên trang' }));
    await user.click(screen.getByRole('button', { name: 'Sau' }));

    expect(container.querySelectorAll('.question-prompt')).toHaveLength(2);
    expect(screen.getByText('11–12 / 12 câu')).toBeTruthy();
    expect(screen.getByText(/10 ở trang khác/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trang 2' }).getAttribute('aria-current')).toBe(
      'page',
    );

    const search = screen.getByLabelText('Tìm kiếm');
    await user.type(search, 'Câu phân trang 12');
    expect(container.querySelectorAll('.question-prompt')).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Phân trang danh sách câu hỏi' })).toBeNull();

    await user.clear(search);
    await waitFor(() => expect(container.querySelectorAll('.question-prompt')).toHaveLength(10));
    expect(screen.getByText(PAGINATED_QUESTIONS[0].prompt)).toBeTruthy();
    expect(screen.getByText('1–10 / 12 câu')).toBeTruthy();
  });
});
