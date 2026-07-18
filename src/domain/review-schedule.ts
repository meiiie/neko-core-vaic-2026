export const REVIEW_SCHEDULE_VERSION = 'review-schedule-v1' as const;
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export type ReviewScheduleReason = 'REMEDIATE_SOON' | 'RECOVERY_CHECK' | 'SPACED_REVIEW';

export interface ReviewSchedulePayload {
  readonly version: typeof REVIEW_SCHEDULE_VERSION;
  readonly kcId: string;
  readonly sourceEventId: string;
  readonly dueAt: string;
  readonly intervalDays: (typeof REVIEW_INTERVAL_DAYS)[number];
  readonly reason: ReviewScheduleReason;
}

function addUtcDays(occurredAt: string, days: number): string {
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid answer occurredAt');
  return new Date(timestamp + days * 24 * 60 * 60 * 1_000).toISOString();
}

function nextCorrectInterval(
  previousIntervalDays: ReviewSchedulePayload['intervalDays'] | undefined,
): ReviewSchedulePayload['intervalDays'] {
  if (previousIntervalDays === undefined || previousIntervalDays === 1) return 3;
  if (previousIntervalDays === 3) return 7;
  if (previousIntervalDays === 7) return 14;
  return 30;
}

/** Pure, versioned spaced-review policy. No wall clock or learner label is read. */
export function buildReviewSchedulePayload(input: {
  readonly kcId: string;
  readonly sourceEventId: string;
  readonly occurredAt: string;
  readonly correct: boolean;
  readonly previousIntervalDays?: ReviewSchedulePayload['intervalDays'];
}): ReviewSchedulePayload {
  const intervalDays = input.correct ? nextCorrectInterval(input.previousIntervalDays) : 1;
  const reason: ReviewScheduleReason = input.correct
    ? input.previousIntervalDays === undefined || input.previousIntervalDays === 1
      ? 'RECOVERY_CHECK'
      : 'SPACED_REVIEW'
    : 'REMEDIATE_SOON';
  return {
    version: REVIEW_SCHEDULE_VERSION,
    kcId: input.kcId,
    sourceEventId: input.sourceEventId,
    dueAt: addUtcDays(input.occurredAt, intervalDays),
    intervalDays,
    reason,
  };
}

export function reviewScheduleEventId(sourceEventId: string): string {
  if (!sourceEventId) throw new Error('Review schedule requires a source event ID');
  return `review-${sourceEventId}`;
}
