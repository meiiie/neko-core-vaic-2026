import type { DatabaseSync } from 'node:sqlite';
import { PRACTICE_QUESTIONS } from '../src/content/hero-practice.ts';
import { hashPassword } from './auth.ts';

/**
 * Idempotent seed for class 7A. Every person is synthetic — names are
 * generated demo fixtures, never real students. The shared demo password is
 * printed on the login screen by design (event environment, not production).
 */

export const DEMO_PASSWORD = 'nekopath-2026';
export const CLASS_7A_ID = 'class-7a';

const HERO_STUDENTS = [
  { username: 'an.tn', name: 'Trần Ngọc An', initials: 'NA', shortName: 'An', profile: 'an' },
  {
    username: 'binh.lt',
    name: 'Lê Thanh Bình',
    initials: 'TB',
    shortName: 'Bình',
    profile: 'binh',
  },
  { username: 'chi.nm', name: 'Nguyễn Minh Chi', initials: 'MC', shortName: 'Chi', profile: 'chi' },
  {
    username: 'minh.pq',
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
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users
     (id, username, password_hash, role, name, initials, short_name, subtitle, learner_profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const enroll = db.prepare('INSERT OR IGNORE INTO enrollments (class_id, user_id) VALUES (?, ?)');
  const passwordHash = hashPassword(DEMO_PASSWORD);

  db.prepare('INSERT OR IGNORE INTO classes (id, name) VALUES (?, ?)').run(CLASS_7A_ID, 'Lớp 7A');

  const teacherId = 'user-teacher-ha';
  insertUser.run(
    teacherId,
    'co.ha',
    passwordHash,
    'TEACHER',
    'Nguyễn Thu Hà',
    'TH',
    'Cô Hà',
    'Giáo viên Toán • Lớp 7A',
    null,
  );

  for (const hero of HERO_STUDENTS) {
    const id = `user-student-${hero.profile}`;
    insertUser.run(
      id,
      hero.username,
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
      const id = `user-student-7a-${String(ordinal).padStart(2, '0')}`;
      const name = `${family} ${given}`;
      const initials = given
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase();
      insertUser.run(
        id,
        `hs${String(ordinal).padStart(2, '0')}.7a`,
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
