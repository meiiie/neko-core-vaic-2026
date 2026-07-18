import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchServerEvidence } from './evidence-hydration';

const learnerId = 'user-student-an';
const event = (id: string, owner = learnerId) => ({
  id,
  learnerId: owner,
  itemId: 'K02-DIAGNOSTIC',
  sequence: 8,
  occurredAt: '2026-07-18T08:00:00.000Z',
  kind: 'ANSWER',
  payload: '{"choiceId":"a","correct":true}',
});

describe('server evidence hydration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('collects every page before admitting the complete snapshot', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.endsWith('offset=0')
            ? { events: [event('evt-1')], nextOffset: 200 }
            : { events: [event('evt-2')], nextOffset: null },
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchServerEvidence(learnerId)).resolves.toEqual({
      events: [event('evt-1'), event('evt-2')],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a cross-account row without returning a partial snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              events: [event('evt-owned'), event('evt-wrong-owner', 'user-student-chi')],
              nextOffset: null,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    await expect(fetchServerEvidence(learnerId)).resolves.toEqual({
      skipped: 'INVALID_RESPONSE',
    });
  });

  it('keeps local startup available when the server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network unavailable');
      }),
    );

    await expect(fetchServerEvidence(learnerId)).resolves.toEqual({ skipped: 'UNAVAILABLE' });
  });
});
