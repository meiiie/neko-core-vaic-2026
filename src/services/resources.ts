import { useLiveQuery } from 'dexie-react-hooks';
import { db, type NekoPathDb, type ResourceRecord } from '../storage/db';

/**
 * Learning resources (PDF / short video), LMS_hohulili course-download
 * pattern adapted: metadata mirrors automatically like lessons, but the FILES
 * are cached per-device only when the student asks — a 60 MB video must never
 * ride into a rural data plan uninvited. Cached files come back as object
 * URLs, so playback and reading work fully offline.
 */

const FILE_CACHE = 'nekopath-resources-v1';

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

const cacheAvailable = () => typeof caches !== 'undefined';

export async function isResourceCached(id: string): Promise<boolean> {
  if (!cacheAvailable()) return false;
  const cache = await caches.open(FILE_CACHE);
  return (await cache.match(resourceFileUrl(id))) !== undefined;
}

/** Download the full file into the device cache (explicit, size shown in UI). */
export async function saveResourceOffline(id: string): Promise<'SAVED' | 'FAILED'> {
  if (!cacheAvailable()) return 'FAILED';
  try {
    const response = await fetch(resourceFileUrl(id), { credentials: 'include' });
    if (!response.ok) return 'FAILED';
    const cache = await caches.open(FILE_CACHE);
    await cache.put(resourceFileUrl(id), response);
    return 'SAVED';
  } catch {
    return 'FAILED';
  }
}

export async function removeResourceOffline(id: string): Promise<void> {
  if (!cacheAvailable()) return;
  const cache = await caches.open(FILE_CACHE);
  await cache.delete(resourceFileUrl(id));
}

/**
 * Object URL for a cached file, or null when it is not on this device.
 * Callers must revoke the URL when done with it.
 */
export async function cachedResourceObjectUrl(id: string): Promise<string | null> {
  if (!cacheAvailable()) return null;
  const cache = await caches.open(FILE_CACHE);
  const hit = await cache.match(resourceFileUrl(id));
  if (!hit) return null;
  return URL.createObjectURL(await hit.blob());
}

export type UploadResult = 'UPLOADED' | 'TOO_LARGE' | 'UNSUPPORTED' | 'FAILED';

/** Teacher upload (multipart). The server enforces role, size and type. */
export async function uploadResource(
  kcId: string,
  title: string,
  file: File,
  database: NekoPathDb = db,
): Promise<UploadResult> {
  try {
    const form = new FormData();
    form.append('kcId', kcId);
    form.append('title', title);
    form.append('file', file);
    const response = await fetch('/api/resources', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (response.status === 413) return 'TOO_LARGE';
    if (response.status === 415) return 'UNSUPPORTED';
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
