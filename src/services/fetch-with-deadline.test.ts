import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithDeadline } from './fetch-with-deadline';

function abortAwarePendingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(init.signal.reason);
          return;
        }
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      }),
  );
}

describe('fetchWithDeadline', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns a successful response and clears its deadline timer', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const response = new Response('{}', { status: 200 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );

    await expect(fetchWithDeadline('/ok', { deadlineMs: 3_000 })).resolves.toBe(response);
    expect(clearTimeoutSpy).toHaveBeenCalledOnce();
  });

  it('aborts a request when its deadline expires', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', abortAwarePendingFetch());
    const request = fetchWithDeadline('/slow', { deadlineMs: 3_000 });
    const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });

    await vi.advanceTimersByTimeAsync(3_000);

    await rejection;
  });

  it('propagates caller cancellation before the deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', abortAwarePendingFetch());
    const caller = new AbortController();
    const request = fetchWithDeadline('/cancelled', {
      deadlineMs: 3_000,
      signal: caller.signal,
    });
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });

    caller.abort();

    await rejection;
  });

  it('rejects immediately when the caller signal is already aborted', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', abortAwarePendingFetch());
    const caller = new AbortController();
    caller.abort();

    await expect(
      fetchWithDeadline('/cancelled-before-start', {
        deadlineMs: 3_000,
        signal: caller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
