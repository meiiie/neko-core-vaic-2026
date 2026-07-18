import { z } from 'zod';
import { db, type LearnerEventRecord, type NekoPathDb } from './db';

/**
 * Repository boundary over Dexie (docs/IMPLEMENTATION_MASTER_PLAN.md §8).
 * Events are append-only; duplicate IDs are ignored idempotently.
 * Zod validates records at this boundary only — not inside UI components.
 */

export const learnerEventSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  itemId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().min(1),
  kind: z.string().min(1),
  payload: z.string(),
});

export type AppendResult = 'APPENDED' | 'DUPLICATE_IGNORED';

export async function appendEvent(
  event: LearnerEventRecord,
  database: NekoPathDb = db,
): Promise<AppendResult> {
  const parsed = learnerEventSchema.parse(event);
  try {
    await database.events.add(parsed);
    await database.meta.put({
      key: 'lastLocalWriteAt',
      value: parsed.occurredAt,
      updatedAt: new Date().toISOString(),
    });
    return 'APPENDED';
  } catch (error) {
    if (error instanceof Error && error.name === 'ConstraintError') {
      return 'DUPLICATE_IGNORED';
    }
    throw error;
  }
}

export async function listEventsByLearner(
  learnerId: string,
  database: NekoPathDb = db,
): Promise<LearnerEventRecord[]> {
  const rows = await database.events.where('learnerId').equals(learnerId).toArray();
  // Canonical order for inference: (sequence, occurredAt, id).
  return rows.sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Move records written by older builds under a simulation-profile key to the
 * student's stable account key. Event IDs and outbox references stay intact.
 */
export async function migrateLearnerEvents(
  legacyLearnerId: string,
  learnerId: string,
  database: NekoPathDb = db,
): Promise<number> {
  if (!legacyLearnerId || legacyLearnerId === learnerId) return 0;
  return database.transaction('rw', database.events, async () => {
    const rows = await database.events.where('learnerId').equals(legacyLearnerId).toArray();
    await Promise.all(rows.map((row) => database.events.update(row.id, { learnerId })));
    return rows.length;
  });
}

/** Merge validated server history without overwriting local append-only rows. */
export async function mergeServerEvents(
  learnerId: string,
  records: readonly LearnerEventRecord[],
  database: NekoPathDb = db,
): Promise<number> {
  const parsed = z.array(learnerEventSchema).parse(records);
  if (parsed.some((record) => record.learnerId !== learnerId)) {
    throw new Error('EVENT_ACCOUNT_MISMATCH');
  }
  return database.transaction('rw', [database.events, database.meta], async () => {
    const existing = await database.events.bulkGet(parsed.map((record) => record.id));
    const missing = parsed.filter((_, index) => existing[index] === undefined);
    if (missing.length > 0) await database.events.bulkAdd(missing);
    const now = new Date().toISOString();
    await database.meta.bulkPut([
      { key: `lastServerHydratedAt:${learnerId}`, value: now, updatedAt: now },
      { key: 'lastSyncedAt', value: now, updatedAt: now },
    ]);
    return missing.length;
  });
}

export async function countEvents(database: NekoPathDb = db): Promise<number> {
  return database.events.count();
}

export async function listAllEvents(database: NekoPathDb = db): Promise<LearnerEventRecord[]> {
  const rows = await database.events.toArray();
  return rows.sort(
    (a, b) =>
      a.learnerId.localeCompare(b.learnerId) ||
      a.sequence - b.sequence ||
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Reset the synthetic demo data. This clears learner events, teacher
 * overrides and the outbox. It never touches anything outside this app's
 * own IndexedDB database.
 */
export async function resetDemoData(database: NekoPathDb = db): Promise<void> {
  await database.transaction(
    'rw',
    [database.events, database.overrides, database.outbox, database.meta],
    async () => {
      await database.events.clear();
      await database.overrides.clear();
      await database.outbox.clear();
      await database.meta.put({
        key: 'lastDemoResetAt',
        value: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },
  );
}
