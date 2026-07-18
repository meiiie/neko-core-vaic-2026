import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OfflinePlanManifest } from './offline-plan';
import { downloadOfflinePlan } from './offline-plan';
import { isResourceCachedWithHash, removeOrphanedResourceFiles } from './resources';

const manifest: OfflinePlanManifest = {
  planVersion: 'plan-v1',
  resourceIds: ['pdf', 'video'],
  totalBytes: 300,
  requiredBytes: 100,
  resources: [
    { id: 'pdf', byteSize: 100, sha256: 'a'.repeat(64), required: true },
    { id: 'video', byteSize: 200, sha256: 'b'.repeat(64), required: false },
  ],
};

describe('offline plan download', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not download an already cached resource', async () => {
    const download = vi.fn(async () => 'SAVED' as const);
    await expect(
      downloadOfflinePlan(manifest, undefined, {
        isCached: async (id) => id === 'pdf',
        download,
      }),
    ).resolves.toEqual({ status: 'READY' });
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith('video', 'b'.repeat(64));
  });

  it.each(['FAILED', 'HASH_MISMATCH'] as const)(
    'returns PARTIAL and keeps the failed id for %s',
    async (failure) => {
      await expect(
        downloadOfflinePlan(manifest, undefined, {
          isCached: async () => false,
          download: async (id) => (id === 'pdf' ? failure : 'SAVED'),
        }),
      ).resolves.toEqual({ status: 'PARTIAL', failedResourceIds: ['pdf'] });
    },
  );

  it('stops cleanly when device storage is full', async () => {
    await expect(
      downloadOfflinePlan(manifest, undefined, {
        isCached: async () => false,
        download: async () => 'NO_SPACE',
      }),
    ).resolves.toEqual({ status: 'NO_SPACE' });
  });

  it('is idempotent on retry after a partial download', async () => {
    const cached = new Set<string>();
    let failVideo = true;
    const dependencies = {
      isCached: async (id: string) => cached.has(id),
      download: async (id: string) => {
        if (id === 'video' && failVideo) return 'FAILED' as const;
        cached.add(id);
        return 'SAVED' as const;
      },
    };
    await expect(downloadOfflinePlan(manifest, undefined, dependencies)).resolves.toMatchObject({
      status: 'PARTIAL',
    });
    failVideo = false;
    await expect(downloadOfflinePlan(manifest, undefined, dependencies)).resolves.toEqual({
      status: 'READY',
    });
    expect(cached).toEqual(new Set(['pdf', 'video']));
  });

  it('removes cached files whose metadata no longer exists', async () => {
    const stale = new Request('https://local.test/api/resources/stale/file');
    const keep = new Request('https://local.test/api/resources/keep/file');
    const remove = vi.fn(async () => true);
    vi.stubGlobal('caches', {
      open: async () => ({ keys: async () => [stale, keep], delete: remove }),
    });

    await removeOrphanedResourceFiles(new Set(['keep']));
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(stale);
  });

  it('evicts a cached response when its SHA-256 no longer matches metadata', async () => {
    const remove = vi.fn(async () => true);
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async () => new Response('hello'),
        delete: remove,
      }),
    });

    await expect(isResourceCachedWithHash('pdf', '0'.repeat(64))).resolves.toBe(false);
    expect(remove).toHaveBeenCalledWith('/api/resources/pdf/file');
  });
});
