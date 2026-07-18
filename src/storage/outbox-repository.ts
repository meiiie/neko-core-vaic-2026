import { db, type NekoPathDb, type OutboxRecord } from './db';

/**
 * Outbox boundary (LMS_hohulili sync pattern, simplified): every locally
 * recorded learning event is queued here; a flush pushes pending rows to the
 * server in batches. Server inserts are idempotent by event ID, so retries
 * can never double-count. Failures back off exponentially via nextRetryAt.
 */

export interface OutboxRow extends OutboxRecord {
  attempts?: number;
}

export async function queueOutbox(eventId: string, database: NekoPathDb = db): Promise<void> {
  const now = new Date().toISOString();
  try {
    await database.outbox.add({
      eventId,
      status: 'PENDING',
      createdAt: now,
      nextRetryAt: now,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ConstraintError') return; // already queued
    throw error;
  }
}

export async function duePendingOutbox(
  nowIso: string,
  database: NekoPathDb = db,
): Promise<OutboxRow[]> {
  const rows = (await database.outbox.where('status').equals('PENDING').toArray()) as OutboxRow[];
  return rows.filter((row) => row.nextRetryAt <= nowIso);
}

export async function markOutboxSent(
  eventIds: readonly string[],
  database: NekoPathDb = db,
): Promise<void> {
  await database.transaction('rw', [database.outbox, database.meta], async () => {
    for (const eventId of eventIds) {
      await database.outbox.update(eventId, { status: 'SENT' });
    }
    await database.meta.put({
      key: 'lastSyncedAt',
      value: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * The server refused these IDs permanently (same ID, different content).
 * They must stop retrying — a CONFLICT row is visible on the system page,
 * never silently dropped and never counted as synced.
 */
export async function markOutboxConflict(
  eventIds: readonly string[],
  database: NekoPathDb = db,
): Promise<void> {
  if (eventIds.length === 0) return;
  await database.transaction('rw', [database.outbox], async () => {
    for (const eventId of eventIds) {
      await database.outbox.update(eventId, { status: 'CONFLICT' });
    }
  });
}

export async function markOutboxRetry(
  rows: readonly OutboxRow[],
  database: NekoPathDb = db,
): Promise<void> {
  for (const row of rows) {
    const attempts = (row.attempts ?? 0) + 1;
    // Exponential backoff capped at 5 minutes: 5s, 10s, 20s, 40s, ...
    const delayMs = Math.min(5_000 * 2 ** (attempts - 1), 300_000);
    await database.outbox.update(row.eventId, {
      attempts,
      nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
    } as Partial<OutboxRow>);
  }
}

export async function pendingOutboxCount(database: NekoPathDb = db): Promise<number> {
  return database.outbox.where('status').equals('PENDING').count();
}
