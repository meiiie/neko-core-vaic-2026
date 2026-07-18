import { practiceQuestionsForKc, type PracticeQuestion } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { canonicalHeroItemId } from './hero-tutor';

export type PracticeSelectionPhase = 'GUIDED_PRACTICE' | 'POST_CHECK';

/** Select the least-attempted authored question across direct and bank IDs. */
export function nextPracticeQuestion(
  kcId: string,
  records: readonly LearnerEventRecord[],
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
  return [...questions].sort(
    (left, right) =>
      (attempts.get(left.itemId) ?? 0) - (attempts.get(right.itemId) ?? 0) ||
      left.itemId.localeCompare(right.itemId),
  )[0];
}

/**
 * The demo slice authors two distinct numeric templates per KC: item 1 is
 * guided practice; item 2 is the independent post-check. Keeping selection
 * explicit prevents a hinted attempt from completing a plan step.
 */
export function practiceQuestionForPhase(
  kcId: string,
  phase: PracticeSelectionPhase,
): PracticeQuestion | undefined {
  const suffix = phase === 'GUIDED_PRACTICE' ? '-CHECK-1' : '-CHECK-2';
  return practiceQuestionsForKc(kcId).find((question) => question.itemId.endsWith(suffix));
}
