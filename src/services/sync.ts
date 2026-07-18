import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LearnerEventRecord, type NekoPathDb } from '../storage/db';
import { reviewScheduleEventId } from '../domain';
import { learnerEventSchema, type AppendResult } from '../storage/event-repository';
import { fetchWithDeadline } from './fetch-with-deadline';
import { refreshLessons } from './lessons';
import { reviewSchedulePayloadSchema } from '../storage/review-schedule-repository';
import { refreshResources } from './resources';
import { readBoundProfileId, SIGNED_OUT_PROFILE } from './profile-binding';
import {
  duePendingOutbox,
  markOutboxConflict,
  markOutboxRetry,
  markOutboxSent,
} from '../storage/outbox-repository';

/**
 * Local-first sync bridge (deep-referenced from LMS_hohulili's
 * offline-sync.service): learning continues fully offline; queued events are
 * pushed to /api/events when connectivity allows. Triggers mirror the LMS:
 * app start, browser 'online', tab becoming visible, and manual retry. The
 * server ignores duplicate event IDs, so a retried batch is harmless.
 */

let flushInFlight = false;
const SESSION_CHECK_DEADLINE_MS = 3_000;

interface SyncSessionUser {
  readonly id: string;
  readonly role: 'STUDENT' | 'TEACHER';
  readonly learnerProfile: string | null;
}

async function verifiedSyncUser(): Promise<
  | { user: SyncSessionUser }
  | { skipped: 'PROFILE_UNBOUND' | 'SESSION_MISMATCH' | 'AUTH_UNVERIFIED' }
> {
  const boundProfileId = readBoundProfileId();
  if (!boundProfileId) return { skipped: 'PROFILE_UNBOUND' };
  if (boundProfileId === SIGNED_OUT_PROFILE) return { skipped: 'SESSION_MISMATCH' };

  try {
    const response = await fetchWithDeadline('/api/auth/me', {
      credentials: 'include',
      deadlineMs: SESSION_CHECK_DEADLINE_MS,
    });
    if (!response.ok) {
      return {
        skipped:
          response.status === 401 || response.status === 409
            ? 'SESSION_MISMATCH'
            : 'AUTH_UNVERIFIED',
      };
    }
    const body = (await response.json()) as { user?: Partial<SyncSessionUser> };
    if (
      body.user?.id !== boundProfileId ||
      (body.user.role !== 'STUDENT' && body.user.role !== 'TEACHER') ||
      (body.user.learnerProfile !== null && typeof body.user.learnerProfile !== 'string')
    ) {
      return { skipped: 'SESSION_MISMATCH' };
    }
    return { user: body.user as SyncSessionUser };
  } catch {
    return { skipped: 'AUTH_UNVERIFIED' };
  }
}

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
    const verified = await verifiedSyncUser();
    if ('skipped' in verified) return verified;
    if (verified.user.role !== 'STUDENT') return { skipped: 'NOT_A_STUDENT' };
    const learnerId = verified.user.id;
    const matchingEvents = events.filter((event) => event.learnerId === learnerId);
    if (matchingEvents.length === 0) return { skipped: 'NO_DUE_EVENTS_FOR_ACCOUNT' };
    const matchingIds = new Set(matchingEvents.map((event) => event.id));
    const matchingDue = due.filter((row) => matchingIds.has(row.eventId));
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          events: matchingEvents.map((event) => ({
            id: event.id,
            learnerId: event.learnerId,
            itemId: event.itemId,
            sequence: event.sequence,
            occurredAt: event.occurredAt,
            kind: event.kind,
            payload: event.payload,
          })),
        }),
      });
      if (response.status === 401 || response.status === 403 || response.status === 409) {
        return { skipped: 'SESSION_MISMATCH' };
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json().catch(() => ({}))) as { conflictIds?: string[] };
      const conflictIds = new Set(body.conflictIds ?? []);
      await markOutboxConflict([...conflictIds], database);
      await markOutboxSent(
        matchingDue.map((row) => row.eventId).filter((id) => !conflictIds.has(id)),
        database,
      );
      return { pushed: matchingEvents.length - conflictIds.size };
    } catch {
      await markOutboxRetry(matchingDue, database);
      return { skipped: 'PUSH_FAILED' };
    }
  } finally {
    flushInFlight = false;
  }
}

/**
 * Record a local answer AND queue it for server sync atomically: the event,
 * the freshness marker and the outbox row commit in ONE IndexedDB
 * transaction, so a crash between "saved" and "queued" cannot silently lose
 * the event from sync (plan §27.2). Duplicate IDs stay idempotent.
 */
export async function recordAnswer(
  record: LearnerEventRecord,
  database: NekoPathDb = db,
): Promise<AppendResult> {
  return recordLocalEventBundle([record], database);
}

async function recordLocalEventBundle(
  records: readonly LearnerEventRecord[],
  database: NekoPathDb,
): Promise<AppendResult> {
  const parsedRecords = records.map((record) => learnerEventSchema.parse(record));
  if (parsedRecords.length === 0) throw new Error('At least one local event is required');
  const now = new Date().toISOString();
  const result = await database.transaction(
    'rw',
    [database.events, database.outbox, database.meta],
    async (): Promise<AppendResult> => {
      let appended = false;
      for (const parsed of parsedRecords) {
        try {
          await database.events.add(parsed);
          appended = true;
        } catch (error) {
          if (!(error instanceof Error && error.name === 'ConstraintError')) throw error;
        }
        try {
          await database.outbox.add({
            eventId: parsed.id,
            status: 'PENDING',
            createdAt: now,
            nextRetryAt: now,
          });
        } catch (error) {
          if (!(error instanceof Error && error.name === 'ConstraintError')) throw error;
        }
      }
      await database.meta.put({
        key: 'lastLocalWriteAt',
        value: parsedRecords.at(-1)?.occurredAt ?? now,
        updatedAt: now,
      });
      return appended ? 'APPENDED' : 'DUPLICATE_IGNORED';
    },
  );
  void flushOutbox(database);
  return result;
}

/** Atomically persist an answer and its versioned review schedule for offline sync. */
export async function recordAnswerWithReview(
  answer: LearnerEventRecord,
  review: LearnerEventRecord,
  database: NekoPathDb = db,
): Promise<AppendResult> {
  if (
    answer.learnerId !== review.learnerId ||
    answer.itemId !== review.itemId ||
    answer.occurredAt !== review.occurredAt ||
    review.id !== reviewScheduleEventId(answer.id) ||
    review.kind !== 'REVIEW_SCHEDULED' ||
    review.sequence !== answer.sequence + 1
  ) {
    throw new Error('INVALID_REVIEW_EVENT_LINK');
  }
  const payload = reviewSchedulePayloadSchema.parse(JSON.parse(review.payload));
  if (payload.sourceEventId !== answer.id) throw new Error('INVALID_REVIEW_EVENT_SOURCE');
  return recordLocalEventBundle([answer, review], database);
}

/**
 * Persist an answer the assignment API has already accepted. It must become
 * local diagnosis evidence, but must not be queued back to the server as a
 * second write.
 */
export async function recordConfirmedAnswer(
  record: LearnerEventRecord,
  database: NekoPathDb = db,
): Promise<AppendResult> {
  return recordConfirmedEventBundle([record], database);
}

async function recordConfirmedEventBundle(
  records: readonly LearnerEventRecord[],
  database: NekoPathDb,
): Promise<AppendResult> {
  const parsedRecords = records.map((record) => learnerEventSchema.parse(record));
  let appended = false;
  await database.transaction('rw', [database.events, database.meta], async () => {
    for (const record of parsedRecords) {
      try {
        await database.events.add(record);
        appended = true;
      } catch (error) {
        if (!(error instanceof Error && error.name === 'ConstraintError')) throw error;
      }
    }
    const now = new Date().toISOString();
    await database.meta.put({ key: 'lastSyncedAt', value: now, updatedAt: now });
  });
  return appended ? 'APPENDED' : 'DUPLICATE_IGNORED';
}

/** Mirror a server-committed answer and schedule without queueing either back to the server. */
export async function recordConfirmedAnswerWithReview(
  answer: LearnerEventRecord,
  review: LearnerEventRecord,
  database: NekoPathDb = db,
): Promise<AppendResult> {
  const payload = reviewSchedulePayloadSchema.parse(JSON.parse(review.payload));
  if (
    answer.learnerId !== review.learnerId ||
    answer.itemId !== review.itemId ||
    answer.occurredAt !== review.occurredAt ||
    review.id !== reviewScheduleEventId(answer.id) ||
    review.kind !== 'REVIEW_SCHEDULED' ||
    review.sequence !== answer.sequence + 1 ||
    payload.sourceEventId !== answer.id
  ) {
    throw new Error('INVALID_CONFIRMED_REVIEW_EVENT');
  }
  return recordConfirmedEventBundle([answer, review], database);
}

let triggersRegistered = false;

/** Idempotent global trigger registration (called from the app shell). */
export function registerSyncTriggers(): void {
  if (triggersRegistered || typeof window === 'undefined') return;
  triggersRegistered = true;
  window.addEventListener('online', () => {
    void flushOutbox();
    void refreshLessons();
    void refreshResources();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  });
  void flushOutbox();
  void refreshLessons();
  void refreshResources();
}

export interface SyncStatus {
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
}

/** Live sync status for status bars and the system page. */
export function useSyncStatus(): SyncStatus | undefined {
  return useLiveQuery(async () => {
    const pendingCount = await db.outbox.where('status').equals('PENDING').count();
    const conflictCount = await db.outbox.where('status').equals('CONFLICT').count();
    const meta = await db.meta.get('lastSyncedAt');
    return { pendingCount, conflictCount, lastSyncedAt: meta?.value ?? null };
  }, []);
}
