import { describe, expect, it } from 'vitest';
import type { LearnerEventRecord } from '../../storage/db';
import {
  GUIDED_ACCURACY_THRESHOLD,
  GUIDED_FINAL_STREAK_REQUIRED,
  GUIDED_MAX_CONSECUTIVE_WRONG,
  guidedStreakState,
  guidedThresholdForPool,
  nextPracticeQuestion,
  practiceQuestionForPhase,
} from './practice-selection';

function record(itemId: string, id = itemId): LearnerEventRecord {
  return {
    id,
    learnerId: 'user-student-an',
    itemId,
    sequence: 8,
    occurredAt: '2026-07-18T08:00:00.000Z',
    kind: 'ANSWER',
    payload: '{"choiceId":"a","correct":true}',
  };
}

function practiceRecord(
  itemId: string,
  seq: number,
  correct: boolean,
  id = `p-${itemId}-${seq}`,
): LearnerEventRecord {
  return {
    id,
    learnerId: 'user-student-an',
    itemId,
    sequence: seq,
    occurredAt: '2026-07-18T08:00:00.000Z',
    kind: 'PRACTICE_ANSWER',
    payload: JSON.stringify({ choiceId: 'a', correct, kcId: 'K02' }),
  };
}

function resourceViewed(seq: number): LearnerEventRecord {
  return {
    id: `view-${seq}`,
    learnerId: 'user-student-an',
    itemId: 'text:K02',
    sequence: seq,
    occurredAt: '2026-07-18T08:00:00.000Z',
    kind: 'RESOURCE_VIEWED',
    payload: JSON.stringify({ kcId: 'K02' }),
  };
}

describe('adaptive practice selection', () => {
  it('keeps guided practice and the independent post-check on distinct items', () => {
    expect(practiceQuestionForPhase('K02', 'GUIDED_PRACTICE')?.itemId).toBe('K02-CHECK-1');
    expect(practiceQuestionForPhase('K02', 'POST_CHECK')?.itemId).toBe('K02-CHECK-2');
  });
  it('starts with the first deterministic question when there are no attempts', () => {
    expect(nextPracticeQuestion('K02', [])?.itemId).toBe('K02-CHECK-1');
  });

  it('counts an assigned bank answer as an attempt of its canonical item', () => {
    // After K02-CHECK-1 has been attempted (via a bank assignment), the
    // least-attempted item is the unattempted K02-CHECK-1b variant.
    expect(nextPracticeQuestion('K02', [record('bank-K02-CHECK-1')])?.itemId).toBe('K02-CHECK-1b');
  });

  it('combines direct and bank attempts before choosing the least-practised item', () => {
    expect(
      nextPracticeQuestion('K02', [
        record('K02-CHECK-1', 'direct-1'),
        record('bank-K02-CHECK-1', 'assigned-1'),
        record('K02-CHECK-2', 'direct-2'),
      ])?.itemId,
    ).toBe('K02-CHECK-1b');
  });

  it('does not count a persisted review schedule as another learner attempt', () => {
    expect(
      nextPracticeQuestion('K02', [
        record('K02-CHECK-1', 'answer-1'),
        { ...record('K02-CHECK-1', 'review-answer-1'), kind: 'REVIEW_SCHEDULED', sequence: 9 },
      ])?.itemId,
    ).toBe('K02-CHECK-1b');
  });
});

describe('guided pool rotation (anti-memorization)', () => {
  it('offers the unmastered variant after the first guided item is correct', () => {
    // K02 pool: K02-CHECK-1, K02-CHECK-1b, K02-CHECK-2
    expect(practiceQuestionForPhase('K02', 'GUIDED_PRACTICE', [])?.itemId).toBe('K02-CHECK-1');
    const afterFirstCorrect = practiceQuestionForPhase('K02', 'GUIDED_PRACTICE', [
      practiceRecord('K02-CHECK-1', 1, true),
    ]);
    expect(afterFirstCorrect?.itemId).toBe('K02-CHECK-1b');
  });

  it('keeps the post-check item off the guided rotation even when mastered', () => {
    const guided = practiceQuestionForPhase('K02', 'GUIDED_PRACTICE', [
      practiceRecord('K02-CHECK-1', 1, true),
      practiceRecord('K02-CHECK-1b', 2, true),
    ]);
    // K02 pool: CHECK-1, CHECK-1b, CHECK-1c (guided) + CHECK-2 (post-check).
    // After two variants are mastered, the rotation must pick the remaining
    // guided variant, never the post-check.
    expect(['K02-CHECK-1', 'K02-CHECK-1b', 'K02-CHECK-1c']).toContain(guided?.itemId);
    expect(guided?.itemId).not.toBe('K02-CHECK-2');
  });
});

describe('guidedThresholdForPool', () => {
  it('requires a perfect consecutive run for pools smaller than the accuracy cutoff', () => {
    expect(guidedThresholdForPool(1)).toEqual({
      mode: 'CONSECUTIVE',
      required: 1,
      finalStreakRequired: 0,
    });
    expect(guidedThresholdForPool(2)).toEqual({
      mode: 'CONSECUTIVE',
      required: 2,
      finalStreakRequired: 0,
    });
  });

  it('relaxes to ~80% distinct-correct accuracy plus a final streak once the pool is large enough', () => {
    expect(guidedThresholdForPool(3)).toEqual({
      mode: 'ACCURACY',
      required: Math.ceil(3 * GUIDED_ACCURACY_THRESHOLD),
      finalStreakRequired: GUIDED_FINAL_STREAK_REQUIRED,
    });
    expect(guidedThresholdForPool(5)).toEqual({
      mode: 'ACCURACY',
      required: Math.ceil(5 * GUIDED_ACCURACY_THRESHOLD),
      finalStreakRequired: GUIDED_FINAL_STREAK_REQUIRED,
    });
  });
});

describe('guidedStreakState (K02 — 3-item pool, ACCURACY mode)', () => {
  // Pool of 3 (CHECK-1, -1b, -1c) → accuracy required = ceil(3 * 0.8) = 3
  // distinct-correct AND a final streak of 2 consecutive correct.
  it('reports the accuracy-plus-final-streak threshold for a 3-item pool', () => {
    const state = guidedStreakState('K02', []);
    expect(state.poolSize).toBe(3);
    expect(state.threshold).toEqual({
      mode: 'ACCURACY',
      required: 3,
      finalStreakRequired: GUIDED_FINAL_STREAK_REQUIRED,
    });
  });

  it('does not unlock after two correct answers when the final streak is not held', () => {
    // correct, wrong, correct, correct: distinct=2, final streak=2 but accuracy
    // count (distinct) is only 2 < 3.
    const state = guidedStreakState('K02', [
      resourceViewed(1),
      practiceRecord('K02-CHECK-1', 2, true),
      practiceRecord('K02-CHECK-1b', 3, false),
      practiceRecord('K02-CHECK-1c', 4, true),
      practiceRecord('K02-CHECK-1', 5, true),
    ]);
    expect(state.distinctCorrectCount).toBe(2);
    expect(state.consecutiveCorrect).toBe(2);
    expect(state.readyForPostCheck).toBe(false);
  });

  it('unlocks when all three distinct items are correct AND the last two are in a row', () => {
    const state = guidedStreakState('K02', [
      resourceViewed(1),
      practiceRecord('K02-CHECK-1', 2, true),
      practiceRecord('K02-CHECK-1b', 3, false),
      practiceRecord('K02-CHECK-1b', 4, true),
      practiceRecord('K02-CHECK-1c', 5, true),
    ]);
    expect(state.distinctCorrectCount).toBe(3);
    expect(state.consecutiveCorrect).toBe(2);
    expect(state.readyForPostCheck).toBe(true);
  });

  it('unlocks as soon as both accuracy and the final streak are simultaneously met', () => {
    // Three distinct correct in a row at records 2–4 simultaneously satisfies
    // accuracy (3 distinct) and the final streak (3 >= 2). A later wrong answer
    // does not revoke the unlock (sticky), because the skill was demonstrated.
    const state = guidedStreakState('K02', [
      resourceViewed(1),
      practiceRecord('K02-CHECK-1', 2, true),
      practiceRecord('K02-CHECK-1b', 3, true),
      practiceRecord('K02-CHECK-1c', 4, true),
      practiceRecord('K02-CHECK-1', 5, false),
    ]);
    expect(state.distinctCorrectCount).toBe(3);
    expect(state.readyForPostCheck).toBe(true);
  });

  it('keeps readyForPostCheck sticky once the threshold is met', () => {
    const state = guidedStreakState('K02', [
      resourceViewed(1),
      practiceRecord('K02-CHECK-1', 2, true),
      practiceRecord('K02-CHECK-1b', 3, true),
      practiceRecord('K02-CHECK-1c', 4, true),
      practiceRecord('K02-CHECK-1', 5, false),
    ]);
    expect(state.readyForPostCheck).toBe(true);
  });

  it('raises a non-blocking review nudge after too many consecutive wrong answers', () => {
    const wrongs = Array.from({ length: GUIDED_MAX_CONSECUTIVE_WRONG }, (_, i) =>
      practiceRecord(`K02-CHECK-1${['', 'b', 'c'][i % 3]}`, 2 + i, false),
    );
    const state = guidedStreakState('K02', [resourceViewed(1), ...wrongs]);
    expect(state.consecutiveWrong).toBe(GUIDED_MAX_CONSECUTIVE_WRONG);
    expect(state.needsReviewNudge).toBe(true);
  });

  it('clears the wrong streak when the learner revisits the summary', () => {
    const state = guidedStreakState('K02', [
      resourceViewed(1),
      practiceRecord('K02-CHECK-1', 2, false),
      practiceRecord('K02-CHECK-1b', 3, false),
      practiceRecord('K02-CHECK-1c', 4, false),
      resourceViewed(5),
    ]);
    expect(state.consecutiveWrong).toBe(0);
    expect(state.needsReviewNudge).toBe(false);
  });
});
