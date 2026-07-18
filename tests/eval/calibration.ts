import { computeMastery, type DiagnosisInput } from '../../src/domain';

export interface SyntheticCalibrationCase {
  readonly id: string;
  readonly input: DiagnosisInput;
  readonly masteredKcIds: readonly string[];
}

export interface SyntheticCalibrationReport {
  readonly evidenceLabel: 'DISCLOSED_SYNTHETIC_GROUND_TRUTH';
  readonly caseCount: number;
  readonly pointCount: number;
  readonly brierScore: number;
  readonly expectedCalibrationError: number;
  readonly binCount: number;
}

export function evaluateSyntheticMasteryCalibration(
  cases: readonly SyntheticCalibrationCase[],
  binCount = 5,
): SyntheticCalibrationReport {
  if (cases.length === 0) throw new Error('Calibration requires at least one disclosed case');
  if (!Number.isInteger(binCount) || binCount < 2) {
    throw new Error('binCount must be an integer of at least 2');
  }

  const points = cases.flatMap((testCase) => {
    const mastered = new Set(testCase.masteredKcIds);
    const states = computeMastery(
      testCase.input.graph,
      testCase.input.items,
      testCase.input.events.filter((event) => event.learnerId === testCase.input.learnerId),
      testCase.input.config,
    );
    return testCase.input.graph.nodes.map((node) => ({
      predicted: states.get(node.id)!.probability,
      actual: mastered.has(node.id) ? 1 : 0,
    }));
  });

  const brierScore =
    points.reduce((total, point) => total + (point.predicted - point.actual) ** 2, 0) /
    points.length;
  const bins = Array.from({ length: binCount }, () => [] as typeof points);
  for (const point of points) {
    const index = Math.min(binCount - 1, Math.floor(point.predicted * binCount));
    bins[index]!.push(point);
  }
  const expectedCalibrationError = bins.reduce((total, bin) => {
    if (bin.length === 0) return total;
    const meanPrediction = bin.reduce((sum, point) => sum + point.predicted, 0) / bin.length;
    const meanOutcome = bin.reduce((sum, point) => sum + point.actual, 0) / bin.length;
    return total + (bin.length / points.length) * Math.abs(meanPrediction - meanOutcome);
  }, 0);

  return {
    evidenceLabel: 'DISCLOSED_SYNTHETIC_GROUND_TRUTH',
    caseCount: cases.length,
    pointCount: points.length,
    brierScore,
    expectedCalibrationError,
    binCount,
  };
}
