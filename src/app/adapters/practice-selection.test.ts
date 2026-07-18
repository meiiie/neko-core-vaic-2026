import { describe, expect, it } from 'vitest';
import type { LearnerEventRecord } from '../../storage/db';
import { nextPracticeQuestion } from './practice-selection';

function answer(sequence: number, itemId: string, correct: boolean): LearnerEventRecord {
  return {
    id: `practice-${sequence}`,
    learnerId: 'learner-practice',
    itemId,
    sequence,
    occurredAt: `2026-07-18T09:${String(sequence).padStart(2, '0')}:00.000Z`,
    kind: 'ANSWER',
    payload: JSON.stringify({ choiceId: correct ? 'a' : 'b', correct, methodValidity: 'UNKNOWN' }),
  };
}

describe('practice selection', () => {
  it('serves distinct questions for the requested KC and stops silent repetition', () => {
    expect(nextPracticeQuestion('K02', [])?.itemId).toBe('K02-CHECK-1');

    const oneCorrect = [answer(1, 'K02-CHECK-1', true)];
    expect(nextPracticeQuestion('K02', oneCorrect)?.itemId).toBe('K02-CHECK-2');

    const bothCorrect = [...oneCorrect, answer(2, 'bank-K02-CHECK-2', true)];
    expect(nextPracticeQuestion('K02', bothCorrect)).toBeUndefined();
    expect(nextPracticeQuestion('K02', bothCorrect, { allowRepeat: true })?.itemId).toBe(
      'K02-CHECK-1',
    );
  });

  it('retries a wrong question only after trying the other distinct question', () => {
    const oneWrong = [answer(1, 'K01-CHECK-1', false)];
    expect(nextPracticeQuestion('K01', oneWrong)?.itemId).toBe('K01-CHECK-2');
  });

  it('combines direct and bank attempts when an explicit review allows repetition', () => {
    const attempts = [
      answer(1, 'K02-CHECK-1', true),
      answer(2, 'bank-K02-CHECK-1', true),
      answer(3, 'K02-CHECK-2', true),
    ];
    expect(nextPracticeQuestion('K02', attempts, { allowRepeat: true })?.itemId).toBe(
      'K02-CHECK-2',
    );
  });

  it('does not count a persisted review schedule as another attempt', () => {
    const direct = answer(1, 'K02-CHECK-1', true);
    const review: LearnerEventRecord = {
      ...direct,
      id: 'review-practice-1',
      sequence: 2,
      kind: 'REVIEW_SCHEDULED',
      payload:
        '{"version":"review-schedule-v1","kcId":"K02","sourceEventId":"practice-1","dueAt":"2026-07-21T09:01:00.000Z","intervalDays":3,"reason":"RECOVERY_CHECK"}',
    };
    expect(nextPracticeQuestion('K02', [direct, review])?.itemId).toBe('K02-CHECK-2');
  });
});
