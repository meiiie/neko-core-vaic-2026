import { describe, expect, it } from 'vitest';
import type { LearnerEventRecord } from '../../storage/db';
import { nextPracticeQuestion, practiceQuestionForPhase } from './practice-selection';

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

describe('adaptive practice selection', () => {
  it('keeps guided practice and the independent post-check on distinct items', () => {
    expect(practiceQuestionForPhase('K02', 'GUIDED_PRACTICE')?.itemId).toBe('K02-CHECK-1');
    expect(practiceQuestionForPhase('K02', 'POST_CHECK')?.itemId).toBe('K02-CHECK-2');
  });
  it('starts with the first deterministic question when there are no attempts', () => {
    expect(nextPracticeQuestion('K02', [])?.itemId).toBe('K02-CHECK-1');
  });

  it('counts an assigned bank answer as an attempt of its canonical item', () => {
    expect(nextPracticeQuestion('K02', [record('bank-K02-CHECK-1')])?.itemId).toBe('K02-CHECK-2');
  });

  it('combines direct and bank attempts before choosing the least-practised item', () => {
    expect(
      nextPracticeQuestion('K02', [
        record('K02-CHECK-1', 'direct-1'),
        record('bank-K02-CHECK-1', 'assigned-1'),
        record('K02-CHECK-2', 'direct-2'),
      ])?.itemId,
    ).toBe('K02-CHECK-2');
  });

  it('does not count a persisted review schedule as another learner attempt', () => {
    expect(
      nextPracticeQuestion('K02', [
        record('K02-CHECK-1', 'answer-1'),
        { ...record('K02-CHECK-1', 'review-answer-1'), kind: 'REVIEW_SCHEDULED', sequence: 9 },
      ])?.itemId,
    ).toBe('K02-CHECK-2');
  });
});
