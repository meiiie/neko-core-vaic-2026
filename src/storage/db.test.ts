import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { NekoPathDb, type LearnerEventRecord } from './db';
import {
  appendEvent,
  countEvents,
  listEventsByLearner,
  migrateLearnerEvents,
  resetDemoData,
} from './event-repository';
import { appendTeacherOverride, listLatestTeacherOverrides } from './override-repository';

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

describe('Dexie schema v1', () => {
  const dbs: NekoPathDb[] = [];

  afterEach(async () => {
    for (const database of dbs.splice(0)) {
      await database.delete();
    }
  });

  it('opens with the four v1 tables', async () => {
    const database = makeDb();
    dbs.push(database);
    await database.open();

    expect(database.verno).toBe(1);
    expect(database.tables.map((t) => t.name).sort()).toEqual([
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

  it('migrates legacy profile-keyed events without changing event or outbox IDs', async () => {
    const database = makeDb();
    dbs.push(database);
    await appendEvent(makeEvent({ id: 'legacy-event', learnerId: 'an' }), database);
    await database.outbox.add({
      eventId: 'legacy-event',
      status: 'PENDING',
      createdAt: '2026-07-17T08:00:00.000Z',
      nextRetryAt: '2026-07-17T08:00:00.000Z',
    });

    expect(await migrateLearnerEvents('an', 'user-student-an', database)).toBe(1);
    expect(await listEventsByLearner('an', database)).toEqual([]);
    expect(await listEventsByLearner('user-student-an', database)).toEqual([
      expect.objectContaining({ id: 'legacy-event', learnerId: 'user-student-an' }),
    ]);
    expect(await database.outbox.get('legacy-event')).toMatchObject({ eventId: 'legacy-event' });
  });

  it('resetDemoData clears events, overrides and outbox', async () => {
    const database = makeDb();
    dbs.push(database);

    await appendEvent(makeEvent(), database);
    await database.overrides.add({
      id: 'ovr-1',
      learnerId: 'an',
      targetKcId: 'K02',
      decision: 'SET_ROOT',
      rootKcId: 'K02',
      reason: 'Giáo viên đã kiểm tra bài làm trực tiếp.',
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

  it('keeps append-only override history and returns the latest decision', async () => {
    const database = makeDb();
    dbs.push(database);

    await appendTeacherOverride(
      {
        id: 'ovr-old',
        learnerId: 'hs-01',
        targetKcId: 'K10',
        decision: 'SET_ROOT',
        rootKcId: 'K02',
        reason: 'Bằng chứng đầu tiên từ bài làm.',
        updatedAt: '2026-07-18T08:00:00.000Z',
      },
      database,
    );
    await appendTeacherOverride(
      {
        id: 'ovr-new',
        learnerId: 'hs-01',
        targetKcId: 'K10',
        decision: 'NEEDS_MORE_EVIDENCE',
        reason: 'Cần hỏi trực tiếp học sinh thêm một câu.',
        updatedAt: '2026-07-18T09:00:00.000Z',
      },
      database,
    );

    expect(await database.overrides.count()).toBe(2);
    expect(await listLatestTeacherOverrides(database)).toEqual([
      expect.objectContaining({ id: 'ovr-new', decision: 'NEEDS_MORE_EVIDENCE' }),
    ]);
  });
});
