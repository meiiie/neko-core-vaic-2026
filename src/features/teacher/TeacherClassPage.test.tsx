import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installApiStub } from '../../test/api-stub';
import { TeacherGroupDetailPage } from './TeacherGroupDetailPage';

describe('teacher diagnosis override', () => {
  beforeEach(() => {
    installApiStub('co.ha@nekopath.edu.vn');
  });

  it('persists a reasoned decision through the teacher backend API', async () => {
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

    expect(await screen.findByText('Đã lưu điều chỉnh trên máy chủ.')).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/teacher/overrides',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"learnerId":"user-student-an"'),
      }),
    );
  });
});
