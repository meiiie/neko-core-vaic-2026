import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { db } from '../../storage/db';
import { TeacherClassPage } from './TeacherClassPage';

describe('teacher diagnosis override', () => {
  afterEach(async () => {
    await db.delete();
  });

  it('persists a reasoned local decision and updates the derived groups', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeacherClassPage />
      </MemoryRouter>,
    );

    const details = (await screen.findAllByText('Xem chi tiết'))[0];
    await user.click(details);
    const heading = screen.getAllByRole('heading', { name: 'Sửa kết quả của học sinh' })[0];
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
