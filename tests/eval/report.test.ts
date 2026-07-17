import { describe, expect, it } from 'vitest';
import { HERO_DEMO_CONFIG, HERO_EVENTS, HERO_GRAPH, HERO_ITEMS } from '../../src/content/hero-demo';
import { evaluateFrozenCases, type FrozenEvaluationCase } from './report';

const caseDefinitions = [
  { id: 'an', expectedStatus: 'DIAGNOSED', expectedRootKcId: 'K02' },
  { id: 'binh', expectedStatus: 'DIAGNOSED', expectedRootKcId: 'K07' },
  { id: 'chi', expectedStatus: 'NEEDS_MORE_EVIDENCE' },
  { id: 'minh', expectedStatus: 'FAST_PATH' },
] as const;

const cases: FrozenEvaluationCase[] = caseDefinitions.map((testCase) => ({
  ...testCase,
  input: {
    learnerId: testCase.id,
    targetKcId: 'K10',
    graph: HERO_GRAPH,
    items: HERO_ITEMS,
    events: HERO_EVENTS[testCase.id as keyof typeof HERO_EVENTS],
    config: HERO_DEMO_CONFIG,
  },
}));

describe('structured deterministic evaluation report', () => {
  it('reports hero accuracy, root top-1, valid paths and latency without real-learning claims', () => {
    const report = evaluateFrozenCases('hero-contract-v1', cases);

    expect(report).toMatchObject({
      suiteId: 'hero-contract-v1',
      caseCount: 4,
      passedCount: 4,
      outcomeAccuracy: 1,
      rootCaseCount: 2,
      rootTop1Correct: 2,
      validPathCount: 4,
    });
    expect(report.p95LatencyMs).toBeGreaterThanOrEqual(0);
  });
});
