import Dexie, { type Table } from 'dexie';
import type { TeacherDiagnosisOverride } from '../domain';

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

export interface OverrideRecord extends TeacherDiagnosisOverride {
  id: string;
  reason: string;
  updatedAt: string;
}

export interface OutboxRecord {
  eventId: string;
  /** CONFLICT: the server holds a different record under this ID; never retried, never shown as synced. */
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CONFLICT';
  createdAt: string;
  nextRetryAt: string;
}

/**
 * Local mirror of a server-owned lesson row, kept so students can read
 * materials offline. The server is the source of truth; the mirror refreshes
 * on app start and reconnect.
 */
export interface LessonRecord {
  kcId: string;
  title: string;
  keyPoints: string[];
  exampleProblem: string;
  exampleSteps: string[];
  commonMistake: string;
  status: 'DRAFT' | 'PUBLISHED';
  updatedAt: string;
  updatedByName: string | null;
}

export const DB_NAME = 'nekopath';
export const DB_SCHEMA_VERSION = 2;

export class NekoPathDb extends Dexie {
  meta!: Table<MetaRecord, string>;
  events!: Table<LearnerEventRecord, string>;
  overrides!: Table<OverrideRecord, string>;
  outbox!: Table<OutboxRecord, string>;
  lessons!: Table<LessonRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      meta: 'key',
      events: 'id, [learnerId+sequence], learnerId, itemId, occurredAt',
      overrides: 'id, learnerId, targetKcId, updatedAt',
      outbox: 'eventId, status, createdAt, nextRetryAt',
    });
    this.version(DB_SCHEMA_VERSION).stores({
      lessons: 'kcId',
    });
  }
}

/** Singleton database instance for the application. Tests construct their own. */
export const db = new NekoPathDb();
