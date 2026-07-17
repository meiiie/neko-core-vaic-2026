import Dexie, { type Table } from 'dexie';

/**
 * Dexie/IndexedDB schema v1 (docs/IMPLEMENTATION_MASTER_PLAN.md §8).
 * Derived diagnoses/groups are intentionally NOT persisted: they are
 * recomputed from content + canonical events so stale derived state cannot
 * survive an algorithm update.
 */

export interface MetaRecord {
  /** e.g. 'dbSchemaVersion', 'contentVersion', 'algorithmVersion', 'demoSeed', 'lastLocalWriteAt' */
  key: string;
  value: string;
  updatedAt: string;
}

export interface LearnerEventRecord {
  /** Stable opaque ID; duplicates are ignored idempotently at the repository boundary. */
  id: string;
  learnerId: string;
  itemId: string;
  /** Monotonic per-learner ordering; inference orders by (sequence, occurredAt, id). */
  sequence: number;
  occurredAt: string;
  kind: string;
  /** Answer payload; interpreted by the domain lane, opaque to storage. */
  payload: string;
}

export interface OverrideRecord {
  id: string;
  learnerId: string;
  targetKcId: string;
  decision: string;
  updatedAt: string;
}

export interface OutboxRecord {
  eventId: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: string;
  nextRetryAt: string;
}

export const DB_NAME = 'nekopath';
export const DB_SCHEMA_VERSION = 1;

export class NekoPathDb extends Dexie {
  meta!: Table<MetaRecord, string>;
  events!: Table<LearnerEventRecord, string>;
  overrides!: Table<OverrideRecord, string>;
  outbox!: Table<OutboxRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(DB_SCHEMA_VERSION).stores({
      meta: 'key',
      events: 'id, [learnerId+sequence], learnerId, itemId, occurredAt',
      overrides: 'id, learnerId, targetKcId, updatedAt',
      outbox: 'eventId, status, createdAt, nextRetryAt',
    });
  }
}

/** Singleton database instance for the application. Tests construct their own. */
export const db = new NekoPathDb();
