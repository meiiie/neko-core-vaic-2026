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
          name: `Sửa câu hỏi: ${QUESTIONS[0].prompt}`,
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

    await user.click(screen.getByRole('button', { name: 'Thêm một câu' }));
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

  it('uses one central group selector and opens the full question editor', async () => {
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
    expect(screen.queryByRole('heading', { name: 'Chọn bài để xem câu hỏi' })).toBeNull();
    const topicSelect = container.querySelector(
      '.question-topic-picker select',
    ) as HTMLSelectElement;
    expect(
      within(topicSelect).getByRole('option', { name: 'Phân số bằng nhau (1 câu)' }),
    ).toBeTruthy();
    await user.selectOptions(topicSelect, 'K02');
    expect(screen.getByText(QUESTIONS[0].prompt)).toBeTruthy();
    expect(screen.queryByText(QUESTIONS[1].prompt)).toBeNull();

    await user.click(screen.getByRole('button', { name: `Sửa câu hỏi: ${QUESTIONS[0].prompt}` }));
    expect(screen.getByRole('heading', { name: 'Kiểm tra lại nội dung và đáp án' })).toBeTruthy();
    const answerA = screen.getByLabelText('Đáp án A') as HTMLInputElement;
    expect(answerA.value).toBe('2/3');
    await user.clear(answerA);
    await user.type(answerA, '4/6');
    await user.click(screen.getAllByLabelText('Đáp án đúng')[1]!);
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/Đã lưu thay đổi/)).toBeTruthy();
  });

  it('previews a file, excludes invalid questions and imports reviewed questions into a package', async () => {
    let importBody: { kcId?: string; questions?: unknown[] } = {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/questions/import/preview') {
        return json({
          fileName: 'phan-so.xlsx',
          format: 'XLSX',
          totalCount: 2,
          validCount: 1,
          invalidCount: 1,
          questions: [
            {
              sourceIndex: 2,
              prompt: 'Phân số nào bằng 2/3?',
              choices: [
                { id: 'a', label: '4/6' },
                { id: 'b', label: '4/5' },
              ],
              correctChoiceId: 'a',
              hints: [],
              explanation: '',
              difficulty: 'MEDIUM',
              valid: true,
              issues: [],
            },
            {
              sourceIndex: 3,
              prompt: 'Câu chưa có đáp án',
              choices: [
                { id: 'a', label: '1/2' },
                { id: 'b', label: '2/3' },
              ],
              correctChoiceId: '',
              hints: [],
              explanation: '',
              difficulty: 'MEDIUM',
              valid: false,
              issues: ['Chưa xác định được đáp án đúng.'],
            },
          ],
        });
      }
      if (url === '/api/questions/import') {
        importBody = JSON.parse(String(init?.body)) as typeof importBody;
        return json({ importedCount: 1, questionIds: ['imported-1'] });
      }
      return json({ questions: QUESTIONS });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeacherQuestionsPage />
      </MemoryRouter>,
    );

    await screen.findByText(QUESTIONS[0].prompt);
    await user.click(screen.getByRole('button', { name: 'Nhập từ Word/Excel' }));
    const importHeading = screen.getByRole('heading', { name: 'Nhập câu hỏi từ Word hoặc Excel' });
    expect(importHeading).toBeTruthy();
    const importPanel = importHeading.closest('section');
    expect(importPanel).not.toBeNull();
    await user.selectOptions(
      within(importPanel as HTMLElement).getByLabelText(/Nhóm câu hỏi \/ chủ đề của file/),
      'K01',
    );

    const fileInput = within(importPanel as HTMLElement).getByLabelText(
      /Chọn file Word hoặc Excel/,
    ) as HTMLInputElement;
    await user.upload(
      fileInput,
      new File(['question data'], 'phan-so.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Đọc file và kiểm tra' }));

    expect(await screen.findByText('1 câu sẵn sàng')).toBeTruthy();
    expect(screen.getByText('Chưa xác định được đáp án đúng.')).toBeTruthy();
    expect(
      (screen.getByRole('checkbox', { name: /Chọn câu 3/ }) as HTMLInputElement).disabled,
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Thêm 1 câu vào gói' }));
    expect(
      await screen.findByRole('heading', { name: 'Đã thêm 1 câu vào nhóm Ý nghĩa phân số' }),
    ).toBeTruthy();
    expect(importBody).toMatchObject({ kcId: 'K01' });
    expect(importBody?.questions).toHaveLength(1);
  });
});
