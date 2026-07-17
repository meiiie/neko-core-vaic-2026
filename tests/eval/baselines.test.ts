import { describe, expect, it } from 'vitest';
import { diagnose, type DiagnosisInput } from '../../src/domain';
import {
  fixedPrerequisiteBaseline,
  lowestMasteryBaseline,
  surfaceSkillBaseline,
} from './baselines';
import { HERO_DEMO_CONFIG, HERO_EVENTS, HERO_GRAPH, HERO_ITEMS } from '../../src/content/hero-demo';

type HeroId = keyof typeof HERO_EVENTS;

const expected = {
  an: { status: 'DIAGNOSED', rootKcId: 'K02' },
  binh: { status: 'DIAGNOSED', rootKcId: 'K07' },
  chi: { status: 'NEEDS_MORE_EVIDENCE', rootKcId: undefined },
  minh: { status: 'FAST_PATH', rootKcId: undefined },
} as const;

function inputFor(learnerId: HeroId): DiagnosisInput {
  return {
    learnerId,
    targetKcId: 'K10',
    graph: HERO_GRAPH,
    items: HERO_ITEMS,
    events: HERO_EVENTS[learnerId],
    config: HERO_DEMO_CONFIG,
  };
}

function scoreNekoPath(): number {
  const learnerIds = Object.keys(expected) as HeroId[];
  return (
    learnerIds.filter((learnerId) => {
      const actual = diagnose(inputFor(learnerId));
      return (
        actual.status === expected[learnerId].status &&
        actual.rootKcId === expected[learnerId].rootKcId
      );
    }).length / learnerIds.length
  );
}

describe('named baselines on the frozen hero contract', () => {
  it('shows why surface-only and fixed paths cannot satisfy the brief', () => {
    expect(surfaceSkillBaseline(inputFor('an'))).toBe('K10');
    expect(surfaceSkillBaseline(inputFor('binh'))).toBe('K10');
    expect(fixedPrerequisiteBaseline(inputFor('an'))).toBe('K01');
    expect(fixedPrerequisiteBaseline(inputFor('binh'))).toBe('K01');
  });

  it('shows that lowest mastery still forces a label for abstain and fast-path cases', () => {
    expect(lowestMasteryBaseline(inputFor('chi'))).toBeTypeOf('string');
    expect(lowestMasteryBaseline(inputFor('minh'))).toBeTypeOf('string');
    expect(expected.chi.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(expected.minh.status).toBe('FAST_PATH');
  });

  it('passes all four hero outcomes without presenting them as the 30-profile benchmark', () => {
    expect(scoreNekoPath()).toBe(1);
  });
});
