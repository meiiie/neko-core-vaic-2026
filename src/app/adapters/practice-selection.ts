import { practiceQuestionsForKc, type PracticeQuestion } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { canonicalHeroItemId } from './hero-tutor';

/** Select the least-attempted authored question across direct and bank IDs. */
export function nextPracticeQuestion(
  kcId: string,
  records: readonly LearnerEventRecord[],
): PracticeQuestion | undefined {
  const questions = practiceQuestionsForKc(kcId);
  if (questions.length === 0) return undefined;
  const attempts = new Map<string, number>();
  for (const record of records) {
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
