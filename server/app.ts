import fastifyCookie from '@fastify/cookie';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { HERO_GRAPH } from '../src/content/hero-demo.ts';
import { CodexAccountManager } from './ai/codex-account-manager.ts';
import { registerCodexRoutes, type CodexManagerPort } from './ai/codex-routes.ts';
import { registerResponsesRoutes } from './ai/responses.ts';
import {
  buildReviewSchedulePayload,
  reviewScheduleEventId,
} from '../src/domain/review-schedule.ts';
import { reviewSchedulePayloadSchema } from '../src/storage/review-schedule-repository.ts';
import {
  createSession,
  credentialsByEmail,
  destroySession,
  userForSession,
  verifyPassword,
} from './auth.ts';
import { LESSON_SUMMARIES } from '../src/content/lessons.v1.ts';
import { CLASS_7A_ID } from './seed.ts';
import { buildTeacherDashboard } from './teacher-dashboard.ts';

const LESSON_KC_IDS = new Set(LESSON_SUMMARIES.map((lesson) => lesson.kcId));

/**
 * NekoPath API — one Fastify unit (master plan §9). The server owns identity,
 * authored questions, assignments and the synced event log. It never computes
 * mastery/diagnosis/grouping: those stay in the deterministic client core so
 * the product keeps working offline (organizer constraint).
 */

const SESSION_COOKIE = 'nekopath_sid';
const PROFILE_BINDING_COOKIE = 'nekopath_profile';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const questionSchema = z.object({
  kcId: z.string().min(1),
  difficulty: z.enum(['UNSPECIFIED', 'EASY', 'MEDIUM', 'HARD']).default('UNSPECIFIED'),
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
  teacherMessage: z.string().max(500).default(''),
  questionIds: z.array(z.string().min(1)).min(1).max(20),
  learnerIds: z
    .array(z.string().min(1))
    .max(40)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length),
  dueAt: z.string().datetime().nullable().default(null),
  allowRetake: z.boolean().default(false),
  shuffleAnswers: z.boolean().default(false),
});

const lessonSchema = z.object({
  title: z.string().min(4).max(120),
  keyPoints: z.array(z.string().min(4).max(300)).min(1).max(6),
  exampleProblem: z.string().min(8).max(500),
  exampleSteps: z.array(z.string().min(4).max(300)).min(1).max(8),
  commonMistake: z.string().min(8).max(500),
});

const eventSchema = z
  .object({
    id: z.string().min(1),
    learnerId: z.string().min(1),
    itemId: z.string().min(1),
    assignmentId: z.string().nullable().optional(),
    sequence: z.number().int().nonnegative(),
    occurredAt: z.string().min(1),
    kind: z.string().min(1),
    payload: z.string(),
  })
  .superRefine((event, context) => {
    if (event.kind !== 'REVIEW_SCHEDULED') return;
    try {
      const payload = reviewSchedulePayloadSchema.safeParse(JSON.parse(event.payload));
      if (!payload.success || event.id !== reviewScheduleEventId(payload.data.sourceEventId)) {
        context.addIssue({ code: 'custom', path: ['payload'], message: 'INVALID_REVIEW_SCHEDULE' });
      }
    } catch {
      context.addIssue({ code: 'custom', path: ['payload'], message: 'INVALID_REVIEW_SCHEDULE' });
    }
  });

const teacherOverrideSchema = z
  .object({
    learnerId: z.string().min(1),
    targetKcId: z.string().min(1),
    decision: z.enum(['SET_ROOT', 'NEEDS_MORE_EVIDENCE']),
    rootKcId: z.string().min(1).optional(),
    reason: z.string().trim().min(8).max(240),
  })
  .superRefine((value, context) => {
    if (value.decision === 'SET_ROOT' && !value.rootKcId) {
      context.addIssue({ code: 'custom', path: ['rootKcId'], message: 'ROOT_REQUIRED' });
    }
    if (value.decision === 'NEEDS_MORE_EVIDENCE' && value.rootKcId) {
      context.addIssue({ code: 'custom', path: ['rootKcId'], message: 'ROOT_NOT_ALLOWED' });
    }
  });

const eventPageQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

const EVENT_PAGE_SIZE = 200;

interface QuestionRow {
  id: string;
  owner_id: string;
  kc_id: string;
  prompt: string;
  choices_json: string;
  correct_choice_id: string;
  hints_json: string;
  explanation: string;
  difficulty: string;
  review_state: string;
}

function toQuestionDto(row: QuestionRow, includeAnswer: boolean) {
  return {
    id: row.id,
    kcId: row.kc_id,
    prompt: row.prompt,
    difficulty: row.difficulty,
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

function stableOrder(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface AppOptions {
  readonly fetchImpl?: typeof fetch;
  readonly openAiApiKey?: string;
  readonly openAiModel?: string;
  readonly codexManager?: CodexManagerPort;
}

export function buildApp(db: DatabaseSync, options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 });
  void app.register(fastifyCookie);
  app.addHook('onRequest', (_request, reply, done) => {
    void reply.header('Origin-Agent-Cluster', '?1');
    void reply.header('Permissions-Policy', 'tools=(self)');
    done();
  });

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
    const boundProfileId = request.cookies[PROFILE_BINDING_COOKIE];
    if (boundProfileId && boundProfileId !== user.id) {
      void reply.code(409).send({ error: 'SESSION_PROFILE_MISMATCH' });
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

  const codexManager =
    options.codexManager ??
    new CodexAccountManager({
      enabled: process.env.NEKOPATH_CODEX_APP_SERVER_ENABLED === '1',
      rootDir: resolve(process.env.NEKOPATH_CODEX_DATA ?? 'server/data/codex-accounts'),
      codexBin: process.env.NEKOPATH_CODEX_BIN,
      model: process.env.NEKOPATH_CODEX_MODEL,
    });

  registerResponsesRoutes(app, {
    apiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? '',
    model: options.openAiModel ?? process.env.NEKOPATH_OPENAI_MODEL ?? 'gpt-5.6-sol',
    fetchImpl: options.fetchImpl ?? fetch,
    requireTeacher,
    chatGptAvailable: () => codexManager.isEnabled(),
  });
  registerCodexRoutes(app, codexManager, requireTeacher);
  app.addHook('onClose', async () => codexManager.disposeAll());

  function recipientIds(value: string): string[] {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : [];
  }

  function canOpenAssignment(user: { id: string; role: 'STUDENT' | 'TEACHER' }, value: string) {
    if (user.role === 'TEACHER') return true;
    const recipients = recipientIds(value);
    return recipients.length === 0 || recipients.includes(user.id);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const useSecureCookies = isProduction && process.env.COOKIE_SECURE !== 'false';

  function startSession(reply: FastifyReply, userId: string) {
    const sessionId = createSession(db, userId);
    void reply.setCookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: useSecureCookies,
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    // This browser-visible value grants no access. It only lets every protected
    // endpoint reject a stale HttpOnly session after an offline profile switch.
    void reply.setCookie(PROFILE_BINDING_COOKIE, userId, {
      httpOnly: false,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return userForSession(db, sessionId);
  }

  app.get('/api/healthz', () => ({ status: 'ok', time: new Date().toISOString() }));

  /**
   * Class roll for the sign-in dropdown — picking your name like a class
   * roll-call beats typing an email on a shared rural-classroom device.
   * Names/emails are the class roster (already public within a class);
   * passwords remain the only secret.
   */
  app.get('/api/auth/directory', () => {
    const rows = db
      .prepare(
        `SELECT email, name, role, subtitle FROM users
         WHERE email IS NOT NULL
         ORDER BY CASE role WHEN 'TEACHER' THEN 0 ELSE 1 END, name`,
      )
      .all();
    return { accounts: rows };
  });

  app.post('/api/auth/login', (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    const credentials = credentialsByEmail(db, parsed.data.email);
    if (!credentials || !verifyPassword(parsed.data.password, credentials.passwordHash)) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }
    return { user: startSession(reply, credentials.id) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const sid = request.cookies[SESSION_COOKIE];
    if (sid) {
      const user = userForSession(db, sid);
      if (user?.role === 'TEACHER') await codexManager.logout(user.id).catch(() => undefined);
      destroySession(db, sid);
    }
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    void reply.clearCookie(PROFILE_BINDING_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
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

  app.get('/api/teacher/dashboard', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    return buildTeacherDashboard(db, CLASS_7A_ID, user.id);
  });

  app.post('/api/teacher/overrides', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    const parsed = teacherOverrideSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', detail: parsed.error.issues });
    }
    const body = parsed.data;
    const knownKcIds = new Set(HERO_GRAPH.nodes.map((node) => node.id));
    if (!knownKcIds.has(body.targetKcId) || (body.rootKcId && !knownKcIds.has(body.rootKcId))) {
      return reply.code(400).send({ error: 'UNKNOWN_KC' });
    }
    const enrolled = db
      .prepare('SELECT 1 FROM enrollments WHERE class_id = ? AND user_id = ?')
      .get(CLASS_7A_ID, body.learnerId);
    if (!enrolled) return reply.code(404).send({ error: 'LEARNER_NOT_FOUND' });

    const id = `override-${randomUUID()}`;
    const updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO teacher_overrides
       (id, teacher_id, class_id, learner_id, target_kc_id, decision, root_kc_id, reason,
        updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      user.id,
      CLASS_7A_ID,
      body.learnerId,
      body.targetKcId,
      body.decision,
      body.rootKcId ?? null,
      body.reason,
      updatedAt,
    );
    return reply.code(201).send({ id, updatedAt });
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
        difficulty, review_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNREVIEWED', ?)`,
    ).run(
      id,
      user.id,
      body.kcId,
      body.prompt,
      JSON.stringify(body.choices),
      body.correctChoiceId,
      JSON.stringify(body.hints),
      body.explanation,
      body.difficulty,
      new Date().toISOString(),
    );
    return reply.code(201).send({ id });
  });

  app.patch('/api/questions/:id', (request, reply) => {
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
    const { id } = request.params as { id: string };
    const result = db
      .prepare(
        `UPDATE questions SET kc_id = ?, prompt = ?, choices_json = ?, correct_choice_id = ?,
         hints_json = ?, explanation = ?, difficulty = ?, review_state = 'UNREVIEWED'
         WHERE id = ? AND owner_id = ?`,
      )
      .run(
        body.kcId,
        body.prompt,
        JSON.stringify(body.choices),
        body.correctChoiceId,
        JSON.stringify(body.hints),
        body.explanation,
        body.difficulty,
        id,
        user.id,
      );
    if (Number(result.changes) === 0) return reply.code(404).send({ error: 'NOT_FOUND' });
    return { id };
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
    if (parsed.data.learnerIds.length > 0) {
      const enrolled = db
        .prepare(
          `SELECT u.id FROM enrollments e JOIN users u ON u.id = e.user_id
           WHERE e.class_id = ? AND u.role = 'STUDENT'
             AND u.id IN (${parsed.data.learnerIds.map(() => '?').join(',')})`,
        )
        .all(CLASS_7A_ID, ...parsed.data.learnerIds) as { id: string }[];
      if (enrolled.length !== parsed.data.learnerIds.length) {
        return reply.code(400).send({ error: 'UNKNOWN_LEARNER_ID' });
      }
    }
    const id = `assignment-${randomUUID()}`;
    db.prepare(
      `INSERT INTO assignments
       (id, class_id, teacher_id, title, question_ids_json, created_at, due_at, allow_retake,
        shuffle_answers, recipient_ids_json, teacher_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      CLASS_7A_ID,
      user.id,
      parsed.data.title,
      JSON.stringify(parsed.data.questionIds),
      new Date().toISOString(),
      parsed.data.dueAt,
      parsed.data.allowRetake ? 1 : 0,
      parsed.data.shuffleAnswers ? 1 : 0,
      JSON.stringify(parsed.data.learnerIds),
      parsed.data.teacherMessage.trim(),
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
      due_at: string | null;
      allow_retake: number;
      shuffle_answers: number;
      recipient_ids_json: string;
      teacher_message: string;
    }[];
    const classRosterCount = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM enrollments e JOIN users u ON u.id = e.user_id
           WHERE e.class_id = ? AND u.role = 'STUDENT'`,
        )
        .get(CLASS_7A_ID) as {
        n: number;
      }
    ).n;
    const assignments = rows
      .filter((row) => canOpenAssignment(user, row.recipient_ids_json))
      .map((row) => {
        const questionIds = JSON.parse(row.question_ids_json) as string[];
        const recipients = recipientIds(row.recipient_ids_json);
        const recipientNames = recipients.map((learnerId) => {
          const learner = db.prepare('SELECT name FROM users WHERE id = ?').get(learnerId) as
            { name: string } | undefined;
          return learner?.name ?? learnerId;
        });
        const submitted = (
          db
            .prepare('SELECT COUNT(DISTINCT learner_id) AS n FROM events WHERE assignment_id = ?')
            .get(row.id) as { n: number }
        ).n;
        const progress = db
          .prepare(
            `SELECT learner_id AS learnerId, COUNT(DISTINCT item_id) AS answered
           FROM events WHERE assignment_id = ? GROUP BY learner_id`,
          )
          .all(row.id) as { learnerId: string; answered: number }[];
        const opened = (
          db
            .prepare('SELECT COUNT(*) AS n FROM assignment_views WHERE assignment_id = ?')
            .get(row.id) as { n: number }
        ).n;
        const completed = progress.filter((entry) => entry.answered >= questionIds.length).length;
        const kcIds = [
          ...new Set(
            questionIds.flatMap((questionId) => {
              const question = db
                .prepare('SELECT kc_id FROM questions WHERE id = ?')
                .get(questionId) as { kc_id: string } | undefined;
              return question ? [question.kc_id] : [];
            }),
          ),
        ];
        const myAnswers = (
          db
            .prepare('SELECT COUNT(*) AS n FROM events WHERE assignment_id = ? AND learner_id = ?')
            .get(row.id, user.id) as { n: number }
        ).n;
        return {
          id: row.id,
          title: row.title,
          teacherMessage: row.teacher_message,
          createdAt: row.created_at,
          dueAt: row.due_at,
          allowRetake: Boolean(row.allow_retake),
          shuffleAnswers: Boolean(row.shuffle_answers),
          questionCount: questionIds.length,
          kcIds,
          openedLearnerCount: opened,
          inProgressLearnerCount: Math.max(0, progress.length - completed),
          completedLearnerCount: completed,
          submittedLearnerCount: submitted,
          rosterCount: recipients.length > 0 ? recipients.length : classRosterCount,
          recipientCount: recipients.length > 0 ? recipients.length : classRosterCount,
          ...(user.role === 'TEACHER' ? { recipientNames } : {}),
          myAnswerCount: myAnswers,
        };
      });
    return { assignments };
  });

  app.post('/api/assignments/:id/open', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    if (user.role !== 'STUDENT') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = request.params as { id: string };
    const exists = db
      .prepare('SELECT id, recipient_ids_json FROM assignments WHERE id = ?')
      .get(id) as { id: string; recipient_ids_json: string } | undefined;
    if (!exists) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canOpenAssignment(user, exists.recipient_ids_json)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    db.prepare(
      `INSERT OR IGNORE INTO assignment_views (assignment_id, learner_id, opened_at)
       VALUES (?, ?, ?)`,
    ).run(id, user.id, new Date().toISOString());
    return { ok: true };
  });

  app.get('/api/assignments/:id', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as
      | {
          id: string;
          title: string;
          question_ids_json: string;
          allow_retake: number;
          shuffle_answers: number;
          recipient_ids_json: string;
          teacher_message: string;
        }
      | undefined;
    if (!row) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canOpenAssignment(user, row.recipient_ids_json)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const questionIds = JSON.parse(row.question_ids_json) as string[];
    const answeredIds =
      user.role === 'STUDENT' && !row.allow_retake
        ? new Set(
            (
              db
                .prepare(
                  'SELECT DISTINCT item_id AS itemId FROM events WHERE assignment_id = ? AND learner_id = ?',
                )
                .all(id, user.id) as { itemId: string }[]
            ).map((event) => event.itemId),
          )
        : new Set<string>();
    const questions = questionIds
      .filter((questionId) => !answeredIds.has(questionId))
      .map(
        (questionId) =>
          db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId) as
            QuestionRow | undefined,
      )
      .filter((question): question is QuestionRow => question !== undefined)
      // Students receive the answer key only per-question AFTER submitting —
      // the client asks for grading via POST /api/assignments/:id/answers.
      .map((question) => {
        const dto = toQuestionDto(question, user.role === 'TEACHER');
        if (!row.shuffle_answers || user.role === 'TEACHER') return dto;
        const choices = [...dto.choices] as { id?: string }[];
        choices.sort(
          (left, right) =>
            stableOrder(`${id}:${user.id}:${left.id ?? ''}`) -
            stableOrder(`${id}:${user.id}:${right.id ?? ''}`),
        );
        return { ...dto, choices };
      });
    return {
      id: row.id,
      title: row.title,
      teacherMessage: row.teacher_message,
      allowRetake: Boolean(row.allow_retake),
      shuffleAnswers: Boolean(row.shuffle_answers),
      questions,
    };
  });

  /** Grade one answer server-side and append it to the event log. */
  app.post('/api/assignments/:id/answers', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    if (user.role !== 'STUDENT') return reply.code(403).send({ error: 'FORBIDDEN' });
    const { id } = request.params as { id: string };
    const body = z
      .object({ questionId: z.string().min(1), choiceId: z.string().min(1) })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    const assignment = db
      .prepare(
        'SELECT question_ids_json, due_at, allow_retake, recipient_ids_json FROM assignments WHERE id = ?',
      )
      .get(id) as
      | {
          question_ids_json: string;
          due_at: string | null;
          allow_retake: number;
          recipient_ids_json: string;
        }
      | undefined;
    if (!assignment) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canOpenAssignment(user, assignment.recipient_ids_json)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const questionIds = JSON.parse(assignment.question_ids_json) as string[];
    if (!questionIds.includes(body.data.questionId)) {
      return reply.code(400).send({ error: 'QUESTION_NOT_IN_ASSIGNMENT' });
    }
    if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) {
      return reply.code(409).send({ error: 'DUE_DATE_PASSED' });
    }
    if (!assignment.allow_retake) {
      const answered = db
        .prepare(
          'SELECT id FROM events WHERE assignment_id = ? AND learner_id = ? AND item_id = ? LIMIT 1',
        )
        .get(id, user.id, body.data.questionId);
      if (answered) return reply.code(409).send({ error: 'ALREADY_ANSWERED' });
    }
    const question = db
      .prepare('SELECT * FROM questions WHERE id = ?')
      .get(body.data.questionId) as QuestionRow | undefined;
    if (!question) return reply.code(404).send({ error: 'QUESTION_NOT_FOUND' });

    const correct = question.correct_choice_id === body.data.choiceId;
    const choices = JSON.parse(question.choices_json) as {
      id: string;
      noteVi?: string;
      misconceptionTag?: string;
    }[];
    const picked = choices.find((choice) => choice.id === body.data.choiceId);
    if (!picked) return reply.code(400).send({ error: 'INVALID_CHOICE' });
    const misconceptionId = !correct ? picked?.misconceptionTag : undefined;
    const eventId = `evt-${randomUUID()}`;
    const occurredAt = new Date().toISOString();
    const payload = JSON.stringify({
      choiceId: body.data.choiceId,
      correct,
      methodValidity: misconceptionId ? 'INVALID' : 'UNKNOWN',
      ...(misconceptionId ? { misconceptionId } : {}),
    });
    const previousSchedule = (
      db
        .prepare(
          `SELECT payload FROM events
           WHERE learner_id = ? AND kind = 'REVIEW_SCHEDULED'
           ORDER BY rowid DESC`,
        )
        .all(user.id) as { payload: string }[]
    )
      .map((row) => {
        try {
          return reviewSchedulePayloadSchema.safeParse(JSON.parse(row.payload));
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.success && parsed.data.kcId === question.kc_id);
    const reviewPayload = buildReviewSchedulePayload({
      kcId: question.kc_id,
      sourceEventId: eventId,
      occurredAt,
      correct,
      ...(previousSchedule?.success
        ? { previousIntervalDays: previousSchedule.data.intervalDays }
        : {}),
    });
    const reviewEventId = reviewScheduleEventId(eventId);
    let sequence: number;
    const receivedAt = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      sequence = (
        db
          .prepare(
            'SELECT COALESCE(MAX(sequence), 0) AS maxSequence FROM events WHERE learner_id = ?',
          )
          .get(user.id) as { maxSequence: number }
      ).maxSequence;
      const insert = db.prepare(
        `INSERT INTO events
         (id, learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run(
        eventId,
        user.id,
        body.data.questionId,
        id,
        sequence + 1,
        occurredAt,
        'ASSIGNMENT_ANSWER',
        payload,
        receivedAt,
      );
      insert.run(
        reviewEventId,
        user.id,
        body.data.questionId,
        null,
        sequence + 2,
        occurredAt,
        'REVIEW_SCHEDULED',
        JSON.stringify(reviewPayload),
        receivedAt,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return {
      correct,
      correctChoiceId: question.correct_choice_id,
      explanation: question.explanation,
      note: picked?.noteVi ?? null,
      hints: JSON.parse(question.hints_json) as string[],
      event: {
        id: eventId,
        learnerId: user.id,
        itemId: body.data.questionId,
        sequence: sequence + 1,
        occurredAt,
        kind: 'ASSIGNMENT_ANSWER',
        payload,
      },
      reviewEvent: {
        id: reviewEventId,
        learnerId: user.id,
        itemId: body.data.questionId,
        sequence: sequence + 2,
        occurredAt,
        kind: 'REVIEW_SCHEDULED',
        payload: JSON.stringify(reviewPayload),
      },
    };
  });

  /**
   * Paginated, account-scoped event history for restoring a student's
   * append-only evidence log on another device.
   */
  app.get('/api/events', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    if (user.role !== 'STUDENT') return reply.code(403).send({ error: 'FORBIDDEN' });
    const query = eventPageQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'INVALID_QUERY' });
    const rows = db
      .prepare(
        `SELECT id, learner_id, item_id, sequence, occurred_at, kind, payload
         FROM events
         WHERE learner_id = ?
         ORDER BY rowid ASC
         LIMIT ? OFFSET ?`,
      )
      .all(user.id, EVENT_PAGE_SIZE + 1, query.data.offset) as {
      id: string;
      learner_id: string;
      item_id: string;
      sequence: number;
      occurred_at: string;
      kind: string;
      payload: string;
    }[];
    const hasMore = rows.length > EVENT_PAGE_SIZE;
    const events = rows.slice(0, EVENT_PAGE_SIZE).map((row) => ({
      id: row.id,
      learnerId: row.learner_id,
      itemId: row.item_id,
      sequence: row.sequence,
      occurredAt: row.occurred_at,
      kind: row.kind,
      payload: row.payload,
    }));
    return {
      events,
      nextOffset: hasMore ? query.data.offset + EVENT_PAGE_SIZE : null,
    };
  });

  /**
   * Lesson materials. The server is the source of truth; the client mirrors
   * rows into IndexedDB so students can read them offline. Team-seeded rows
   * start as DRAFT; a teacher edit publishes the row in their name.
   */
  app.get('/api/lessons', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const rows = db
      .prepare(
        `SELECT l.kc_id, l.title, l.key_points_json, l.example_problem, l.example_steps_json,
                l.common_mistake, l.status, l.updated_at, u.name AS updated_by_name
         FROM lessons l LEFT JOIN users u ON u.id = l.updated_by
         ORDER BY l.kc_id`,
      )
      .all() as {
      kc_id: string;
      title: string;
      key_points_json: string;
      example_problem: string;
      example_steps_json: string;
      common_mistake: string;
      status: string;
      updated_at: string;
      updated_by_name: string | null;
    }[];
    return {
      lessons: rows.map((row) => ({
        kcId: row.kc_id,
        title: row.title,
        keyPoints: JSON.parse(row.key_points_json) as string[],
        exampleProblem: row.example_problem,
        exampleSteps: JSON.parse(row.example_steps_json) as string[],
        commonMistake: row.common_mistake,
        status: row.status,
        updatedAt: row.updated_at,
        updatedByName: row.updated_by_name,
      })),
    };
  });

  app.put('/api/lessons/:kcId', (request, reply) => {
    const user = requireTeacher(request, reply);
    if (!user) return;
    const { kcId } = request.params as { kcId: string };
    if (!LESSON_KC_IDS.has(kcId)) return reply.code(404).send({ error: 'UNKNOWN_KC' });
    const parsed = lessonSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_BODY', detail: parsed.error.issues });
    }
    const body = parsed.data;
    db.prepare(
      `INSERT INTO lessons
       (kc_id, title, key_points_json, example_problem, example_steps_json, common_mistake,
        status, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)
       ON CONFLICT(kc_id) DO UPDATE SET
         title = excluded.title,
         key_points_json = excluded.key_points_json,
         example_problem = excluded.example_problem,
         example_steps_json = excluded.example_steps_json,
         common_mistake = excluded.common_mistake,
         status = 'PUBLISHED',
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
    ).run(
      kcId,
      body.title,
      JSON.stringify(body.keyPoints),
      body.exampleProblem,
      JSON.stringify(body.exampleSteps),
      body.commonMistake,
      user.id,
      new Date().toISOString(),
    );
    return { ok: true };
  });

  /**
   * Idempotent batch sync of locally recorded practice events. A retried
   * event with the same content is acknowledged silently; the same event ID
   * with DIFFERENT content is never overwritten — both fingerprints are
   * quarantined in sync_conflicts and the ID is reported back so the client
   * stops retrying it.
   */
  app.post('/api/events', (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const parsed = z.object({ events: z.array(eventSchema).max(200) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_BODY' });
    if (
      user.role !== 'STUDENT' ||
      parsed.data.events.some((event) => event.learnerId !== user.id)
    ) {
      return reply.code(403).send({ error: 'EVENT_ACCOUNT_MISMATCH' });
    }
    const eventsById = new Map(parsed.data.events.map((event) => [event.id, event]));
    const selectSource = db.prepare(
      `SELECT id, learner_id AS learnerId, item_id AS itemId, sequence, occurred_at AS occurredAt,
              kind, payload
       FROM events WHERE id = ?`,
    );
    for (const event of parsed.data.events) {
      if (event.kind !== 'REVIEW_SCHEDULED') continue;
      const schedule = reviewSchedulePayloadSchema.parse(JSON.parse(event.payload));
      const source =
        eventsById.get(schedule.sourceEventId) ??
        (selectSource.get(schedule.sourceEventId) as
          | {
              id: string;
              learnerId: string;
              itemId: string;
              sequence: number;
              occurredAt: string;
              kind: string;
              payload: string;
            }
          | undefined);
      let sourceCorrect: boolean | undefined;
      try {
        const sourcePayload = JSON.parse(source?.payload ?? '') as { correct?: unknown };
        sourceCorrect =
          typeof sourcePayload.correct === 'boolean' ? sourcePayload.correct : undefined;
      } catch {
        sourceCorrect = undefined;
      }
      const expectedReason = sourceCorrect
        ? schedule.intervalDays === 3
          ? 'RECOVERY_CHECK'
          : 'SPACED_REVIEW'
        : 'REMEDIATE_SOON';
      const sourceTimestamp = source ? Date.parse(source.occurredAt) : Number.NaN;
      const expectedDueAt = Number.isFinite(sourceTimestamp)
        ? new Date(sourceTimestamp + schedule.intervalDays * 24 * 60 * 60 * 1_000).toISOString()
        : null;
      if (
        !source ||
        source.learnerId !== user.id ||
        source.itemId !== event.itemId ||
        (source.kind !== 'ANSWER' && source.kind !== 'ASSIGNMENT_ANSWER') ||
        sourceCorrect === undefined ||
        event.sequence !== source.sequence + 1 ||
        event.occurredAt !== source.occurredAt ||
        expectedDueAt !== schedule.dueAt ||
        schedule.reason !== expectedReason ||
        (sourceCorrect && schedule.intervalDays === 1) ||
        (!sourceCorrect && schedule.intervalDays !== 1)
      ) {
        return reply.code(400).send({ error: 'INVALID_REVIEW_LINK' });
      }
    }
    const insert = db.prepare(
      `INSERT OR IGNORE INTO events
       (id, learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const selectExisting = db.prepare(
      `SELECT learner_id, item_id, assignment_id, sequence, occurred_at, kind, payload
       FROM events WHERE id = ?`,
    );
    const insertConflict = db.prepare(
      `INSERT OR IGNORE INTO sync_conflicts
       (event_id, learner_id, server_fingerprint, client_fingerprint, first_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const fingerprint = (row: {
      learnerId: string;
      itemId: string;
      assignmentId?: string | null;
      sequence: number;
      occurredAt: string;
      kind: string;
      payload: string;
    }) =>
      createHash('sha256')
        .update(
          JSON.stringify([
            row.learnerId,
            row.itemId,
            row.assignmentId ?? null,
            row.sequence,
            row.occurredAt,
            row.kind,
            row.payload,
          ]),
        )
        .digest('hex');
    let accepted = 0;
    const conflictIds: string[] = [];
    const conflictedSourceIds = new Set<string>();
    const orderedEvents = [...parsed.data.events].sort(
      (left, right) =>
        Number(left.kind === 'REVIEW_SCHEDULED') - Number(right.kind === 'REVIEW_SCHEDULED') ||
        left.sequence - right.sequence ||
        left.id.localeCompare(right.id),
    );
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const event of orderedEvents) {
        if (event.kind === 'REVIEW_SCHEDULED') {
          const schedule = reviewSchedulePayloadSchema.parse(JSON.parse(event.payload));
          if (conflictedSourceIds.has(schedule.sourceEventId)) {
            conflictIds.push(event.id);
            continue;
          }
        }
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
        if (Number(result.changes) > 0) {
          accepted += 1;
          continue;
        }
        const existing = selectExisting.get(event.id) as
          | {
              learner_id: string;
              item_id: string;
              assignment_id: string | null;
              sequence: number;
              occurred_at: string;
              kind: string;
              payload: string;
            }
          | undefined;
        if (!existing) continue;
        const serverPrint = fingerprint({
          learnerId: existing.learner_id,
          itemId: existing.item_id,
          assignmentId: existing.assignment_id,
          sequence: existing.sequence,
          occurredAt: existing.occurred_at,
          kind: existing.kind,
          payload: existing.payload,
        });
        const clientPrint = fingerprint(event);
        if (serverPrint === clientPrint) continue; // harmless retry
        insertConflict.run(event.id, user.id, serverPrint, clientPrint, new Date().toISOString());
        conflictIds.push(event.id);
        if (event.kind === 'ANSWER' || event.kind === 'ASSIGNMENT_ANSWER') {
          conflictedSourceIds.add(event.id);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { accepted, conflictIds, received: parsed.data.events.length };
  });

  return app;
}
