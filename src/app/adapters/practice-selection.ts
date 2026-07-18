import { practiceQuestionsForKc, type PracticeQuestion } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { canonicalHeroItemId, toDomainEvents } from './hero-tutor';

export interface PracticeSelectionOptions {
  readonly allowRepeat?: boolean;
}

/** Select a distinct unanswered check before offering any explicit review repeat. */
export function nextPracticeQuestion(
  kcId: string,
  records: readonly LearnerEventRecord[],
  options: PracticeSelectionOptions = {},
): PracticeQuestion | undefined {
  const questions = practiceQuestionsForKc(kcId);
  if (questions.length === 0) return undefined;
  const attempts = new Map<string, number>();
  for (const record of records) {
    if (record.kind === 'REVIEW_SCHEDULED') continue;
    const itemId = canonicalHeroItemId(record.itemId);
    if (!itemId) continue;
    attempts.set(itemId, (attempts.get(itemId) ?? 0) + 1);
  }
  const correctlyAnswered = new Set(
    toDomainEvents(records)
      .filter((event) => event.correct && event.methodValidity !== 'INVALID')
      .map((event) => event.itemId),
  );
  const candidates = options.allowRepeat
    ? questions
    : questions.filter((question) => !correctlyAnswered.has(question.itemId));
  return [...candidates].sort(
    (left, right) =>
      (attempts.get(left.itemId) ?? 0) - (attempts.get(right.itemId) ?? 0) ||
      left.itemId.localeCompare(right.itemId),
  )[0];
}
