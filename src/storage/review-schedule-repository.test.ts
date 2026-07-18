import { describe, expect, it } from 'vitest';
import type { LearnerEventRecord } from './db';
import {
  buildReviewScheduleRecord,
  parseReviewScheduleRecord,
  persistedReviewSchedules,
} from './review-schedule-repository';

function answer(id: string, sequence: number, correct: boolean): LearnerEventRecord {
  return {
    id,
    learnerId: 'student-1',
    itemId: 'K02-CHECK-1',
    sequence,
    occurredAt: '2026-07-18T08:00:00.000Z',
    kind: 'ANSWER',
    payload: JSON.stringify({ choiceId: 'a', correct }),
  };
}

describe('persisted review schedules', () => {
  it('builds a schema-valid append-only event after its answer', () => {
    const record = buildReviewScheduleRecord(answer('answer-1', 4, false), 'K02', []);
    expect(record).toMatchObject({
      id: 'review-answer-1',
      learnerId: 'student-1',
      itemId: 'K02-CHECK-1',
      sequence: 5,
      kind: 'REVIEW_SCHEDULED',
    });
    expect(parseReviewScheduleRecord(record)?.payload).toMatchObject({
      kcId: 'K02',
      intervalDays: 1,
      dueAt: '2026-07-19T08:00:00.000Z',
    });
  });

  it('uses the latest persisted interval instead of an in-memory counter', () => {
    const first = buildReviewScheduleRecord(answer('answer-1', 1, true), 'K02', []);
    const second = buildReviewScheduleRecord(answer('answer-2', 3, true), 'K02', [first]);
    expect(
      persistedReviewSchedules([second, first]).map((row) => row.payload.intervalDays),
    ).toEqual([3, 7]);
  });

  it('ignores malformed or non-schedule events', () => {
    const malformed = { ...answer('bad', 1, true), kind: 'REVIEW_SCHEDULED', payload: '{}' };
    expect(persistedReviewSchedules([answer('answer', 0, true), malformed])).toEqual([]);
  });
});
