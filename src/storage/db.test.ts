import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { NekoPathDb, type LearnerEventRecord } from './db';
import { appendEvent, countEvents, listEventsByLearner, resetDemoData } from './event-repository';

function makeDb(): NekoPathDb {
  return new NekoPathDb(`nekopath-test-${crypto.randomUUID()}`);
}

function makeEvent(overrides: Partial<LearnerEventRecord> = {}): LearnerEventRecord {
  return {
    id: 'evt-1',
    learnerId: 'an',
    itemId: 'D02',
    sequence: 1,
    occurredAt: '2026-07-17T08:00:00.000Z',
    kind: 'ANSWER',
    payload: '{"answer":"6/8"}',
    ...overrides,
  };
}

describe('Dexie schema v2', () => {
  const dbs: NekoPathDb[] = [];

  afterEach(async () => {
    for (const database of dbs.splice(0)) {
      await database.delete();
    }
  });

  it('opens with the canonical event tables plus scoped agent sessions', async () => {
    const database = makeDb();
    dbs.push(database);
    await database.open();

    expect(database.verno).toBe(2);
    expect(database.tables.map((t) => t.name).sort()).toEqual([
      'agentSessions',
      'events',
      'meta',
      'outbox',
      'overrides',
    ]);
  });

  it('appends events, ignores duplicate IDs and lists in canonical order', async () => {
    const database = makeDb();
    dbs.push(database);

    expect(await appendEvent(makeEvent({ id: 'evt-2', sequence: 2 }), database)).toBe('APPENDED');
    expect(await appendEvent(makeEvent({ id: 'evt-1', sequence: 1 }), database)).toBe('APPENDED');
    expect(await appendEvent(makeEvent({ id: 'evt-1', sequence: 99 }), database)).toBe(
      'DUPLICATE_IGNORED',
    );

    const events = await listEventsByLearner('an', database);
    expect(events.map((e) => e.id)).toEqual(['evt-1', 'evt-2']);
    expect(await countEvents(database)).toBe(2);
  });

  it('resetDemoData clears events, overrides and outbox', async () => {
    const database = makeDb();
    dbs.push(database);

    await appendEvent(makeEvent(), database);
    await database.overrides.add({
      id: 'ovr-1',
      learnerId: 'an',
      targetKcId: 'K02',
      decision: 'CONFIRM_ROOT',
      updatedAt: '2026-07-17T08:05:00.000Z',
    });
    await database.outbox.add({
      eventId: 'evt-1',
      status: 'PENDING',
      createdAt: '2026-07-17T08:05:00.000Z',
      nextRetryAt: '2026-07-17T08:10:00.000Z',
    });

    await resetDemoData(database);

    expect(await database.events.count()).toBe(0);
    expect(await database.overrides.count()).toBe(0);
    expect(await database.outbox.count()).toBe(0);
    expect(await database.meta.get('lastDemoResetAt')).toBeTruthy();
  });
});
