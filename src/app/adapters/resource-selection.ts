import type { ResourceRecord } from '../../storage/db';

export interface ResourceSelectionStep {
  readonly kcId: string;
  readonly gradeLabels: readonly number[];
}

function eligible(step: ResourceSelectionStep, resource: ResourceRecord): boolean {
  const gradeMatches =
    step.gradeLabels.length === 0 ||
    step.gradeLabels.some((grade) => grade >= resource.gradeMin && grade <= resource.gradeMax);
  return (
    resource.kcId === step.kcId &&
    resource.status === 'PUBLISHED' &&
    resource.reviewState === 'ACCEPTED' &&
    gradeMatches
  );
}

/** Deterministic selection; no model may change resource eligibility or order. */
export function selectResourcesForStep(
  step: ResourceSelectionStep,
  resources: readonly ResourceRecord[],
): readonly ResourceRecord[] {
  const candidates = resources.filter((resource) => eligible(step, resource));
  const explain = candidates
    .filter((resource) => resource.role === 'EXPLAIN')
    .sort(
      (left, right) =>
        (left.durationSeconds ?? Number.MAX_SAFE_INTEGER) -
          (right.durationSeconds ?? Number.MAX_SAFE_INTEGER) ||
        left.sortOrder - right.sortOrder ||
        left.id.localeCompare(right.id),
    )[0];
  const summary = candidates
    .filter((resource) => resource.role === 'SUMMARY')
    .sort(
      (left, right) =>
        left.byteSize - right.byteSize ||
        left.sortOrder - right.sortOrder ||
        left.id.localeCompare(right.id),
    )[0];
  return [explain, summary].filter(
    (resource, index, selected): resource is ResourceRecord =>
      resource !== undefined && selected.findIndex((item) => item?.id === resource.id) === index,
  );
}
