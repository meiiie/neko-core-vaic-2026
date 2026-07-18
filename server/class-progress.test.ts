// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildClassStudentList, buildStudentDetail } from './class-progress.ts';
import { openDb } from './db.ts';
import { CLASS_7A_ID, seed } from './seed.ts';

describe('class progress', () => {
  it('does not count seeded walkthrough evidence as student activity', () => {
    const db = openDb(':memory:');
    seed(db);

    const detail = buildStudentDetail(db, CLASS_7A_ID, 'user-student-an');
    expect(detail?.lessonProgress.find((lesson) => lesson.kcId === 'K02')).toMatchObject({
      assignedCount: 2,
      answeredCount: 0,
      correctCount: 0,
      progressPercent: 0,
      correctRate: null,
      status: 'NOT_STARTED',
    });
    expect(
      buildClassStudentList(db, CLASS_7A_ID).find((learner) => learner.id === 'user-student-an'),
    ).toMatchObject({
      progressPercent: 0,
      needsSupportCount: 0,
      latestActivityAt: null,
    });
  });

  it('suggests review only from persisted low-correctness evidence', () => {
    const db = openDb(':memory:');
    seed(db);
    const learnerId = 'user-student-an';
    const assignmentId = 'assignment-progress-test';
    db.prepare(
      `INSERT INTO assignments
       (id, class_id, teacher_id, title, question_ids_json, created_at, recipient_ids_json,
        teacher_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      assignmentId,
      CLASS_7A_ID,
      'user-teacher-ha',
      'Ôn phân số bằng nhau',
      JSON.stringify(['bank-K02-CHECK-1', 'bank-K02-CHECK-2']),
      '2026-07-18T08:00:00.000Z',
      JSON.stringify([learnerId]),
      'Em xem kỹ từng bước nhé.',
    );
    const insertEvent = db.prepare(
      `INSERT INTO events
       (id, learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ANSWER_SUBMITTED', ?, ?)`,
    );
    for (const [index, questionId] of ['bank-K02-CHECK-1', 'bank-K02-CHECK-2'].entries()) {
      insertEvent.run(
        `event-progress-${index}`,
        learnerId,
        questionId,
        assignmentId,
        index + 1,
        `2026-07-18T08:0${index}:00.000Z`,
        JSON.stringify({ correct: false, choiceId: 'b' }),
        `2026-07-18T08:0${index}:01.000Z`,
      );
    }

    const detail = buildStudentDetail(db, CLASS_7A_ID, learnerId);
    expect(detail?.lessonProgress.find((lesson) => lesson.kcId === 'K02')).toMatchObject({
      assignedCount: 2,
      answeredCount: 2,
      correctCount: 0,
      progressPercent: 100,
      correctRate: 0,
      status: 'NEEDS_SUPPORT',
    });
    expect(detail?.recommendedLessons).toEqual([
      expect.objectContaining({ kcId: 'K02', lessonName: 'Phân số bằng nhau' }),
    ]);
    expect(detail?.assignedWork.find((assignment) => assignment.id === assignmentId)).toMatchObject(
      {
        id: assignmentId,
        teacherMessage: 'Em xem kỹ từng bước nhé.',
        status: 'COMPLETED',
      },
    );
  });
});
