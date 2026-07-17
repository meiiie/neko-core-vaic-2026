import { describe, expect, it } from 'vitest';
import {
  fixedPrerequisiteBaseline,
  lowestMasteryBaseline,
  surfaceSkillBaseline,
} from './baselines';
import { DISCLOSED_DEVELOPMENT_CASES, DISCLOSED_DEVELOPMENT_PROFILES } from './development-suite';
import { evaluateFrozenCases } from './report';

describe('disclosed 24-profile development suite', () => {
  it('keeps the held-out boundary explicit', () => {
    expect(DISCLOSED_DEVELOPMENT_PROFILES).toHaveLength(24);
    expect(DISCLOSED_DEVELOPMENT_PROFILES.every((profile) => profile.id.includes('held-out'))).toBe(
      false,
    );
  });

  it('records conservative abstentions and meets the root/path/latency gates', () => {
    const report = evaluateFrozenCases('disclosed-development-v1', DISCLOSED_DEVELOPMENT_CASES);

    expect(report.passedCount).toBe(19);
    expect(report.rootTop1Correct / report.rootCaseCount).toBeGreaterThanOrEqual(0.8);
    expect(report.validPathCount).toBe(report.caseCount);
    expect(report.p95LatencyMs).toBeLessThan(300);
    expect(
      report.results
        .filter((result) => !result.passed)
        .every((result) => result.status === 'NEEDS_MORE_EVIDENCE'),
    ).toBe(true);
  });

  it('beats each always-answer baseline by at least ten points on all outcomes', () => {
    const accuracy = (
      selector: (input: (typeof DISCLOSED_DEVELOPMENT_CASES)[number]['input']) => string,
    ) =>
      DISCLOSED_DEVELOPMENT_CASES.filter(
        (testCase) =>
          testCase.expectedStatus === 'DIAGNOSED' &&
          selector(testCase.input) === testCase.expectedRootKcId,
      ).length / DISCLOSED_DEVELOPMENT_CASES.length;
    const report = evaluateFrozenCases('disclosed-development-v1', DISCLOSED_DEVELOPMENT_CASES);
    const bestBaseline = Math.max(
      accuracy(surfaceSkillBaseline),
      accuracy(fixedPrerequisiteBaseline),
      accuracy(lowestMasteryBaseline),
    );

    expect(report.outcomeAccuracy - bestBaseline).toBeGreaterThanOrEqual(0.1);
  });
});
