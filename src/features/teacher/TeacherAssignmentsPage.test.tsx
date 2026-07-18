import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../../test/api-stub';
import { TeacherAssignmentsPage } from './TeacherAssignmentsPage';

describe('targeted review assignment flow', () => {
  beforeEach(() => installApiStub('co.ha@nekopath.edu.vn'));

  it('preselects a recommended package and recipients, then reviews before assigning', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/teacher/assignments?group=root%3AK02']}>
        <TeacherAssignmentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Bài ôn được đề xuất' })).toBeTruthy();
    expect(screen.getByText('Đã chọn 2 học sinh theo dấu hiệu bài làm')).toBeTruthy();
    expect(screen.getByText('Hệ thống đã chọn ngẫu nhiên 5 câu phù hợp.')).toBeTruthy();

    const message = screen.getByLabelText('Lời nhắn của giáo viên');
    await user.clear(message);
    await user.type(message, 'Cô gửi em bài ôn này. Em làm kỹ từng câu nhé.');

    await user.selectOptions(screen.getByLabelText('Số câu chọn ngẫu nhiên'), '3');
    await user.click(screen.getByRole('button', { name: 'Chọn ngẫu nhiên' }));
    expect(screen.getByText('Đã chọn 3/6 câu trong gói')).toBeTruthy();

    await user.click(screen.getByText('Điều chỉnh người nhận'));
    await user.click(screen.getByRole('checkbox', { name: 'Nguyễn Minh Chi' }));
    await user.click(screen.getByRole('button', { name: 'Xem lại bài sẽ giao' }));

    expect(await screen.findByRole('heading', { name: 'Kiểm tra lần cuối' })).toBeTruthy();
    expect(screen.getByText('Trần Ngọc An')).toBeTruthy();
    expect(screen.queryByText('Nguyễn Minh Chi')).toBeNull();
    expect(screen.getByText('3 câu · khoảng 9 phút')).toBeTruthy();
    expect(screen.getByText('Cô gửi em bài ôn này. Em làm kỹ từng câu nhé.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Xác nhận và giao bài' }));
    expect(await screen.findByText('Đã giao bài cho 1 học sinh.')).toBeTruthy();

    const postCall = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/assignments') && init?.method === 'POST',
      );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(String(postCall?.[1]?.body)) as {
      learnerIds: string[];
      questionIds: string[];
      teacherMessage: string;
    };
    expect(body.learnerIds).toEqual(['user-student-an']);
    expect(body.questionIds).toHaveLength(3);
    expect(body.teacherMessage).toBe('Cô gửi em bài ôn này. Em làm kỹ từng câu nhé.');
  });

  it('allows selecting the entire lesson package', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/teacher/assignments?group=root%3AK02']}>
        <TeacherAssignmentsPage />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Bài ôn được đề xuất' });
    await user.click(screen.getByRole('button', { name: 'Chọn tất cả 6 câu' }));
    await waitFor(() => expect(screen.getByText('Đã chọn 6/6 câu trong gói')).toBeTruthy());
  });
});
