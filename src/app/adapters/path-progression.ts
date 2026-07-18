import { HERO_DEMO_CONFIG, HERO_GRAPH, HERO_ITEMS } from '../../content';
import { computeMastery, DEFAULT_DOMAIN_CONFIG, type DiagnosisResult } from '../../domain';
import type { LearnerEventRecord } from '../../storage/db';
import {
  diagnoseHero,
  studentDomainEvents,
  toDomainEvents,
  type StudentDiagnosisContext,
} from './hero-tutor';

export type PathStepStatus = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

export interface PathProgressStep {
  readonly kcId: string;
  readonly status: PathStepStatus;
}

export interface PathProgress {
  readonly pathKcIds: readonly string[];
  readonly steps: readonly PathProgressStep[];
  readonly currentKcId?: string;
  readonly isComplete: boolean;
  readonly needsMoreEvidence: boolean;
  readonly source: 'CURRENT_DIAGNOSIS' | 'RECOVERED_DIAGNOSIS';
}

function orderedAnswerRecords(
  context: StudentDiagnosisContext,
  records: readonly LearnerEventRecord[],
): LearnerEventRecord[] {
  return records
    .filter(
      (record) => record.learnerId === context.learnerId && toDomainEvents([record]).length > 0,
    )
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.id.localeCompare(right.id),
    );
}

function lastDiagnosedPath(
  context: StudentDiagnosisContext,
  records: readonly LearnerEventRecord[],
): readonly string[] | undefined {
  const ordered = orderedAnswerRecords(context, records);
  let latest: readonly string[] | undefined;
  for (let index = 1; index <= ordered.length; index += 1) {
    const diagnosis = diagnoseHero(context, ordered.slice(0, index));
    if (diagnosis.status === 'DIAGNOSED' && diagnosis.pathKcIds.length > 0) {
      latest = diagnosis.pathKcIds;
    }
  }
  return latest;
}

/**
 * Keep the last evidence-supported remediation path after its root is repaired.
 * The value is derived from the canonical event log, so reload/offline replay is
 * deterministic and no stale path state is persisted.
 */
export function derivePathProgress(
  context: StudentDiagnosisContext,
  diagnosis: DiagnosisResult,
  records: readonly LearnerEventRecord[],
): PathProgress | undefined {
  const currentPath =
    diagnosis.status === 'DIAGNOSED' && diagnosis.pathKcIds.length > 0
      ? diagnosis.pathKcIds
      : undefined;
  const recoveredPath = currentPath ? undefined : lastDiagnosedPath(context, records);
  const pathKcIds = currentPath ?? recoveredPath;
  if (!pathKcIds || pathKcIds.length === 0) return undefined;

  const events = studentDomainEvents(context, records);
  const mastery = computeMastery(HERO_GRAPH, HERO_ITEMS, events, HERO_DEMO_CONFIG);
  const completed = new Set(
    pathKcIds.filter((kcId) => {
      const state = mastery.get(kcId);
      return (
        state !== undefined &&
        state.probability >= DEFAULT_DOMAIN_CONFIG.masteryThreshold &&
        state.directEvidenceCount >= DEFAULT_DOMAIN_CONFIG.minDirectEvidence
      );
    }),
  );
  const isComplete = diagnosis.status === 'FAST_PATH';
  const currentKcId = isComplete ? undefined : pathKcIds.find((kcId) => !completed.has(kcId));

  return {
    pathKcIds,
    steps: pathKcIds.map((kcId) => ({
      kcId,
      status:
        isComplete || completed.has(kcId)
          ? 'COMPLETED'
          : kcId === currentKcId
            ? 'CURRENT'
            : 'UPCOMING',
    })),
    ...(currentKcId ? { currentKcId } : {}),
    isComplete,
    needsMoreEvidence: !isComplete && currentKcId === undefined,
    source: currentPath ? 'CURRENT_DIAGNOSIS' : 'RECOVERED_DIAGNOSIS',
  };
}
