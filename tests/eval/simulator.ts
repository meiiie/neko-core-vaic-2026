import type { Item, LearnerEvent } from '../../src/domain';

export interface SimulationProfile {
  readonly learnerId: string;
  readonly masteredKcIds: readonly string[];
  readonly slip: number;
  readonly guess: number;
  readonly seed: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function simulateResponses(
  profile: SimulationProfile,
  items: readonly Item[],
): LearnerEvent[] {
  if (profile.slip < 0 || profile.slip > 1 || profile.guess < 0 || profile.guess > 1) {
    throw new Error('Simulator slip and guess must be between 0 and 1');
  }

  const mastered = new Set(profile.masteredKcIds);
  const random = mulberry32(profile.seed);
  return items.map((item, index) => {
    const capable = item.kcIds.every((kcId) => mastered.has(kcId));
    const correctProbability = capable ? 1 - profile.slip : profile.guess;
    return {
      id: `${profile.learnerId}-sim-${index + 1}`,
      learnerId: profile.learnerId,
      itemId: item.id,
      sequence: index + 1,
      occurredAt: `2026-07-17T09:${String(index).padStart(2, '0')}:00.000Z`,
      correct: random() < correctProbability,
    };
  });
}
