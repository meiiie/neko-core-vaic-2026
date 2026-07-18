import { describe, expect, it } from 'vitest';
import { buildLocalAnswerRecord, diagnoseHero } from './hero-tutor';
import { reviewRecommendation } from './review-selection';

const AN_CONTEXT = { learnerId: 'user-student-an', simulationProfileId: 'an' } as const;
const MINH_CONTEXT = { learnerId: 'user-student-minh', simulationProfileId: 'minh' } as const;

describe('continuous review selection', () => {
  it('keeps the current diagnosed root ahead of maintenance work', () => {
    const result = diagnoseHero(AN_CONTEXT);
    expect(reviewRecommendation(AN_CONTEXT, result, [])).toMatchObject({
      kcId: 'K02',
      reason: 'CURRENT_GAP',
      question: { itemId: 'K02-CHECK-1' },
    });
  });

  it('rotates to the less-attempted question inside the same root', () => {
    const attempted = buildLocalAnswerRecord(AN_CONTEXT, 'K02-CHECK-1', 'a', true, 0);
    const result = diagnoseHero(AN_CONTEXT, [attempted]);
    expect(reviewRecommendation(AN_CONTEXT, result, [attempted])?.question.itemId).toBe(
      'K02-CHECK-2',
    );
  });

  it('prioritizes a previously weak skill that now has two recent correct answers', () => {
    const result = diagnoseHero(MINH_CONTEXT);
    expect(reviewRecommendation(MINH_CONTEXT, result, [])).toMatchObject({
      kcId: 'K10',
      reason: 'RECOVERED_WEAKNESS',
    });
  });

  it('is deterministic for the same evidence log', () => {
    const result = diagnoseHero(MINH_CONTEXT);
    expect(reviewRecommendation(MINH_CONTEXT, result, [])).toEqual(
      reviewRecommendation(MINH_CONTEXT, result, []),
    );
  });
});
