import fastifyCookie from '@fastify/cookie';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { createSession, destroySession, userForSession, verifyPassword } from './auth.ts';
import { CLASS_7A_ID } from './seed.ts';

/**
 * NekoPath API — one Fastify unit (master plan §9). The server owns identity,
 * authored questions, assignments and the synced event log. It never computes
 * mastery/diagnosis/grouping: those stay in the deterministic client core so
 * the product keeps working offline (organizer constraint).
 */

const SESSION_COOKIE = 'nekopath_sid';

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

const questionSchema = z.object({
  kcId: z.string().min(1),
  prompt: z.string().min(8).max(500),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(200),
        noteVi: z.string().max(300).optional(),
      }),
    )
    .min(2)
    .max(5),
  correctChoiceId: z.string().min(1),
  hints: z.array(z.string().max(300)).max(3).default([]),
  explanation: z.string().max(500).default(''),
});

const assignmentSchema = z.object({
  title: z.string().min(3).max(120),
  questionIds: z.array(z.string().min(1)).min(1).max(20),
});

const eventSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  assignmentId: z.string().nullable().optional(),
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().min(1),
  kind: z.string().min(1),
  payload: z.string(),
});

interface QuestionRow {
  id: string;
  owner_id: string;
  kc_id: string;
  prompt: string;
  choices_json: string;
  correct_choice_id: string;
  hints_json: string;
  explanation: string;
  review_state: string;
}

function toQuestionDto(row: QuestionRow, includeAnswer: boolean) {
  return {
    id: row.id,
    kcId: row.kc_id,
    prompt: row.prompt,
    choices: JSON.parse(row.choices_json) as unknown[],
    reviewState: row.review_state,
    ...(includeAnswer
      ? {
          correctChoiceId: row.correct_choice_id,
          hints: JSON.parse(row.hints_json) as string[],
          explanation: row.explanation,
        }
      : {}),
  };
}

export function buildApp(db: DatabaseSync): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 });
  void app.register(fastifyCookie);

  function currentUser(request: FastifyRequest) {
    const sid = request.cookies[SESSION_COOKIE];
    return sid ? userForSession(db, sid) : null;
  }

  function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const user = currentUser(request);
    if (!user) {
      void reply.code(401).send({ error: 'UNAUTHENTICATED' });
      return null;
    }
    return user;
  }

  function requireTeacher(request: FastifyRequest, reply: FastifyReply) {
    const user = requireUser(request, reply);
    if (user && user.role !== 'TEACHER') {
      void reply.code(403).send({ error: 'FORBIDDEN' });
      return null;
    }
    return user;
  }

  app.get('/api/healthz', () => ({ status: 'ok', time: new Date().toISOString() }));

  /** Synthetic demo directory shown on the login screen (event environment). */
  app.get('/api/auth/directory', () => {
    const rows = db
      .prepare(
        `SELECT username, role, name, initials, subtitle FROM users
         WHERE username IN ('an.tn','binh.lt','chi.nm','minh.pq','co.ha') ORDER BY role, name`,
      )
      .all();
    return { accounts: rows };
  });

  app.post('/api/auth/login', (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    const row = db
      .prepare('SELECT id, password_hash FROM users WHERE username = ?')
      .get(parsed.data.username) as { id: string; password_hash: string } | undefined;
    if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }
    const sessionId = createSession(db, row.id);
    void reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    const user = userForSession(db, sessionId);
    return { user };
  });

  app.post('/api/auth/logout', (request, reply) => {
    const sid = request.cookies[SESSION_COOKIE];
    if (sid) destroySession(db, sid);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', (request, reply) => {
    const user = currentUser(request);
    if (!user) return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    return { user };
  });

  app.get('/api/class/roster', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.short_name AS shortName, u.initials, u.learner_profile AS learnerProfile
         FROM enrollments e JOIN users u ON u.id = e.user_id
         WHERE e.class_id = ? ORDER BY u.name`,
      )
      .all(CLASS_7A_ID);
    return { classId: CLASS_7A_ID, students: rows };
  });

  app.get('/api/questions', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    const rows = db
      .prepare('SELECT * FROM questions ORDER BY created_at DESC')
      .all() as unknown as QuestionRow[];
    return { questions: rows.map((row) => toQuestionDto(row, true)) };
  });

  app.post('/api/questions', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    const parsed = questionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', detail: parsed.error.issues });
    }
    const body = parsed.data;
    if (!body.choices.some((choice) => choice.id === body.correctChoiceId)) {
      return reply.code(400).send({ error: 'CORRECT_CHOICE_NOT_IN_CHOICES' });
    }
    const id = `q-${randomUUID()}`;
    db.prepare(
      `INSERT INTO questions
       (id, owner_id, kc_id, prompt, choices_json, correct_choice_id, hints_json, explanation,
        review_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNREVIEWED', ?)`,
    ).run(
      id,
      user.id,
      body.kcId,
      body.prompt,
      JSON.stringify(body.choices),
      body.correctChoiceId,
      JSON.stringify(body.hints),
      body.explanation,
      new Date().toISOString(),
    );
    return reply.code(201).send({ id });
  });

  app.post('/api/assignments', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    const parsed = assignmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    const known = db
      .prepare(
        `SELECT id FROM questions WHERE id IN (${parsed.data.questionIds.map(() => '?').join(',')})`,
      )
      .all(...parsed.data.questionIds) as { id: string }[];
    if (known.length !== parsed.data.questionIds.length) {
      return reply.code(400).send({ error: 'UNKNOWN_QUESTION_ID' });
    }
    const id = `assignment-${randomUUID()}`;
    db.prepare(
      `INSERT INTO assignments (id, class_id, teacher_id, title, question_ids_json, created_at, due_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      id,
      CLASS_7A_ID,
      user.id,
      parsed.data.title,
      JSON.stringify(parsed.data.questionIds),
      new Date().toISOString(),
    );
    return reply.code(201).send({ id });
  });

  app.get('/api/assignments', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const rows = db
      .prepare('SELECT * FROM assignments WHERE class_id = ? ORDER BY created_at DESC')
      .all(CLASS_7A_ID) as unknown as {
      id: string;
      title: string;
      question_ids_json: string;
      created_at: string;
      teacher_id: string;
    }[];
    const rosterCount = (
      db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE class_id = ?').get(CLASS_7A_ID) as {
        n: number;
      }
    ).n;
    const assignments = rows.map((row) => {
      const questionIds = JSON.parse(row.question_ids_json) as string[];
      const submitted = (
        db
          .prepare('SELECT COUNT(DISTINCT learner_id) AS n FROM events WHERE assignment_id = ?')
          .get(row.id) as { n: number }
      ).n;
      const myAnswers = (
        db
          .prepare('SELECT COUNT(*) AS n FROM events WHERE assignment_id = ? AND learner_id = ?')
          .get(row.id, user.id) as { n: number }
      ).n;
      return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        questionCount: questionIds.length,
        submittedLearnerCount: submitted,
        rosterCount,
        myAnswerCount: myAnswers,
      };
    });
    return { assignments };
  });

  app.get('/api/assignments/:id', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as
      { id: string; title: string; question_ids_json: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'NOT_FOUND' });
    const questionIds = JSON.parse(row.question_ids_json) as string[];
    const questions = questionIds
      .map(
        (questionId) =>
          db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as
            QuestionRow | undefined,
      )
      .filter((question): question is QuestionRow => question !== undefined)
      // Students receive the answer key only per-question AFTER submitting —
      // the client asks for grading via POST /api/assignments/:id/answers.
      .map((question) => toQuestionDto(question, user.role === 'TEACHER'));
    return { id: row.id, title: row.title, questions };
  });

  /** Grade one answer server-side and append it to the event log. */
  app.post('/api/assignments/:id/answers', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({ questionId: z.string().min(1), choiceId: z.string().min(1) })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    const assignment = db
      .prepare('SELECT question_ids_json FROM assignments WHERE id = ?')
      .get(id) as { question_ids_json: string } | undefined;
    if (!assignment) return reply.code(404).send({ error: 'NOT_FOUND' });
    const questionIds = JSON.parse(assignment.question_ids_json) as string[];
    if (!questionIds.includes(body.data.questionId)) {
      return reply.code(400).send({ error: 'QUESTION_NOT_IN_ASSIGNMENT' });
    }
    const question = db
      .prepare('SELECT * FROM questions WHERE id = ?')
      .get(body.data.questionId) as QuestionRow | undefined;
    if (!question) return reply.code(404).send({ error: 'QUESTION_NOT_FOUND' });

    const correct = question.correct_choice_id === body.data.choiceId;
    const sequence = (
      db.prepare('SELECT COUNT(*) AS n FROM events WHERE learner_id = ?').get(user.id) as {
        n: number;
      }
    ).n;
    db.prepare(
      `INSERT OR IGNORE INTO events
       (id, learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ASSIGNMENT_ANSWER', ?, ?)`,
    ).run(
      `evt-${randomUUID()}`,
      user.id,
      body.data.questionId,
      id,
      sequence + 1,
      new Date().toISOString(),
      JSON.stringify({ choiceId: body.data.choiceId, correct }),
      new Date().toISOString(),
    );
    const choices = JSON.parse(question.choices_json) as {
      id: string;
      noteVi?: string;
    }[];
    const picked = choices.find((choice) => choice.id === body.data.choiceId);
    return {
      correct,
      correctChoiceId: question.correct_choice_id,
      explanation: question.explanation,
      note: picked?.noteVi ?? null,
      hints: JSON.parse(question.hints_json) as string[],
    };
  });

  /** Idempotent batch sync of locally recorded practice events. */
  app.post('/api/events', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const parsed = z.object({ events: z.array(eventSchema).max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    const insert = db.prepare(
      `INSERT OR IGNORE INTO events
       (id, learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let accepted = 0;
    for (const event of parsed.data.events) {
      const result = insert.run(
        event.id,
        user.id,
        event.itemId,
        event.assignmentId ?? null,
        event.sequence,
        event.occurredAt,
        event.kind,
        event.payload,
        new Date().toISOString(),
      );
      accepted += Number(result.changes);
    }
    return { accepted, received: parsed.data.events.length };
  });

  return app;
}
