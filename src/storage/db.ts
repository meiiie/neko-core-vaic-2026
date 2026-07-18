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

export interface AgentSessionRecord {
  id: string;
  accountId: string;
  role: 'teacher';
  classId: string | null;
  providerId: string;
  /** Canonical compacted capsule + recent tail; never provider credentials. */
  payload: string;
  updatedAt: string;
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

/** Metadata mirror of a server-owned learning resource (PDF / short video). */
export interface ResourceRecord {
  id: string;
  kcId: string;
  kind: 'PDF' | 'VIDEO';
  role: 'EXPLAIN' | 'WORKED_EXAMPLE' | 'SUMMARY';
  title: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number | null;
  transcriptVi: string | null;
  byteSize: number;
  sha256: string;
  sortOrder: number;
  status: 'DRAFT' | 'PUBLISHED';
  reviewState: 'UNREVIEWED' | 'ACCEPTED' | 'REVISE' | 'REJECTED';
  gradeMin: number;
  gradeMax: number;
  createdAt: string;
  uploadedByName: string | null;
  /** Probed on the teacher's device before upload; absent for pre-v0.10 rows. */
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  posterDataUrl?: string | null;
}

/**
 * Where this learner last stopped inside a video, per device. Local-first on
 * purpose: resume position is a device concern (like scroll position), so it
 * never rides the sync outbox or blocks on the network.
 */
export interface ResourceProgressRecord {
  /** `${learnerId}:${resourceId}` — progress is per learner even on shared devices. */
  id: string;
  learnerId: string;
  resourceId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

export const DB_NAME = 'nekopath';
export const DB_SCHEMA_VERSION = 5;

export class NekoPathDb extends Dexie {
  meta!: Table<MetaRecord, string>;
  events!: Table<LearnerEventRecord, string>;
  overrides!: Table<OverrideRecord, string>;
  outbox!: Table<OutboxRecord, string>;
  agentSessions!: Table<AgentSessionRecord, string>;
  lessons!: Table<LessonRecord, string>;
  resources!: Table<ResourceRecord, string>;
  resourceProgress!: Table<ResourceProgressRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      meta: 'key',
      events: 'id, [learnerId+sequence], learnerId, itemId, occurredAt',
      overrides: 'id, learnerId, targetKcId, updatedAt',
      outbox: 'eventId, status, createdAt, nextRetryAt',
    });
    this.version(2).stores({
      lessons: 'kcId',
    });
    this.version(3).stores({
      agentSessions: 'id, accountId, providerId, updatedAt',
    });
    // v4: devices that already opened v3 (agent sessions only) still gain the
    // resource mirror through a separate upgrade step.
    this.version(4).stores({
      resources: 'id, kcId',
    });
    // v5: richer resource indexes for the curated library plus per-learner
    // video resume positions. Non-indexed fields (duration, poster) need no
    // schema entry — Dexie stores them as-is.
    this.version(DB_SCHEMA_VERSION).stores({
      resources: 'id, kcId, status, reviewState, sortOrder',
      resourceProgress: 'id, [learnerId+resourceId]',
    });
  }
}

/** Singleton database instance for the application. Tests construct their own. */
export const db = new NekoPathDb();
