import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../../storage/db';
import { TeacherGroupDetailPage } from './TeacherGroupDetailPage';

describe('teacher diagnosis override', () => {
  afterEach(async () => {
    await db.delete();
  });

  it('persists a reasoned local decision and updates the derived groups', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/teacher/class/root%3AK02']}>
        <Routes>
          <Route path="/teacher/class/:groupId" element={<TeacherGroupDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const heading = await screen.findByRole('heading', { name: 'Sửa kết quả của học sinh' });
    const form = heading.closest('form');
    expect(form).toBeTruthy();
    const controls = within(form!);

    await user.selectOptions(controls.getByLabelText('Kết quả sau khi xem lại'), 'ROOT:K07');
    await user.type(
      controls.getByLabelText('Lý do thay đổi'),
      'Đã trao đổi trực tiếp và xem cách làm của em.',
    );
    await user.click(controls.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(async () => expect(await db.overrides.count()).toBe(1));
    expect(await db.overrides.toArray()).toEqual([
      expect.objectContaining({
        learnerId: 'hs-01',
        decision: 'SET_ROOT',
        rootKcId: 'K07',
      }),
    ]);
    expect(await screen.findByText('Đã lưu thay đổi và cập nhật lại danh sách nhóm.')).toBeTruthy();
  });
});
