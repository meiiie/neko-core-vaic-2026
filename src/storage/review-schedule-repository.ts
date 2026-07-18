import { z } from 'zod';
import {
  buildReviewSchedulePayload,
  REVIEW_INTERVAL_DAYS,
  REVIEW_SCHEDULE_VERSION,
  reviewScheduleEventId,
  type ReviewSchedulePayload,
} from '../domain';
import type { LearnerEventRecord } from './db';

export const reviewSchedulePayloadSchema = z.object({
  version: z.literal(REVIEW_SCHEDULE_VERSION),
  kcId: z.string().min(1),
  sourceEventId: z.string().min(1),
  dueAt: z.string().datetime(),
  intervalDays: z.union([
    z.literal(REVIEW_INTERVAL_DAYS[0]),
    z.literal(REVIEW_INTERVAL_DAYS[1]),
    z.literal(REVIEW_INTERVAL_DAYS[2]),
    z.literal(REVIEW_INTERVAL_DAYS[3]),
    z.literal(REVIEW_INTERVAL_DAYS[4]),
  ]),
  reason: z.enum(['REMEDIATE_SOON', 'RECOVERY_CHECK', 'SPACED_REVIEW']),
});

const answerPayloadSchema = z.object({ correct: z.boolean() });

export interface PersistedReviewSchedule {
  readonly record: LearnerEventRecord;
  readonly payload: ReviewSchedulePayload;
}

export function parseReviewScheduleRecord(
  record: LearnerEventRecord,
): PersistedReviewSchedule | null {
  if (record.kind !== 'REVIEW_SCHEDULED') return null;
  try {
    const payload = reviewSchedulePayloadSchema.safeParse(JSON.parse(record.payload));
    return payload.success ? { record, payload: payload.data } : null;
  } catch {
    return null;
  }
}

export function persistedReviewSchedules(
  records: readonly LearnerEventRecord[],
): PersistedReviewSchedule[] {
  return records
    .map(parseReviewScheduleRecord)
    .filter((schedule): schedule is PersistedReviewSchedule => schedule !== null)
    .sort(
      (left, right) =>
        left.record.sequence - right.record.sequence ||
        left.record.occurredAt.localeCompare(right.record.occurredAt) ||
        left.record.id.localeCompare(right.record.id),
    );
}

export function buildReviewScheduleRecord(
  answer: LearnerEventRecord,
  kcId: string,
  existingRecords: readonly LearnerEventRecord[],
): LearnerEventRecord {
  let correct: boolean;
  try {
    correct = answerPayloadSchema.parse(JSON.parse(answer.payload)).correct;
  } catch {
    throw new Error('Review schedule requires a valid answer payload');
  }
  const previous = persistedReviewSchedules(existingRecords)
    .filter((schedule) => schedule.payload.kcId === kcId)
    .at(-1);
  const payload = buildReviewSchedulePayload({
    kcId,
    sourceEventId: answer.id,
    occurredAt: answer.occurredAt,
    correct,
    ...(previous ? { previousIntervalDays: previous.payload.intervalDays } : {}),
  });
  return {
    id: reviewScheduleEventId(answer.id),
    learnerId: answer.learnerId,
    itemId: answer.itemId,
    sequence: answer.sequence + 1,
    occurredAt: answer.occurredAt,
    kind: 'REVIEW_SCHEDULED',
    payload: JSON.stringify(payload),
  };
}
