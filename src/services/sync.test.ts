import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NekoPathDb, type LearnerEventRecord } from '../storage/db';
import { appendEvent } from '../storage/event-repository';
import { duePendingOutbox, queueOutbox } from '../storage/outbox-repository';
import { flushOutbox } from './sync';

function makeDb(): NekoPathDb {
  return new NekoPathDb(`nekopath-sync-${crypto.randomUUID()}`);
}

function makeEvent(id: string, sequence: number): LearnerEventRecord {
  return {
    id,
    learnerId: 'an',
    itemId: 'K02-CHECK-1',
    sequence,
    occurredAt: '2026-07-17T09:00:00.000Z',
    kind: 'ANSWER',
    payload: '{"choiceId":"a","correct":true}',
  };
}

describe('outbox sync bridge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pushes queued events and records lastSyncedAt', async () => {
    const database = makeDb();
    await appendEvent(makeEvent('evt-1', 1), database);
    await appendEvent(makeEvent('evt-2', 2), database);
    await queueOutbox('evt-1', database);
    await queueOutbox('evt-1', database); // duplicate queue is a no-op
    await queueOutbox('evt-2', database);

    const posted: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        posted.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ accepted: 2, received: 2 }), { status: 200 });
      }),
    );

    const result = await flushOutbox(database);
    expect(result).toEqual({ pushed: 2 });
    expect(posted).toHaveLength(1);
    expect(await database.outbox.where('status').equals('PENDING').count()).toBe(0);
    expect(await database.meta.get('lastSyncedAt')).toBeTruthy();
    await database.delete();
  });

  it('backs off with a future nextRetryAt when the push fails', async () => {
    const database = makeDb();
    await appendEvent(makeEvent('evt-9', 1), database);
    await queueOutbox('evt-9', database);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    );

    const result = await flushOutbox(database);
    expect(result).toEqual({ skipped: 'PUSH_FAILED' });
    const stillPending = await database.outbox.where('status').equals('PENDING').toArray();
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0].nextRetryAt > new Date().toISOString()).toBe(true);
    // Not yet due, so an immediate second flush pushes nothing.
    expect(await duePendingOutbox(new Date().toISOString(), database)).toHaveLength(0);
    await database.delete();
  });
});
