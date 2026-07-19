import { practiceQuestionsForKc, type PracticeQuestion } from '../../content';
import type { LearnerEventRecord } from '../../storage/db';
import { canonicalPracticeItemId } from './hero-tutor';

export type PracticeSelectionPhase = 'GUIDED_PRACTICE' | 'POST_CHECK';

/**
 * Guided practice uses an anti-guessing completion rule that scales with the
 * size of the authored question pool for the KC. The two-mode design follows
 * established mastery-learning practice:
 *
 * - Small pool (`< GUIDED_ACCURACY_MIN_POOL`): the learner must answer
 *   correctly CONSECUTIVELY a number of times equal to the pool size. A single
 *   wrong answer resets the streak, so a lucky guess cannot satisfy the gate.
 *   (Khan Academy requires ~5 correct in a row to clear a skill; for a 1–2
 *   item pool we require all of them consecutively.)
 * - Larger pool (`>= GUIDED_ACCURACY_MIN_POOL`): the learner must meet BOTH
 *   (a) an ACCURACY gate — at least `GUIDED_ACCURACY_THRESHOLD` of the distinct
 *   questions answered correctly (Bloom's mastery criterion ≈ 80%), AND
 *   (b) a FINAL STREAK — the last `GUIDED_FINAL_STREAK_REQUIRED` answers must
 *   be correct in a row (IXL's "challenge zone" requires a correct run near
 *   the end). Accuracy alone allows early mistakes to be masked by later
 *   guesses; the final streak confirms the skill is currently held.
 *
 * Both modes are pure and deterministic over the canonical event records.
 */
export const GUIDED_ACCURACY_THRESHOLD = 0.8;
export const GUIDED_ACCURACY_MIN_POOL = 3;
export const GUIDED_FINAL_STREAK_REQUIRED = 2;

/**
 * After this many consecutive wrong guided answers, send the learner back to
 * EXPLAIN (review the summary) instead of letting them keep guessing.
 */
export const GUIDED_MAX_CONSECUTIVE_WRONG = 3;

interface ActivityPayload {
  readonly correct?: boolean;
  readonly kcId?: string;
}

function parseActivity(record: LearnerEventRecord): ActivityPayload {
  try {
    const parsed: unknown = JSON.parse(record.payload);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return {
      ...('correct' in parsed && typeof parsed.correct === 'boolean'
        ? { correct: parsed.correct }
        : {}),
      ...('kcId' in parsed && typeof parsed.kcId === 'string' ? { kcId: parsed.kcId } : {}),
    };
  } catch {
    return {};
  }
}

function kcIdOfRecord(record: LearnerEventRecord): string | undefined {
  const payloadKcId = parseActivity(record).kcId;
  if (payloadKcId) return payloadKcId;
  return /^(?:bank-)?(K\d{2})-/.exec(record.itemId)?.[1];
}

/** Guided-practice items share the `-CHECK-1` numeric template root. */
function isGuidedItem(itemId: string): boolean {
  return /^K\d{2}-CHECK-1[a-z]*$/.test(itemId);
}

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
    const itemId = canonicalPracticeItemId(record.itemId);
    if (!itemId) continue;
    attempts.set(itemId, (attempts.get(itemId) ?? 0) + 1);
  }
  return [...questions].sort(
    (left, right) =>
      (attempts.get(left.itemId) ?? 0) - (attempts.get(right.itemId) ?? 0) ||
      left.itemId.localeCompare(right.itemId),
  )[0];
}

export type GuidedThresholdMode = 'CONSECUTIVE' | 'ACCURACY';

export interface GuidedThreshold {
  readonly mode: GuidedThresholdMode;
  /** Consecutive-correct count (CONSECUTIVE) or distinct-correct count (ACCURACY). */
  readonly required: number;
  /**
   * In ACCURACY mode, the final streak of consecutive correct answers that must
   * be held in addition to the accuracy count. Always 0 in CONSECUTIVE mode
   * (the streak IS the gate there).
   */
  readonly finalStreakRequired: number;
}

/**
 * Derive the completion threshold from the guided pool size. Exported so tests
 * and the UI can show the same rule the completion logic uses.
 */
export function guidedThresholdForPool(poolSize: number): GuidedThreshold {
  if (poolSize >= GUIDED_ACCURACY_MIN_POOL) {
    return {
      mode: 'ACCURACY',
      required: Math.max(1, Math.ceil(poolSize * GUIDED_ACCURACY_THRESHOLD)),
      finalStreakRequired: GUIDED_FINAL_STREAK_REQUIRED,
    };
  }
  return { mode: 'CONSECUTIVE', required: Math.max(1, poolSize), finalStreakRequired: 0 };
}

export interface GuidedStreakState {
  readonly poolSize: number;
  readonly threshold: GuidedThreshold;
  /** Current run of consecutive correct guided answers for this KC. */
  readonly consecutiveCorrect: number;
  /** Current run of consecutive wrong guided answers for this KC. */
  readonly consecutiveWrong: number;
  /** Distinct guided items ever answered correctly (for ACCURACY mode). */
  readonly distinctCorrectCount: number;
  /** True when the threshold is met and the post-check should unlock. */
  readonly readyForPostCheck: boolean;
  /**
   * True when the learner has answered wrong too many times in a row. This is a
   * NON-BLOCKING UI signal — the UI shows a "review the summary" nudge but the
   * learner can keep practising. The phase never reverts to EXPLAIN on this.
   */
  readonly needsReviewNudge: boolean;
}

/**
 * Compute the guided-practice completion state for a KC from its canonical
 * event records. Pure and deterministic: same records → same state.
 *
 * Walks PRACTICE_ANSWER and RESOURCE_VIEWED records for this KC in sequence
 * order. A correct answer increments the correct streak and records the item as
 * distinct-correct; a wrong answer increments the wrong streak and resets the
 * correct streak. A RESOURCE_VIEWED (the learner revisited the summary) resets
 * the wrong streak — so a learner sent back to EXPLAIN is not stuck after
 * reviewing. Once the threshold is reached, `readyForPostCheck` stays sticky so
 * a later wrong answer cannot drop the learner back into guided practice.
 */
export function guidedStreakState(
  kcId: string,
  records: readonly LearnerEventRecord[],
): GuidedStreakState {
  const poolSize = practiceQuestionsForKc(kcId).filter((question) =>
    isGuidedItem(question.itemId),
  ).length;
  const threshold = guidedThresholdForPool(poolSize);

  const relevant = records
    .filter(
      (record) =>
        (record.kind === 'PRACTICE_ANSWER' || record.kind === 'RESOURCE_VIEWED') &&
        kcIdOfRecord(record) === kcId,
    )
    .slice()
    .sort((a, b) => a.sequence - b.sequence);

  let consecutiveCorrect = 0;
  let consecutiveWrong = 0;
  let reachedThreshold = false;
  const distinctCorrect = new Set<string>();
  for (const record of relevant) {
    if (record.kind === 'RESOURCE_VIEWED') {
      consecutiveWrong = 0;
      continue;
    }
    const canonical = canonicalPracticeItemId(record.itemId) ?? record.itemId;
    if (parseActivity(record).correct === true) {
      consecutiveCorrect += 1;
      consecutiveWrong = 0;
      distinctCorrect.add(canonical);
    } else {
      consecutiveWrong += 1;
      consecutiveCorrect = 0;
    }
    const met =
      threshold.mode === 'CONSECUTIVE'
        ? consecutiveCorrect >= threshold.required
        : distinctCorrect.size >= threshold.required &&
          consecutiveCorrect >= threshold.finalStreakRequired;
    if (met) reachedThreshold = true;
  }
  return {
    poolSize,
    threshold,
    consecutiveCorrect,
    consecutiveWrong,
    distinctCorrectCount: distinctCorrect.size,
    readyForPostCheck: reachedThreshold,
    needsReviewNudge: consecutiveWrong >= GUIDED_MAX_CONSECUTIVE_WRONG && !reachedThreshold,
  };
}

/**
 * The demo slice authors two distinct numeric templates per KC: the guided
 * practice family (`-CHECK-1`, `-CHECK-1b`, …) and the independent post-check
 * (`-CHECK-2`). Keeping the post-check on a separate template prevents a hinted
 * attempt from completing a plan step.
 *
 * For GUIDED_PRACTICE we rotate over the whole guided pool, preferring items
 * the learner has NOT yet answered correctly and, among the rest, the least
 * attempted — so repeated guesses meet different numeric instances instead of
 * memorizing one answer.
 */
export function practiceQuestionForPhase(
  kcId: string,
  phase: PracticeSelectionPhase,
  records: readonly LearnerEventRecord[] = [],
): PracticeQuestion | undefined {
  if (phase === 'POST_CHECK') {
    return practiceQuestionsForKc(kcId).find((question) =>
      question.itemId.endsWith('-CHECK-2'),
    );
  }
  const guided = practiceQuestionsForKc(kcId).filter((question) =>
    isGuidedItem(question.itemId),
  );
  if (guided.length === 0) {
    // Fall back to the original single-item contract for KCs without a pool.
    return practiceQuestionsForKc(kcId).find((question) =>
      question.itemId.endsWith('-CHECK-1'),
    );
  }
  if (guided.length === 1) return guided[0];

  const correctItems = new Set<string>();
  const attempts = new Map<string, number>();
  for (const record of records) {
    if (record.kind === 'REVIEW_SCHEDULED') continue;
    const itemId = canonicalPracticeItemId(record.itemId);
    if (!itemId) continue;
    attempts.set(itemId, (attempts.get(itemId) ?? 0) + 1);
    if (record.kind === 'PRACTICE_ANSWER' && parseActivity(record).correct === true) {
      correctItems.add(itemId);
    }
  }
  // Prefer items not yet answered correctly; tie-break by least attempts, then itemId.
  return [...guided].sort((left, right) => {
    const leftMastered = correctItems.has(left.itemId) ? 1 : 0;
    const rightMastered = correctItems.has(right.itemId) ? 1 : 0;
    if (leftMastered !== rightMastered) return leftMastered - rightMastered;
    const leftAttempts = attempts.get(left.itemId) ?? 0;
    const rightAttempts = attempts.get(right.itemId) ?? 0;
    return leftAttempts - rightAttempts || left.itemId.localeCompare(right.itemId);
  })[0];
}
