import { HERO_ITEMS, PRACTICE_QUESTIONS, type HeroQuestion } from '../../content';
import type { DiagnosisResult, LearnerEvent } from '../../domain';
import type { LearnerEventRecord } from '../../storage/db';
import { persistedReviewSchedules } from '../../storage/review-schedule-repository';
import {
  canonicalHeroItemId,
  questionForItem,
  studentDomainEvents,
  type StudentDiagnosisContext,
} from './hero-tutor';

export type ReviewReason =
  'CURRENT_GAP' | 'RECOVERY_CHECK' | 'SPACED_REVIEW' | 'REMEDIATE_SOON' | 'GATHER_EVIDENCE';

export interface ReviewRecommendation {
  readonly kcId: string;
  readonly question: HeroQuestion;
  readonly reason: ReviewReason;
  readonly dueAt?: string;
  readonly intervalDays?: number;
  readonly isDue: boolean;
}

function itemKcId(itemId: string): string | undefined {
  const canonicalItemId = canonicalHeroItemId(itemId);
  return HERO_ITEMS.find((item) => item.id === canonicalItemId)?.kcIds[0];
}

function leastAttemptedQuestion(
  kcId: string,
  events: readonly LearnerEvent[],
): HeroQuestion | undefined {
  const attempts = new Map<string, number>();
  for (const event of events) {
    const itemId = canonicalHeroItemId(event.itemId);
    if (itemId) attempts.set(itemId, (attempts.get(itemId) ?? 0) + 1);
  }
  const selected = [...PRACTICE_QUESTIONS]
    .filter((question) => question.kcId === kcId)
    .sort(
      (left, right) =>
        (attempts.get(left.itemId) ?? 0) - (attempts.get(right.itemId) ?? 0) ||
        left.itemId.localeCompare(right.itemId),
    )[0];
  return selected ? questionForItem(selected.itemId) : undefined;
}

function directRecommendation(
  kcId: string | undefined,
  reason: 'CURRENT_GAP' | 'GATHER_EVIDENCE',
  events: readonly LearnerEvent[],
): ReviewRecommendation | undefined {
  if (!kcId) return undefined;
  const question = leastAttemptedQuestion(kcId, events);
  return question ? { kcId, question, reason, isDue: true } : undefined;
}

/**
 * Select the next review only from diagnosis or persisted REVIEW_SCHEDULED
 * events. `asOf` is explicit so tests and callers can reproduce due-state.
 */
export function reviewRecommendation(
  context: StudentDiagnosisContext,
  result: DiagnosisResult,
  records: readonly LearnerEventRecord[],
  asOf: string,
): ReviewRecommendation | undefined {
  const events = studentDomainEvents(context, records);
  if (result.status === 'DIAGNOSED') {
    return directRecommendation(result.rootKcId, 'CURRENT_GAP', events);
  }
  if (result.status === 'NEEDS_MORE_EVIDENCE') {
    return directRecommendation(result.competingKcIds[0], 'GATHER_EVIDENCE', events);
  }
  if (result.status !== 'FAST_PATH') return undefined;

  const latestByKc = new Map<string, ReturnType<typeof persistedReviewSchedules>[number]>();
  for (const schedule of persistedReviewSchedules(records)) {
    latestByKc.set(schedule.payload.kcId, schedule);
  }
  const active = [...latestByKc.values()]
    .filter(
      (schedule) =>
        !events.some(
          (event) =>
            event.sequence > schedule.record.sequence &&
            itemKcId(event.itemId) === schedule.payload.kcId,
        ),
    )
    .sort(
      (left, right) =>
        Number(left.payload.dueAt > asOf) - Number(right.payload.dueAt > asOf) ||
        left.payload.dueAt.localeCompare(right.payload.dueAt) ||
        left.payload.kcId.localeCompare(right.payload.kcId),
    )[0];
  if (!active) return undefined;
  const question = leastAttemptedQuestion(active.payload.kcId, events);
  if (!question) return undefined;
  return {
    kcId: active.payload.kcId,
    question,
    reason:
      active.payload.reason === 'RECOVERY_CHECK'
        ? 'RECOVERY_CHECK'
        : active.payload.reason === 'SPACED_REVIEW'
          ? 'SPACED_REVIEW'
          : 'REMEDIATE_SOON',
    dueAt: active.payload.dueAt,
    intervalDays: active.payload.intervalDays,
    isDue: active.payload.dueAt <= asOf,
  };
}

export const REVIEW_REASON_LABELS: Readonly<Record<ReviewReason, string>> = {
  CURRENT_GAP: 'Tiếp tục lấp lỗ hổng đang cản mục tiêu hiện tại',
  RECOVERY_CHECK: 'Kiểm tra lại phần từng sai sau một khoảng phục hồi',
  SPACED_REVIEW: 'Ôn giãn cách theo lịch đã lưu từ lần học trước',
  REMEDIATE_SOON: 'Quay lại sớm phần vừa trả lời sai',
  GATHER_EVIDENCE: 'Thu thêm bằng chứng để phân biệt nguyên nhân gốc',
};
