import { describe, expect, it } from 'vitest';
import { DISCLOSED_DEVELOPMENT_CASES, DISCLOSED_DEVELOPMENT_PROFILES } from './development-suite';
import { evaluateSyntheticMasteryCalibration } from './calibration';

const calibrationCases = DISCLOSED_DEVELOPMENT_PROFILES.map((profile) => ({
  id: profile.id,
  input: DISCLOSED_DEVELOPMENT_CASES.find((testCase) => testCase.id === profile.id)!.input,
  masteredKcIds: profile.masteredKcIds,
}));

describe('disclosed synthetic mastery calibration', () => {
  it('reports Brier score and ECE without presenting them as real-student evidence', () => {
    const report = evaluateSyntheticMasteryCalibration(calibrationCases);

    expect(report).toEqual(evaluateSyntheticMasteryCalibration(calibrationCases));
    expect(report).toMatchObject({
      evidenceLabel: 'DISCLOSED_SYNTHETIC_GROUND_TRUTH',
      caseCount: 24,
      pointCount: 144,
      binCount: 5,
    });
    expect(report.brierScore).toBeLessThan(0.25);
    expect(report.expectedCalibrationError).toBeLessThan(0.25);
  });
});
