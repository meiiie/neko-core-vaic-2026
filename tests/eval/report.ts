import { diagnose, shortestPath, type DiagnosisInput, type DiagnosisStatus } from '../../src/domain';

export interface FrozenEvaluationCase {
  readonly id: string;
  readonly input: DiagnosisInput;
  readonly expectedStatus: DiagnosisStatus;
  readonly expectedRootKcId?: string;
}

export interface EvaluationCaseResult {
  readonly id: string;
  readonly passed: boolean;
  readonly status: DiagnosisStatus;
  readonly rootKcId?: string;
  readonly pathValid: boolean;
  readonly latencyMs: number;
}

export interface EvaluationReport {
  readonly suiteId: string;
  readonly caseCount: number;
  readonly passedCount: number;
  readonly outcomeAccuracy: number;
  readonly rootCaseCount: number;
  readonly rootTop1Correct: number;
  readonly validPathCount: number;
  readonly p95LatencyMs: number;
  readonly results: readonly EvaluationCaseResult[];
}

function pathIsValid(input: DiagnosisInput, rootKcId: string | undefined, path: readonly string[]): boolean {
  if (!rootKcId || path.length === 0) return false;
  if (path[0] !== rootKcId || path[path.length - 1] !== input.targetKcId) return false;
  return path.slice(1).every((kcId, index) =>
    shortestPath(input.graph, path[index]!, kcId).length > 0,
  );
}

export function evaluateFrozenCases(
  suiteId: string,
  cases: readonly FrozenEvaluationCase[],
): EvaluationReport {
  if (!suiteId.trim() || cases.length === 0) throw new Error('Evaluation suite needs an id and cases');

  const results = cases.map((testCase): EvaluationCaseResult => {
    const startedAt = performance.now();
    const actual = diagnose(testCase.input);
    const latencyMs = performance.now() - startedAt;
    const passed =
      actual.status === testCase.expectedStatus &&
      actual.rootKcId === testCase.expectedRootKcId;
    const pathValid =
      actual.status === 'DIAGNOSED'
        ? pathIsValid(testCase.input, actual.rootKcId, actual.pathKcIds)
        : actual.pathKcIds.length === 0;
    return {
      id: testCase.id,
      passed,
      status: actual.status,
      ...(actual.rootKcId ? { rootKcId: actual.rootKcId } : {}),
      pathValid,
      latencyMs,
    };
  });
  const sortedLatencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const p95Index = Math.min(sortedLatencies.length - 1, Math.ceil(sortedLatencies.length * 0.95) - 1);
  const rootCases = cases.filter((testCase) => testCase.expectedStatus === 'DIAGNOSED');

  return {
    suiteId,
    caseCount: cases.length,
    passedCount: results.filter((result) => result.passed).length,
    outcomeAccuracy: results.filter((result) => result.passed).length / cases.length,
    rootCaseCount: rootCases.length,
    rootTop1Correct: rootCases.filter((testCase) => {
      const result = results.find((candidate) => candidate.id === testCase.id)!;
      return result.status === 'DIAGNOSED' && result.rootKcId === testCase.expectedRootKcId;
    }).length,
    validPathCount: results.filter((result) => result.pathValid).length,
    p95LatencyMs: sortedLatencies[p95Index]!,
    results,
  };
}
