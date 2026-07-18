import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NekoPathDb, type LearnerEventRecord } from '../storage/db';
import { appendEvent } from '../storage/event-repository';
import { duePendingOutbox, queueOutbox } from '../storage/outbox-repository';
import { flushOutbox, recordAnswer } from './sync';
import { bindBrowserProfile, markBrowserSignedOut } from './profile-binding';

function makeDb(): NekoPathDb {
  return new NekoPathDb(`nekopath-sync-${crypto.randomUUID()}`);
}

function makeEvent(
  id: string,
  sequence: number,
  learnerId = 'user-student-an',
): LearnerEventRecord {
  return {
    id,
    learnerId,
    itemId: 'K02-CHECK-1',
    sequence,
    occurredAt: '2026-07-17T09:00:00.000Z',
    kind: 'ANSWER',
    payload: '{"choiceId":"a","correct":true}',
  };
}

const AN_SESSION = {
  user: { id: 'user-student-an', role: 'STUDENT', learnerProfile: 'an' },
};

function withVerifiedAn(
  handleEvents: (init?: RequestInit) => Promise<Response> | Response,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/api/auth/me')) {
      return new Response(JSON.stringify(AN_SESSION), { status: 200 });
    }
    return handleEvents(init);
  });
}

describe('outbox sync bridge', () => {
  beforeEach(() => bindBrowserProfile('user-student-an'));
  afterEach(() => {
    markBrowserSignedOut();
    vi.unstubAllGlobals();
  });

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
      withVerifiedAn(async (init) => {
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
      withVerifiedAn(async () => new Response('{}', { status: 503 })),
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

  it('quarantines server-reported conflicts instead of marking them synced', async () => {
    const database = makeDb();
    await appendEvent(makeEvent('evt-ok', 1), database);
    await appendEvent(makeEvent('evt-clash', 2), database);
    await queueOutbox('evt-ok', database);
    await queueOutbox('evt-clash', database);
    vi.stubGlobal(
      'fetch',
      withVerifiedAn(
        async () =>
          new Response(JSON.stringify({ accepted: 1, conflictIds: ['evt-clash'], received: 2 }), {
            status: 200,
          }),
      ),
    );

    const result = await flushOutbox(database);
    expect(result).toEqual({ pushed: 1 });
    expect((await database.outbox.get('evt-ok'))?.status).toBe('SENT');
    expect((await database.outbox.get('evt-clash'))?.status).toBe('CONFLICT');
    // Conflicts are permanent: they never come due again.
    expect(await duePendingOutbox(new Date().toISOString(), database)).toHaveLength(0);
    await database.delete();
  });

  it("blocks a stale server session before posting another profile's events", async () => {
    const database = makeDb();
    await appendEvent(makeEvent('evt-chi', 1, 'user-student-chi'), database);
    await queueOutbox('evt-chi', database);
    bindBrowserProfile('user-student-chi');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(AN_SESSION), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await flushOutbox(database)).toEqual({ skipped: 'SESSION_MISMATCH' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await database.outbox.get('evt-chi'))?.status).toBe('PENDING');
    await database.delete();
  });

  it('syncs only events owned by the verified learner on a shared device', async () => {
    const database = makeDb();
    await appendEvent(makeEvent('evt-an', 1), database);
    await appendEvent(makeEvent('evt-chi', 1, 'user-student-chi'), database);
    await queueOutbox('evt-an', database);
    await queueOutbox('evt-chi', database);
    const posted: { events: { id: string }[] }[] = [];
    vi.stubGlobal(
      'fetch',
      withVerifiedAn(async (init) => {
        posted.push(JSON.parse(String(init?.body)) as { events: { id: string }[] });
        return new Response(JSON.stringify({ accepted: 1, received: 1 }), { status: 200 });
      }),
    );

    expect(await flushOutbox(database)).toEqual({ pushed: 1 });
    expect(posted[0].events.map((event) => event.id)).toEqual(['evt-an']);
    expect((await database.outbox.get('evt-an'))?.status).toBe('SENT');
    expect((await database.outbox.get('evt-chi'))?.status).toBe('PENDING');
    await database.delete();
  });

  it('syncs an account without a simulation profile by its stable user ID', async () => {
    const database = makeDb();
    const learnerId = 'user-student-7a-01';
    await appendEvent(makeEvent('evt-nonhero', 1, learnerId), database);
    await queueOutbox('evt-nonhero', database);
    bindBrowserProfile(learnerId);
    const posted: { events: { learnerId: string }[] }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/api/auth/me')) {
          return new Response(
            JSON.stringify({
              user: { id: learnerId, role: 'STUDENT', learnerProfile: null },
            }),
            { status: 200 },
          );
        }
        posted.push(JSON.parse(String(init?.body)) as { events: { learnerId: string }[] });
        return new Response(JSON.stringify({ accepted: 1, received: 1 }), { status: 200 });
      }),
    );

    expect(await flushOutbox(database)).toEqual({ pushed: 1 });
    expect(posted[0].events).toEqual([expect.objectContaining({ learnerId })]);
    await database.delete();
  });

  it('recordAnswer writes the event and its outbox row in one atomic call', async () => {
    const database = makeDb();
    markBrowserSignedOut();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })), // flush fails, rows must survive
    );

    expect(await recordAnswer(makeEvent('evt-atomic', 1), database)).toBe('APPENDED');
    expect(await database.events.get('evt-atomic')).toBeTruthy();
    expect((await database.outbox.get('evt-atomic'))?.status).toBe('PENDING');
    expect((await database.meta.get('lastLocalWriteAt'))?.value).toBe('2026-07-17T09:00:00.000Z');

    // Same ID again: idempotent, still exactly one event and one outbox row.
    expect(await recordAnswer(makeEvent('evt-atomic', 99), database)).toBe('DUPLICATE_IGNORED');
    expect(await database.events.count()).toBe(1);
    expect(await database.outbox.count()).toBe(1);
    await database.delete();
  });
});
