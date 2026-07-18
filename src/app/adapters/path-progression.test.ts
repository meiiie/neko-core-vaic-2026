import { describe, expect, it } from 'vitest';
import type { LearnerEventRecord } from '../../storage/db';
import { diagnoseHero, type StudentDiagnosisContext } from './hero-tutor';
import { derivePathProgress } from './path-progression';

const context: StudentDiagnosisContext = { learnerId: 'learner-path' };

function answer(sequence: number, itemId: string, correct: boolean): LearnerEventRecord {
  return {
    id: `event-${sequence}`,
    learnerId: context.learnerId,
    itemId,
    sequence,
    occurredAt: `2026-07-18T08:${String(sequence).padStart(2, '0')}:00.000Z`,
    kind: 'ANSWER',
    payload: JSON.stringify({ choiceId: correct ? 'a' : 'b', correct, methodValidity: 'UNKNOWN' }),
  };
}

describe('derived path progression', () => {
  it('keeps the diagnosed path and advances after its root is repaired', () => {
    const initialRecords = [
      answer(1, 'K01-CHECK-1', false),
      answer(2, 'K01-CHECK-2', false),
      answer(3, 'K10-CHECK-1', false),
    ];
    const initialDiagnosis = diagnoseHero(context, initialRecords);
    const initial = derivePathProgress(context, initialDiagnosis, initialRecords);

    expect(initialDiagnosis.status).toBe('DIAGNOSED');
    expect(initial?.pathKcIds).toEqual(['K01', 'K02', 'K08', 'K09', 'K10']);
    expect(initial?.currentKcId).toBe('K01');

    const repairedRecords = [
      ...initialRecords,
      answer(4, 'K01-CHECK-1', true),
      answer(5, 'K01-CHECK-2', true),
      answer(6, 'K01-CHECK-1', true),
    ];
    const repairedDiagnosis = diagnoseHero(context, repairedRecords);
    const repaired = derivePathProgress(context, repairedDiagnosis, repairedRecords);

    expect(repairedDiagnosis.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(repaired?.source).toBe('RECOVERED_DIAGNOSIS');
    expect(repaired?.steps[0]).toEqual({ kcId: 'K01', status: 'COMPLETED' });
    expect(repaired?.currentKcId).toBe('K02');
  });
});
