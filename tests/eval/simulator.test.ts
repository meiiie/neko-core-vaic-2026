import { describe, expect, it } from 'vitest';
import { HERO_GRAPH, HERO_ITEMS } from './fixtures';
import { simulateResponses } from './simulator';

describe('independent noisy response simulator', () => {
  it('is deterministic for the same frozen seed', () => {
    const profile = {
      learnerId: 'seeded',
      masteredKcIds: ['K01', 'K02'],
      slip: 0.1,
      guess: 0.2,
      seed: 20260717,
    } as const;

    expect(simulateResponses(profile, HERO_ITEMS)).toEqual(
      simulateResponses(profile, HERO_ITEMS),
    );
  });

  it('uses conjunctive item requirements without importing inference parameters', () => {
    const allMastered = simulateResponses(
      {
        learnerId: 'all-mastered',
        masteredKcIds: HERO_GRAPH.nodes.map((node) => node.id),
        slip: 0,
        guess: 0,
        seed: 1,
      },
      HERO_ITEMS,
    );
    const noMastery = simulateResponses(
      {
        learnerId: 'no-mastery',
        masteredKcIds: [],
        slip: 0,
        guess: 0,
        seed: 1,
      },
      HERO_ITEMS,
    );

    expect(allMastered.every((event) => event.correct)).toBe(true);
    expect(noMastery.every((event) => !event.correct)).toBe(true);
  });
});
