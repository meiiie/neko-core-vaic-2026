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
      email TEXT,
      google_sub TEXT,
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
      difficulty TEXT NOT NULL DEFAULT 'UNSPECIFIED',
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
      due_at TEXT,
      allow_retake INTEGER NOT NULL DEFAULT 1,
      shuffle_answers INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS assignment_views (
      assignment_id TEXT NOT NULL REFERENCES assignments(id),
      learner_id TEXT NOT NULL REFERENCES users(id),
      opened_at TEXT NOT NULL,
      PRIMARY KEY (assignment_id, learner_id)
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

  // Small additive migrations keep an existing event database usable during the UI refinement.
  const questionColumns = db.prepare('PRAGMA table_info(questions)').all() as { name: string }[];
  if (!questionColumns.some((column) => column.name === 'difficulty')) {
    db.exec("ALTER TABLE questions ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'UNSPECIFIED';");
  }
  const assignmentColumns = db.prepare('PRAGMA table_info(assignments)').all() as {
    name: string;
  }[];
  if (!assignmentColumns.some((column) => column.name === 'allow_retake')) {
    db.exec('ALTER TABLE assignments ADD COLUMN allow_retake INTEGER NOT NULL DEFAULT 1;');
  }
  if (!assignmentColumns.some((column) => column.name === 'shuffle_answers')) {
    db.exec('ALTER TABLE assignments ADD COLUMN shuffle_answers INTEGER NOT NULL DEFAULT 0;');
  }

  // Additive migration for databases created before email login existed.
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userColumns.some((column) => column.name === 'email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;',
  );
  return db;
}
