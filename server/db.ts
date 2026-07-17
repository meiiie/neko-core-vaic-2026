import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite persistence via Node 24's built-in driver — no native dependency.
 * The browser stays the runtime of record for diagnosis (local-first, per the
 * organizer's offline constraint); this database owns identity, authored
 * questions, assignments and the synced event log.
 */

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('STUDENT','TEACHER')),
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      short_name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      learner_profile TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      class_id TEXT NOT NULL REFERENCES classes(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (class_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      kc_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      correct_choice_id TEXT NOT NULL,
      hints_json TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL DEFAULT '',
      review_state TEXT NOT NULL DEFAULT 'UNREVIEWED',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id),
      teacher_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      question_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      due_at TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      learner_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      assignment_id TEXT,
      sequence INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_learner ON events(learner_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_events_assignment ON events(assignment_id);
  `);
  return db;
}
