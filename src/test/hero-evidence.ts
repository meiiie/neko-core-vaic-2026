import { HERO_EVENTS, type HeroSimulationProfileId } from '../content';
import type { LearnerEventRecord } from '../storage/db';

/** Test representation of the same rows seeded by server/seed.ts. */
export function storedHeroRecords(profileId: HeroSimulationProfileId): LearnerEventRecord[] {
  const learnerId = `user-student-${profileId}`;
  return HERO_EVENTS[profileId].map((event) => ({
    id: event.id,
    learnerId,
    itemId: event.itemId,
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    kind: 'SEEDED_EVIDENCE',
    payload: JSON.stringify({
      choiceId: 'seeded-history',
      correct: event.correct,
      methodValidity: event.methodValidity ?? 'UNKNOWN',
      ...(event.misconceptionId ? { misconceptionId: event.misconceptionId } : {}),
    }),
  }));
}
