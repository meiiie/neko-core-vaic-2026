import { describe, expect, it } from 'vitest';
import { buildReviewSchedulePayload, reviewScheduleEventId } from './review-schedule';

describe('versioned review schedule policy', () => {
  it('schedules a wrong answer for remediation the next day', () => {
    expect(
      buildReviewSchedulePayload({
        kcId: 'K02',
        sourceEventId: 'answer-1',
        occurredAt: '2026-07-18T08:00:00.000Z',
        correct: false,
      }),
    ).toEqual({
      version: 'review-schedule-v1',
      kcId: 'K02',
      sourceEventId: 'answer-1',
      dueAt: '2026-07-19T08:00:00.000Z',
      intervalDays: 1,
      reason: 'REMEDIATE_SOON',
    });
  });

  it('advances correct reviews through the bounded 3-7-14-30 day ladder', () => {
    const intervals = [undefined, 3, 7, 14, 30] as const;
    expect(
      intervals.map(
        (previousIntervalDays) =>
          buildReviewSchedulePayload({
            kcId: 'K02',
            sourceEventId: 'answer',
            occurredAt: '2026-07-18T08:00:00.000Z',
            correct: true,
            ...(previousIntervalDays ? { previousIntervalDays } : {}),
          }).intervalDays,
      ),
    ).toEqual([3, 7, 14, 30, 30]);
  });

  it('derives an idempotent schedule ID from its persisted answer', () => {
    expect(reviewScheduleEventId('answer-1')).toBe('review-answer-1');
  });
});
