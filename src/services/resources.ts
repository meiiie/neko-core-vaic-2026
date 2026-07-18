import { useLiveQuery } from 'dexie-react-hooks';
import { db, type NekoPathDb, type ResourceRecord } from '../storage/db';

/**
 * Learning resources (PDF / short video), LMS_hohulili course-download
 * pattern adapted: metadata mirrors automatically like lessons, but the FILES
 * are cached per-device only when the student asks — a 60 MB video must never
 * ride into a rural data plan uninvited. Cached files come back as object
 * URLs, so playback and reading work fully offline.
 */

export const RESOURCE_FILE_CACHE = 'nekopath-resources-v1';

export function resourceFileUrl(id: string): string {
  return `/api/resources/${encodeURIComponent(id)}/file`;
}

export async function refreshResources(database: NekoPathDb = db): Promise<'REFRESHED' | 'FAILED'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'FAILED';
  try {
    const response = await fetch('/api/resources', { credentials: 'include' });
    if (!response.ok) return 'FAILED';
    const body = (await response.json()) as { resources: ResourceRecord[] };
    await database.transaction('rw', [database.resources], async () => {
      await database.resources.clear();
      await database.resources.bulkPut(body.resources);
    });
    await removeOrphanedResourceFiles(new Set(body.resources.map((resource) => resource.id)));
    return 'REFRESHED';
  } catch {
    return 'FAILED';
  }
}

export function useResourcesForKc(kcId: string): ResourceRecord[] | undefined {
  return useLiveQuery(
    async () => db.resources.where('kcId').equals(kcId).sortBy('createdAt'),
    [kcId],
  );
}

export function useResourceList(): ResourceRecord[] | undefined {
  return useLiveQuery(async () => db.resources.orderBy('sortOrder').toArray(), []);
}

const cacheAvailable = () => typeof caches !== 'undefined';

export async function isResourceCached(id: string): Promise<boolean> {
  if (!cacheAvailable()) return false;
  const cache = await caches.open(RESOURCE_FILE_CACHE);
  return (await cache.match(resourceFileUrl(id))) !== undefined;
}

export async function isResourceCachedWithHash(
  id: string,
  expectedSha256: string,
): Promise<boolean> {
  if (!cacheAvailable()) return false;
  try {
    const cache = await caches.open(RESOURCE_FILE_CACHE);
    const hit = await cache.match(resourceFileUrl(id));
    if (!hit) return false;
    const actualSha256 = await sha256Hex(await hit.clone().arrayBuffer());
    if (actualSha256 === expectedSha256.toLowerCase()) return true;
    await cache.delete(resourceFileUrl(id));
    return false;
  } catch {
    return false;
  }
}

/** Download the full file into the device cache (explicit, size shown in UI). */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export type ResourceDownloadResult = 'SAVED' | 'HASH_MISMATCH' | 'NO_SPACE' | 'FAILED';

export async function saveResourceOffline(
  id: string,
  expectedSha256?: string,
): Promise<ResourceDownloadResult> {
  if (!cacheAvailable()) return 'FAILED';
  try {
    const response = await fetch(resourceFileUrl(id), { credentials: 'include' });
    if (!response.ok) return 'FAILED';
    if (expectedSha256) {
      const actualSha256 = await sha256Hex(await response.clone().arrayBuffer());
      if (actualSha256 !== expectedSha256.toLowerCase()) return 'HASH_MISMATCH';
    }
    const cache = await caches.open(RESOURCE_FILE_CACHE);
    await cache.put(resourceFileUrl(id), response);
    return 'SAVED';
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') return 'NO_SPACE';
    return 'FAILED';
  }
}

export async function removeResourceOffline(id: string): Promise<void> {
  if (!cacheAvailable()) return;
  const cache = await caches.open(RESOURCE_FILE_CACHE);
  await cache.delete(resourceFileUrl(id));
}

export async function removeOrphanedResourceFiles(
  validResourceIds: ReadonlySet<string>,
): Promise<void> {
  if (!cacheAvailable()) return;
  const cache = await caches.open(RESOURCE_FILE_CACHE);
  const requests = await cache.keys();
  await Promise.all(
    requests.map(async (request) => {
      const match = /\/api\/resources\/([^/]+)\/file$/.exec(new URL(request.url).pathname);
      const id = match?.[1] ? decodeURIComponent(match[1]) : undefined;
      if (id && !validResourceIds.has(id)) await cache.delete(request);
    }),
  );
}

/**
 * Object URL for a cached file, or null when it is not on this device.
 * Callers must revoke the URL when done with it.
 */
export async function cachedResourceObjectUrl(id: string): Promise<string | null> {
  if (!cacheAvailable()) return null;
  const cache = await caches.open(RESOURCE_FILE_CACHE);
  const hit = await cache.match(resourceFileUrl(id));
  if (!hit) return null;
  return URL.createObjectURL(await hit.blob());
}

export type UploadResult = 'UPLOADED' | 'TOO_LARGE' | 'UNSUPPORTED' | 'INVALID' | 'FAILED';

export interface ResourceUploadMetadata {
  readonly title: string;
  readonly role: ResourceRecord['role'];
  readonly durationSeconds: number | null;
  readonly transcriptVi: string;
  readonly sortOrder: number;
  readonly status: ResourceRecord['status'];
  readonly reviewState: ResourceRecord['reviewState'];
  readonly gradeMin: number;
  readonly gradeMax: number;
}

/** Teacher upload (multipart). The server enforces role, size and type. */
export async function uploadResource(
  kcId: string,
  metadata: ResourceUploadMetadata,
  file: File,
  database: NekoPathDb = db,
): Promise<UploadResult> {
  try {
    const form = new FormData();
    form.append('kcId', kcId);
    form.append('title', metadata.title);
    form.append('role', metadata.role);
    form.append('durationSeconds', metadata.durationSeconds?.toString() ?? '');
    form.append('transcriptVi', metadata.transcriptVi);
    form.append('sortOrder', metadata.sortOrder.toString());
    form.append('status', metadata.status);
    form.append('reviewState', metadata.reviewState);
    form.append('gradeMin', metadata.gradeMin.toString());
    form.append('gradeMax', metadata.gradeMax.toString());
    form.append('file', file);
    const response = await fetch('/api/resources', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (response.status === 413) return 'TOO_LARGE';
    if (response.status === 415) return 'UNSUPPORTED';
    if (response.status === 400) return 'INVALID';
    if (!response.ok) return 'FAILED';
    await refreshResources(database);
    return 'UPLOADED';
  } catch {
    return 'FAILED';
  }
}

export async function deleteResource(
  id: string,
  database: NekoPathDb = db,
): Promise<'DELETED' | 'FAILED'> {
  try {
    const response = await fetch(resourceFileUrl(id).replace(/\/file$/, ''), {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) return 'FAILED';
    await removeResourceOffline(id);
    await refreshResources(database);
    return 'DELETED';
  } catch {
    return 'FAILED';
  }
}

export function formatBytes(byteSize: number): string {
  if (byteSize >= 1024 * 1024) return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
}
