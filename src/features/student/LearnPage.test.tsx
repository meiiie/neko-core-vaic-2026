import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LearnPage } from './LearnPage';

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

vi.mock('../../services/sync', () => ({ recordAnswerWithReview: vi.fn() }));

describe('adaptive student check-in', () => {
  it('lets a diagnosed learner start a bounded reassessment round', () => {
    render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Xem lộ trình của tôi' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại để cập nhật lộ trình' }));

    expect(screen.getByRole('heading', { name: /Phân số nào bằng 2\/3/ })).toBeTruthy();
    expect(screen.getAllByText('Câu 1')).toHaveLength(2);
  });
});
