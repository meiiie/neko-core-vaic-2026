import { HERO_ITEMS, PRACTICE_QUESTIONS, type HeroQuestion } from '../../content';
import type { DiagnosisResult, LearnerEvent } from '../../domain';
import type { LearnerEventRecord } from '../../storage/db';
import {
  canonicalHeroItemId,
  questionForItem,
  studentDomainEvents,
  type StudentDiagnosisContext,
} from './hero-tutor';

export type ReviewReason =
  | 'CURRENT_GAP'
  | 'RECOVERED_WEAKNESS'
  | 'SPACED_REVIEW'
  | 'HISTORIC_WEAKNESS'
  | 'GATHER_EVIDENCE'
  | 'TRANSFER_MAINTENANCE';

export interface ReviewRecommendation {
  readonly kcId: string;
  readonly question: HeroQuestion;
  readonly reason: ReviewReason;
  readonly wrongCount: number;
  /** Deterministic recency: number of later evidence events, not wall-clock time. */
  readonly evidenceStepsSinceLastAttempt: number;
}

interface KcHistory {
  readonly kcId: string;
  readonly events: readonly LearnerEvent[];
  readonly wrongCount: number;
  readonly recovered: boolean;
  readonly evidenceStepsSinceLastAttempt: number;
}

const REVIEW_SPACING_STEPS = 4;

function histories(events: readonly LearnerEvent[]): KcHistory[] {
  const itemKc = new Map(HERO_ITEMS.map((item) => [item.id, item.kcIds[0]]));
  const byKc = new Map<string, { event: LearnerEvent; eventIndex: number }[]>();
  events.forEach((event, eventIndex) => {
    const kcId = itemKc.get(event.itemId);
    if (!kcId) return;
    const bucket = byKc.get(kcId) ?? [];
    bucket.push({ event, eventIndex });
    byKc.set(kcId, bucket);
  });
  return [...byKc.entries()].map(([kcId, entries]) => {
    const kcEvents = entries.map((entry) => entry.event);
    const wrongCount = kcEvents.filter((event) => !event.correct).length;
    const recent = kcEvents.slice(-2);
    return {
      kcId,
      events: kcEvents,
      wrongCount,
      recovered: wrongCount > 0 && recent.length === 2 && recent.every((event) => event.correct),
      evidenceStepsSinceLastAttempt:
        events.length - 1 - (entries.at(-1)?.eventIndex ?? events.length - 1),
    };
  });
}

function reasonFor(
  result: DiagnosisResult,
  history: KcHistory,
): { reason: ReviewReason; band: number } {
  if (result.status === 'DIAGNOSED' && result.rootKcId === history.kcId) {
    return { reason: 'CURRENT_GAP', band: 0 };
  }
  if (result.status === 'NEEDS_MORE_EVIDENCE' && result.competingKcIds.includes(history.kcId)) {
    return { reason: 'GATHER_EVIDENCE', band: 0 };
  }
  if (history.recovered) return { reason: 'RECOVERED_WEAKNESS', band: 1 };
  if (history.evidenceStepsSinceLastAttempt >= REVIEW_SPACING_STEPS) {
    return { reason: 'SPACED_REVIEW', band: 2 };
  }
  if (history.wrongCount > 0) return { reason: 'HISTORIC_WEAKNESS', band: 3 };
  return { reason: 'TRANSFER_MAINTENANCE', band: 4 };
}

/**
 * Select the next review from evidence only. It never changes diagnosis or
 * mastery and uses event distance instead of the wall clock, preserving the
 * same-event-log determinism contract.
 */
export function reviewRecommendation(
  context: StudentDiagnosisContext,
  result: DiagnosisResult,
  records: readonly LearnerEventRecord[],
): ReviewRecommendation | undefined {
  const events = studentDomainEvents(context, records);
  const candidateKcIds =
    result.status === 'DIAGNOSED' && result.rootKcId
      ? [result.rootKcId, ...result.pathKcIds]
      : result.status === 'NEEDS_MORE_EVIDENCE'
        ? [...result.competingKcIds]
        : [];
  const allHistories = histories(events);
  const historyByKc = new Map(allHistories.map((history) => [history.kcId, history]));
  for (const kcId of candidateKcIds) {
    if (!historyByKc.has(kcId)) {
      historyByKc.set(kcId, {
        kcId,
        events: [],
        wrongCount: 0,
        recovered: false,
        evidenceStepsSinceLastAttempt: events.length,
      });
    }
  }
  if (result.status === 'FAST_PATH' && !historyByKc.has(result.targetKcId)) {
    historyByKc.set(result.targetKcId, {
      kcId: result.targetKcId,
      events: [],
      wrongCount: 0,
      recovered: false,
      evidenceStepsSinceLastAttempt: events.length,
    });
  }

  const ranked = [...historyByKc.values()]
    .filter((history) => PRACTICE_QUESTIONS.some((question) => question.kcId === history.kcId))
    .map((history) => ({ history, ...reasonFor(result, history) }))
    .sort(
      (left, right) =>
        left.band - right.band ||
        right.history.wrongCount - left.history.wrongCount ||
        right.history.evidenceStepsSinceLastAttempt - left.history.evidenceStepsSinceLastAttempt ||
        left.history.kcId.localeCompare(right.history.kcId),
    );
  const selected = ranked[0];
  if (!selected) return undefined;

  const attempts = new Map<string, number>();
  for (const event of events) {
    const itemId = canonicalHeroItemId(event.itemId);
    if (itemId) attempts.set(itemId, (attempts.get(itemId) ?? 0) + 1);
  }
  const question = [...PRACTICE_QUESTIONS]
    .filter((candidate) => candidate.kcId === selected.history.kcId)
    .sort(
      (left, right) =>
        (attempts.get(left.itemId) ?? 0) - (attempts.get(right.itemId) ?? 0) ||
        left.itemId.localeCompare(right.itemId),
    )[0];
  const normalizedQuestion = question ? questionForItem(question.itemId) : undefined;
  if (!normalizedQuestion) return undefined;
  return {
    kcId: selected.history.kcId,
    question: normalizedQuestion,
    reason: selected.reason,
    wrongCount: selected.history.wrongCount,
    evidenceStepsSinceLastAttempt: selected.history.evidenceStepsSinceLastAttempt,
  };
}

export const REVIEW_REASON_LABELS: Readonly<Record<ReviewReason, string>> = {
  CURRENT_GAP: 'Tiếp tục lấp lỗ hổng đang cản mục tiêu hiện tại',
  RECOVERED_WEAKNESS: 'Kiểm tra lại phần từng sai nhiều nhưng gần đây đã cải thiện',
  SPACED_REVIEW: 'Ôn lại phần đã qua nhiều hoạt động chưa gặp lại',
  HISTORIC_WEAKNESS: 'Củng cố phần có nhiều lần trả lời sai trong lịch sử',
  GATHER_EVIDENCE: 'Thu thêm bằng chứng để phân biệt nguyên nhân gốc',
  TRANSFER_MAINTENANCE: 'Duy trì kiến thức đã vững bằng một câu kiểm tra ngắn',
};
