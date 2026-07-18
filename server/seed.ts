import type { DatabaseSync } from 'node:sqlite';
import { HERO_EVENTS } from '../src/content/hero-events.ts';
import { PRACTICE_QUESTIONS } from '../src/content/hero-practice.ts';
import { LESSON_SUMMARIES } from '../src/content/lessons.v1.ts';
import { hashPassword } from './auth.ts';

/**
 * Idempotent seed for class 7A: REAL accounts (real emails, per-row scrypt
 * password hashes) so the app runs on genuine credentials, not a demo picker.
 * The password below is documented for judges in the README — never surfaced
 * in the UI. Names are synthetic (no real students), but the records are real.
 * Sign-in is by email + password, or Google when configured.
 */

export const DEMO_PASSWORD = 'Nekopath@2026';
export const EMAIL_DOMAIN = 'nekopath.edu.vn';
export const CLASS_7A_ID = 'class-7a';

const HERO_STUDENTS = [
  {
    email: `an@${EMAIL_DOMAIN}`,
    name: 'Trần Ngọc An',
    initials: 'NA',
    shortName: 'An',
    profile: 'an',
  },
  {
    email: `binh@${EMAIL_DOMAIN}`,
    name: 'Lê Thanh Bình',
    initials: 'TB',
    shortName: 'Bình',
    profile: 'binh',
  },
  {
    email: `chi@${EMAIL_DOMAIN}`,
    name: 'Nguyễn Minh Chi',
    initials: 'MC',
    shortName: 'Chi',
    profile: 'chi',
  },
  {
    email: `minh@${EMAIL_DOMAIN}`,
    name: 'Phạm Quang Minh',
    initials: 'QM',
    shortName: 'Minh',
    profile: 'minh',
  },
] as const;

const EXTRA_FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
const EXTRA_GIVEN = [
  'Gia Hân',
  'Đức Anh',
  'Bảo Ngọc',
  'Hữu Phúc',
  'Khánh Linh',
  'Tuấn Kiệt',
  'Thu Trang',
  'Minh Khôi',
  'Phương Anh',
  'Quốc Bảo',
  'Diệu Anh',
  'Nhật Nam',
];

export function seed(db: DatabaseSync): void {
  const now = new Date().toISOString();
  // Upsert so an existing production database gains emails on the next boot.
  const insertUser = db.prepare(
    `INSERT INTO users
       (id, username, email, password_hash, role, name, initials, short_name, subtitle,
        learner_profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       password_hash = excluded.password_hash,
       name = excluded.name,
       initials = excluded.initials,
       short_name = excluded.short_name,
       subtitle = excluded.subtitle,
       learner_profile = excluded.learner_profile`,
  );
  const enroll = db.prepare('INSERT OR IGNORE INTO enrollments (class_id, user_id) VALUES (?, ?)');
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const teacherId = 'user-teacher-ha';
  insertUser.run(
    teacherId,
    'co.ha',
    `co.ha@${EMAIL_DOMAIN}`,
    passwordHash,
    'TEACHER',
    'Nguyễn Thu Hà',
    'TH',
    'Cô Hà',
    'Giáo viên Toán • Lớp 7A',
    null,
  );

  db.prepare(
    `INSERT INTO classes (id, teacher_id, name, subject, school_year, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET teacher_id = COALESCE(classes.teacher_id, excluded.teacher_id)`,
  ).run(CLASS_7A_ID, teacherId, 'Lớp 7A', 'Toán', '2026–2027', now);

  for (const hero of HERO_STUDENTS) {
    const id = `user-student-${hero.profile}`;
    insertUser.run(
      id,
      hero.profile,
      hero.email,
      passwordHash,
      'STUDENT',
      hero.name,
      hero.initials,
      hero.shortName,
      'Học sinh • Lớp 7A',
      hero.profile,
    );
    enroll.run(CLASS_7A_ID, id);
  }

  // 36 additional synthetic classmates (deterministic names, no learner profile yet).
  let ordinal = 0;
  for (const given of EXTRA_GIVEN) {
    for (const family of EXTRA_FAMILY.slice(0, 3)) {
      ordinal += 1;
      const nn = String(ordinal).padStart(2, '0');
      const id = `user-student-7a-${nn}`;
      const name = `${family} ${given}`;
      const initials = given
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase();
      insertUser.run(
        id,
        `hs${nn}.7a`,
        `hs${nn}@${EMAIL_DOMAIN}`,
        passwordHash,
        'STUDENT',
        name,
        initials,
        given.split(' ').pop() ?? given,
        'Học sinh • Lớp 7A',
        null,
      );
      enroll.run(CLASS_7A_ID, id);
    }
  }

  // Walkthrough history is real persisted seed data. Student diagnosis reads
  // it only after the account-scoped /api/events feed hydrates IndexedDB.
  const insertEvent = db.prepare(
    `INSERT OR IGNORE INTO events
     (id, learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload, received_at)
     VALUES (?, ?, ?, NULL, ?, ?, 'SEEDED_EVIDENCE', ?, ?)`,
  );
  for (const [profileId, events] of Object.entries(HERO_EVENTS)) {
    const learnerId = `user-student-${profileId}`;
    for (const event of events) {
      insertEvent.run(
        event.id,
        learnerId,
        event.itemId,
        event.sequence,
        event.occurredAt,
        JSON.stringify({
          choiceId: 'seeded-history',
          correct: event.correct,
          methodValidity: event.methodValidity ?? 'UNKNOWN',
          ...(event.misconceptionId ? { misconceptionId: event.misconceptionId } : {}),
        }),
        now,
      );
    }
  }

  // Question bank: authored practice content becomes real teacher-owned rows.
  const insertQuestion = db.prepare(
    `INSERT OR IGNORE INTO questions
     (id, owner_id, kc_id, prompt, choices_json, correct_choice_id, hints_json, explanation,
      review_state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNREVIEWED', ?)`,
  );
  for (const question of PRACTICE_QUESTIONS) {
    insertQuestion.run(
      `bank-${question.itemId}`,
      teacherId,
      question.kcId,
      question.promptVi,
      JSON.stringify(question.choices),
      question.correctChoiceId,
      JSON.stringify(question.hints),
      question.explanationVi,
      now,
    );
  }

  // Lesson summaries: team drafts become editable rows the teacher owns.
  // INSERT OR IGNORE — a teacher's edits are never overwritten by a reseed.
  const insertLesson = db.prepare(
    `INSERT OR IGNORE INTO lessons
     (kc_id, title, key_points_json, example_problem, example_steps_json, common_mistake,
      status, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', NULL, ?)`,
  );
  for (const lesson of LESSON_SUMMARIES) {
    insertLesson.run(
      lesson.kcId,
      lesson.titleVi,
      JSON.stringify(lesson.keyPointsVi),
      lesson.workedExampleVi.problem,
      JSON.stringify(lesson.workedExampleVi.steps),
      lesson.commonMistakeVi,
      now,
    );
  }

  // One ready-made assignment so the student space is never empty on first run.
  const assignmentId = 'assignment-seed-k02';
  db.prepare(
    `INSERT OR IGNORE INTO assignments
     (id, class_id, teacher_id, title, question_ids_json, created_at, due_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    assignmentId,
    CLASS_7A_ID,
    teacherId,
    'Ôn tập phân số bằng nhau',
    JSON.stringify(['bank-K02-CHECK-1', 'bank-K02-CHECK-2']),
    now,
  );
}

// Allow `node server/seed.ts <path>` as a standalone command.
if (process.argv[1]?.endsWith('seed.ts')) {
  const { openDb } = await import('./db.ts');
  const path = process.argv[2] ?? 'server/data/nekopath.db';
  const { mkdirSync } = await import('node:fs');
  mkdirSync('server/data', { recursive: true });
  const db = openDb(path);
  seed(db);
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  const questions = db.prepare('SELECT COUNT(*) AS n FROM questions').get() as { n: number };
  console.log(`Seeded ${path}: ${users.n} users, ${questions.n} questions.`);
}
