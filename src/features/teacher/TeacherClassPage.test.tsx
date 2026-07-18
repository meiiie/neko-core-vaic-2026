import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installApiStub, TEACHER_DASHBOARD_FIXTURE } from '../../test/api-stub';
import { TeacherGroupDetailPage } from './TeacherGroupDetailPage';

describe('teacher diagnosis override', () => {
  beforeEach(() => {
    installApiStub('co.ha@nekopath.edu.vn');
  });

  it('persists a reasoned decision through the teacher backend API', async () => {
    const originalGroup = TEACHER_DASHBOARD_FIXTURE.groups[0]!;
    const movedLearner = originalGroup.learners[0]!;
    const remainingLearner = originalGroup.learners[1]!;
    installApiStub('co.ha@nekopath.edu.vn', TEACHER_DASHBOARD_FIXTURE, {
      ...TEACHER_DASHBOARD_FIXTURE,
      groups: [
        {
          ...originalGroup,
          id: 'root:K07',
          rootKcId: 'K07',
          learnerIds: [movedLearner.id],
          learners: [movedLearner],
          totalLearnerCount: 1,
          reviewLearnerRate: 0.5,
          recommendedKcIds: ['K07'],
          recommendedQuestionIds: ['bank-K07-CHECK-1', 'bank-K07-CHECK-2'],
        },
        {
          ...originalGroup,
          learnerIds: [remainingLearner.id],
          learners: [remainingLearner],
          totalLearnerCount: 1,
          reviewLearnerRate: 0.5,
        },
      ],
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/teacher/class/root%3AK02']}>
        <Routes>
          <Route path="/teacher/class/:groupId" element={<TeacherGroupDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText('Điều chỉnh gợi ý của hệ thống'));
    const heading = await screen.findByRole('heading', {
      name: 'Điều chỉnh gợi ý cho một học sinh',
    });
    const form = heading.closest('form');
    expect(form).toBeTruthy();
    const controls = within(form!);

    await user.selectOptions(
      controls.getByLabelText('Gợi ý đúng theo đánh giá của cô'),
      'ROOT:K07',
    );
    await user.type(
      controls.getByLabelText('Lý do điều chỉnh'),
      'Đã trao đổi trực tiếp và xem cách làm của em.',
    );
    await user.click(controls.getByRole('button', { name: 'Lưu điều chỉnh' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bài: Ý nghĩa và thứ tự của tỉ số' }),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        'Đã lưu. Học sinh được chuyển sang bài cần ôn: Ý nghĩa và thứ tự của tỉ số.',
      ),
    ).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/teacher/overrides',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"learnerId":"user-student-an"'),
      }),
    );
  });
});
