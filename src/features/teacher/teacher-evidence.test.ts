import { describe, expect, it } from 'vitest';
import { TEACHER_DASHBOARD_FIXTURE } from '../../test/api-stub';
import { buildTeacherLearnerEvidenceRows } from './teacher-evidence';

describe('teacher learner evidence presentation', () => {
  it('connects every learner to the server decision and their concrete wrong answers', () => {
    const group = TEACHER_DASHBOARD_FIXTURE.groups[0]!;
    const rows = buildTeacherLearnerEvidenceRows(group, []);

    expect(rows).toHaveLength(group.learners.length);
    expect(rows[0]).toMatchObject({
      learnerId: group.learners[0]?.id,
      decisionLabel: expect.stringMatching(/^Cần ôn: /),
      evidenceCount: group.learners[0]?.eventCount,
      overridden: false,
    });
    expect(rows[0]?.wrongAnswers[0]).toMatchObject({
      eventId: expect.any(String),
      prompt: expect.any(String),
      selectedChoiceLabel: expect.any(String),
      correctChoiceLabel: expect.any(String),
    });
  });

  it('marks a teacher-adjusted decision without exposing override internals', () => {
    const group = TEACHER_DASHBOARD_FIXTURE.groups[0]!;
    const learner = group.learners[0]!;
    const rows = buildTeacherLearnerEvidenceRows(group, [
      {
        id: 'override-1',
        learnerId: learner.id,
        targetKcId: 'K10',
        decision: 'SET_ROOT',
        rootKcId: 'K02',
        reason: 'Đã xem lại bài làm cùng học sinh.',
        updatedAt: '2026-07-18T08:00:00.000Z',
      },
    ]);

    expect(rows.find((row) => row.learnerId === learner.id)?.overridden).toBe(true);
  });
});
