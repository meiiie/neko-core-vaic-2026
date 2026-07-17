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

export async function countEvents(database: NekoPathDb = db): Promise<number> {
  return database.events.count();
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
