import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LearnerEventRecord, type NekoPathDb } from '../storage/db';
import {
  duePendingOutbox,
  markOutboxRetry,
  markOutboxSent,
  queueOutbox,
} from '../storage/outbox-repository';

/**
 * Local-first sync bridge (deep-referenced from LMS_hohulili's
 * offline-sync.service): learning continues fully offline; queued events are
 * pushed to /api/events when connectivity allows. Triggers mirror the LMS:
 * app start, browser 'online', tab becoming visible, and manual retry. The
 * server ignores duplicate event IDs, so a retried batch is harmless.
 */

let flushInFlight = false;

export async function flushOutbox(
  database: NekoPathDb = db,
): Promise<{ pushed: number } | { skipped: string }> {
  if (flushInFlight) return { skipped: 'IN_FLIGHT' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { skipped: 'OFFLINE' };
  }
  flushInFlight = true;
  try {
    const due = await duePendingOutbox(new Date().toISOString(), database);
    if (due.length === 0) return { pushed: 0 };
    const events = (await Promise.all(due.map((row) => database.events.get(row.eventId)))).filter(
      (event): event is LearnerEventRecord => event !== undefined,
    );
    if (events.length === 0) {
      await markOutboxSent(
        due.map((row) => row.eventId),
        database,
      );
      return { pushed: 0 };
    }
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          events: events.map((event) => ({
            id: event.id,
            itemId: event.itemId,
            sequence: event.sequence,
            occurredAt: event.occurredAt,
            kind: event.kind,
            payload: event.payload,
          })),
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      await markOutboxSent(
        due.map((row) => row.eventId),
        database,
      );
      return { pushed: events.length };
    } catch {
      await markOutboxRetry(due, database);
      return { skipped: 'PUSH_FAILED' };
    }
  } finally {
    flushInFlight = false;
  }
}

/** Record a local answer AND queue it for server sync in one call. */
export async function queueEventForSync(
  record: LearnerEventRecord,
  database: NekoPathDb = db,
): Promise<void> {
  await queueOutbox(record.id, database);
  void flushOutbox(database);
}

let triggersRegistered = false;

/** Idempotent global trigger registration (called from the app shell). */
export function registerSyncTriggers(): void {
  if (triggersRegistered || typeof window === 'undefined') return;
  triggersRegistered = true;
  window.addEventListener('online', () => void flushOutbox());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  });
  void flushOutbox();
}

export interface SyncStatus {
  pendingCount: number;
  lastSyncedAt: string | null;
}

/** Live sync status for status bars and the system page. */
export function useSyncStatus(): SyncStatus | undefined {
  return useLiveQuery(async () => {
    const pendingCount = await db.outbox.where('status').equals('PENDING').count();
    const meta = await db.meta.get('lastSyncedAt');
    return { pendingCount, lastSyncedAt: meta?.value ?? null };
  }, []);
}
