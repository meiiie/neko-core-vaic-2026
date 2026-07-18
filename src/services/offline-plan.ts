import type { StudentLearningPlan } from '../app/adapters/student-learning-plan';
import type { ResourceRecord } from '../storage/db';
import {
  isResourceCachedWithHash,
  saveResourceOffline,
  type ResourceDownloadResult,
} from './resources';

export interface OfflinePlanResource {
  readonly id: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly required: boolean;
}

export interface OfflinePlanManifest {
  readonly planVersion: string;
  readonly resourceIds: readonly string[];
  readonly totalBytes: number;
  readonly requiredBytes: number;
  readonly resources: readonly OfflinePlanResource[];
}

export interface OfflinePlanProgress {
  readonly completedBytes: number;
  readonly totalBytes: number;
  readonly resourceId: string;
  readonly status: 'CACHED' | 'SAVED' | 'FAILED';
}

export type OfflinePlanResult =
  | { readonly status: 'READY' }
  | { readonly status: 'PARTIAL'; readonly failedResourceIds: readonly string[] }
  | { readonly status: 'NO_SPACE' };

export interface OfflinePlanDependencies {
  readonly isCached: (id: string, sha256: string) => Promise<boolean>;
  readonly download: (id: string, sha256: string) => Promise<ResourceDownloadResult>;
}

const DEFAULT_DEPENDENCIES: OfflinePlanDependencies = {
  isCached: isResourceCachedWithHash,
  download: saveResourceOffline,
};

export function buildOfflinePlanManifest(
  plan: StudentLearningPlan,
  catalog: readonly ResourceRecord[],
  options: { readonly includeVideo: boolean } = { includeVideo: true },
): OfflinePlanManifest {
  const selectedIds = new Set(plan.steps.flatMap((step) => step.resourceIds));
  const resources = catalog
    .filter(
      (resource) =>
        selectedIds.has(resource.id) && (options.includeVideo || resource.kind !== 'VIDEO'),
    )
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((resource) => ({
      id: resource.id,
      byteSize: resource.byteSize,
      sha256: resource.sha256,
      required: resource.kind === 'PDF',
    }));
  return {
    planVersion: `${plan.contentVersion}:${plan.algorithmVersion}:${resources.map(({ id }) => id).join(',')}`,
    resourceIds: resources.map(({ id }) => id),
    totalBytes: resources.reduce((sum, resource) => sum + resource.byteSize, 0),
    requiredBytes: resources
      .filter((resource) => resource.required)
      .reduce((sum, resource) => sum + resource.byteSize, 0),
    resources,
  };
}

/** Downloads sequentially so weak connections do not compete across large media files. */
export async function downloadOfflinePlan(
  manifest: OfflinePlanManifest,
  onProgress: (progress: OfflinePlanProgress) => void = () => undefined,
  dependencies: OfflinePlanDependencies = DEFAULT_DEPENDENCIES,
): Promise<OfflinePlanResult> {
  const failedResourceIds: string[] = [];
  let completedBytes = 0;
  for (const resource of manifest.resources) {
    if (await dependencies.isCached(resource.id, resource.sha256)) {
      completedBytes += resource.byteSize;
      onProgress({
        completedBytes,
        totalBytes: manifest.totalBytes,
        resourceId: resource.id,
        status: 'CACHED',
      });
      continue;
    }
    const result = await dependencies.download(resource.id, resource.sha256);
    if (result === 'NO_SPACE') return { status: 'NO_SPACE' };
    if (result !== 'SAVED') {
      failedResourceIds.push(resource.id);
      onProgress({
        completedBytes,
        totalBytes: manifest.totalBytes,
        resourceId: resource.id,
        status: 'FAILED',
      });
      continue;
    }
    completedBytes += resource.byteSize;
    onProgress({
      completedBytes,
      totalBytes: manifest.totalBytes,
      resourceId: resource.id,
      status: 'SAVED',
    });
  }
  return failedResourceIds.length > 0
    ? { status: 'PARTIAL', failedResourceIds }
    : { status: 'READY' };
}
