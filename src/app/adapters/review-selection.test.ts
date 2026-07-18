import { describe, expect, it } from 'vitest';
import { buildReviewScheduleRecord } from '../../storage/review-schedule-repository';
import { buildLocalAnswerRecord, diagnoseHero } from './hero-tutor';
import { reviewRecommendation } from './review-selection';

const AN_CONTEXT = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;
const MINH_CONTEXT = { learnerId: 'user-student-minh', simulationProfileId: 'minh' } as const;

describe('continuous review selection', () => {
  it('keeps the current diagnosed root ahead of maintenance work', () => {
    const result = diagnoseHero(AN_CONTEXT);
    expect(reviewRecommendation(AN_CONTEXT, result, [], '2026-07-18T08:00:00.000Z')).toMatchObject({
      kcId: 'K02',
      reason: 'CURRENT_GAP',
      question: { itemId: 'K02-CHECK-1' },
      isDue: true,
    });
  });

  it('rotates to the less-attempted question inside the same root', () => {
    const attempted = buildLocalAnswerRecord(AN_CONTEXT, 'K02-CHECK-1', 'a', true, 0);
    const result = diagnoseHero(AN_CONTEXT, [attempted]);
    expect(
      reviewRecommendation(AN_CONTEXT, result, [attempted], '2026-07-18T08:00:00.000Z')?.question
        .itemId,
    ).toBe('K02-CHECK-2');
  });

  it('reads a due recovery check from its persisted schedule event', () => {
    const answer = {
      ...buildLocalAnswerRecord(MINH_CONTEXT, 'K10-TRANSFER', 'a', true, 0),
      occurredAt: '2026-07-18T08:00:00.000Z',
    };
    const schedule = buildReviewScheduleRecord(answer, 'K10', []);
    const records = [answer, schedule];
    const result = diagnoseHero(MINH_CONTEXT, records);
    expect(
      reviewRecommendation(MINH_CONTEXT, result, records, '2026-07-22T08:00:00.000Z'),
    ).toMatchObject({
      kcId: 'K10',
      reason: 'RECOVERY_CHECK',
      dueAt: '2026-07-21T08:00:00.000Z',
      intervalDays: 3,
      isDue: true,
    });
  });

  it('does not invent a maintenance plan without a persisted schedule', () => {
    const result = diagnoseHero(MINH_CONTEXT);
    expect(
      reviewRecommendation(MINH_CONTEXT, result, [], '2026-08-01T08:00:00.000Z'),
    ).toBeUndefined();
  });

  it('is deterministic for the same event log and explicit as-of time', () => {
    const result = diagnoseHero(AN_CONTEXT);
    expect(reviewRecommendation(AN_CONTEXT, result, [], '2026-07-18T08:00:00.000Z')).toEqual(
      reviewRecommendation(AN_CONTEXT, result, [], '2026-07-18T08:00:00.000Z'),
    );
  });
});
