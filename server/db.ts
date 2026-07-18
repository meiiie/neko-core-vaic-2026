import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite persistence via Node 24's built-in driver — no native dependency.
 * SQLite is the server authority for identity, authored questions,
 * assignments, answer evidence and teacher adjustments. The client may cache
 * data for resilience, but it must not invent teacher-facing evidence.
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
      teacher_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'Toán',
      school_year TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
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
      shuffle_answers INTEGER NOT NULL DEFAULT 0,
      recipient_ids_json TEXT NOT NULL DEFAULT '[]',
      teacher_message TEXT NOT NULL DEFAULT ''
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
    CREATE TABLE IF NOT EXISTS teacher_overrides (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      class_id TEXT NOT NULL REFERENCES classes(id),
      learner_id TEXT NOT NULL REFERENCES users(id),
      target_kc_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('SET_ROOT','NEEDS_MORE_EVIDENCE')),
      root_kc_id TEXT,
      reason TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_teacher_overrides_lookup
      ON teacher_overrides(class_id, learner_id, target_kc_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS lessons (
      kc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      key_points_json TEXT NOT NULL,
      example_problem TEXT NOT NULL,
      example_steps_json TEXT NOT NULL,
      common_mistake TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      event_id TEXT NOT NULL,
      learner_id TEXT NOT NULL,
      server_fingerprint TEXT NOT NULL,
      client_fingerprint TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      PRIMARY KEY (event_id, client_fingerprint)
    );
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
  if (!assignmentColumns.some((column) => column.name === 'recipient_ids_json')) {
    db.exec("ALTER TABLE assignments ADD COLUMN recipient_ids_json TEXT NOT NULL DEFAULT '[]';");
  }
  if (!assignmentColumns.some((column) => column.name === 'teacher_message')) {
    db.exec("ALTER TABLE assignments ADD COLUMN teacher_message TEXT NOT NULL DEFAULT '';");
  }

  const classColumns = db.prepare('PRAGMA table_info(classes)').all() as { name: string }[];
  if (!classColumns.some((column) => column.name === 'teacher_id')) {
    db.exec('ALTER TABLE classes ADD COLUMN teacher_id TEXT;');
  }
  if (!classColumns.some((column) => column.name === 'subject')) {
    db.exec("ALTER TABLE classes ADD COLUMN subject TEXT NOT NULL DEFAULT 'Toán';");
  }
  if (!classColumns.some((column) => column.name === 'school_year')) {
    db.exec("ALTER TABLE classes ADD COLUMN school_year TEXT NOT NULL DEFAULT '';");
  }
  if (!classColumns.some((column) => column.name === 'created_at')) {
    db.exec("ALTER TABLE classes ADD COLUMN created_at TEXT NOT NULL DEFAULT '';");
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id, created_at);');

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
