import type { DatabaseSync } from 'node:sqlite';
import { HERO_GRAPH } from '../src/content/hero-demo.ts';

interface AssignmentRow {
  id: string;
  title: string;
  question_ids_json: string;
  recipient_ids_json: string;
  teacher_message: string;
  created_at: string;
  due_at: string | null;
}

interface EventRow {
  learner_id: string;
  item_id: string;
  assignment_id: string | null;
  sequence: number;
  occurred_at: string;
  payload: string;
}

interface QuestionRow {
  id: string;
  kc_id: string;
}

export type LessonProgressStatus =
  'NOT_ASSIGNED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_SUPPORT';

export interface LessonProgressDto {
  kcId: string;
  lessonName: string;
  assignedCount: number;
  answeredCount: number;
  correctCount: number;
  progressPercent: number;
  correctRate: number | null;
  status: LessonProgressStatus;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function parseCorrect(value: string): boolean | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || !('correct' in parsed)) return null;
    return typeof parsed.correct === 'boolean' ? parsed.correct : null;
  } catch {
    return null;
  }
}

function progressStatus(
  assignedCount: number,
  answeredCount: number,
  correctCount: number,
): LessonProgressStatus {
  if (answeredCount >= 2 && correctCount / answeredCount < 0.6) return 'NEEDS_SUPPORT';
  if (assignedCount === 0) return 'NOT_ASSIGNED';
  if (answeredCount === 0) return 'NOT_STARTED';
  if (answeredCount < assignedCount) return 'IN_PROGRESS';
  return 'COMPLETED';
}

function classRows(db: DatabaseSync, classId: string) {
  const learners = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.initials, u.short_name AS shortName
       FROM enrollments e JOIN users u ON u.id = e.user_id
       WHERE e.class_id = ? AND u.role = 'STUDENT'
       ORDER BY u.name`,
    )
    .all(classId) as unknown as {
    id: string;
    name: string;
    email: string | null;
    initials: string;
    shortName: string;
  }[];
  const questions = db.prepare('SELECT id, kc_id FROM questions').all() as unknown as QuestionRow[];
  const assignments = db
    .prepare(
      `SELECT id, title, question_ids_json, recipient_ids_json, teacher_message, created_at, due_at
       FROM assignments WHERE class_id = ? ORDER BY created_at DESC`,
    )
    .all(classId) as unknown as AssignmentRow[];
  const events = db
    .prepare(
      `SELECT ev.learner_id, ev.item_id, ev.assignment_id, ev.sequence, ev.occurred_at, ev.payload
       FROM events ev JOIN enrollments e ON e.user_id = ev.learner_id
       WHERE e.class_id = ? ORDER BY ev.sequence, ev.occurred_at`,
    )
    .all(classId) as unknown as EventRow[];
  return { learners, questions, assignments, events };
}

function progressForLearner(
  learnerId: string,
  questions: readonly QuestionRow[],
  assignments: readonly AssignmentRow[],
  events: readonly EventRow[],
): LessonProgressDto[] {
  const questionByEventId = new Map<string, QuestionRow>();
  for (const question of questions) {
    questionByEventId.set(question.id, question);
    if (question.id.startsWith('bank-')) questionByEventId.set(question.id.slice(5), question);
  }

  const assignedByKc = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const recipients = parseStringArray(assignment.recipient_ids_json);
    if (recipients.length > 0 && !recipients.includes(learnerId)) continue;
    for (const questionId of parseStringArray(assignment.question_ids_json)) {
      const question = questionByEventId.get(questionId);
      if (!question) continue;
      const set = assignedByKc.get(question.kc_id) ?? new Set<string>();
      set.add(question.id);
      assignedByKc.set(question.kc_id, set);
    }
  }

  const latestAnswers = new Map<
    string,
    { correct: boolean; sequence: number; occurredAt: string }
  >();
  for (const event of events) {
    if (event.learner_id !== learnerId) continue;
    const question = questionByEventId.get(event.item_id);
    const correct = parseCorrect(event.payload);
    if (!question || correct === null) continue;
    const previous = latestAnswers.get(question.id);
    if (!previous || event.sequence >= previous.sequence) {
      latestAnswers.set(question.id, {
        correct,
        sequence: event.sequence,
        occurredAt: event.occurred_at,
      });
    }
  }

  return HERO_GRAPH.nodes.map((node) => {
    const assigned = assignedByKc.get(node.id) ?? new Set<string>();
    const answered = [...latestAnswers.entries()].filter(
      ([questionId]) => questionByEventId.get(questionId)?.kc_id === node.id,
    );
    const correctCount = answered.filter(([, answer]) => answer.correct).length;
    const answeredCount = answered.length;
    const assignedCount = assigned.size;
    return {
      kcId: node.id,
      lessonName: node.name,
      assignedCount,
      answeredCount,
      correctCount,
      progressPercent:
        assignedCount === 0 ? 0 : Math.min(100, Math.round((answeredCount / assignedCount) * 100)),
      correctRate: answeredCount === 0 ? null : correctCount / answeredCount,
      status: progressStatus(assignedCount, answeredCount, correctCount),
    };
  });
}

export function buildClassStudentList(db: DatabaseSync, classId: string) {
  const { learners, questions, assignments, events } = classRows(db, classId);
  return learners.map((learner) => {
    const lessonProgress = progressForLearner(learner.id, questions, assignments, events);
    const assignedCount = lessonProgress.reduce((total, item) => total + item.assignedCount, 0);
    const answeredCount = lessonProgress.reduce((total, item) => total + item.answeredCount, 0);
    const latestActivityAt = events
      .filter((event) => event.learner_id === learner.id)
      .map((event) => event.occurred_at)
      .sort()
      .at(-1);
    return {
      ...learner,
      progressPercent:
        assignedCount === 0 ? 0 : Math.min(100, Math.round((answeredCount / assignedCount) * 100)),
      needsSupportCount: lessonProgress.filter((item) => item.status === 'NEEDS_SUPPORT').length,
      latestActivityAt: latestActivityAt ?? null,
      lessonProgress,
    };
  });
}

export function buildStudentDetail(db: DatabaseSync, classId: string, learnerId: string) {
  const { learners, questions, assignments, events } = classRows(db, classId);
  const learner = learners.find((candidate) => candidate.id === learnerId);
  if (!learner) return null;
  const lessonProgress = progressForLearner(learnerId, questions, assignments, events);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const learnerEvents = events.filter((event) => event.learner_id === learnerId);
  const assignedWork = assignments.flatMap((assignment) => {
    const recipients = parseStringArray(assignment.recipient_ids_json);
    if (recipients.length > 0 && !recipients.includes(learnerId)) return [];
    const questionIds = parseStringArray(assignment.question_ids_json);
    const answeredQuestionIds = new Set(
      learnerEvents
        .filter(
          (event) => event.assignment_id === assignment.id && parseCorrect(event.payload) !== null,
        )
        .map((event) => questionById.get(event.item_id)?.id ?? event.item_id),
    );
    return [
      {
        id: assignment.id,
        title: assignment.title,
        teacherMessage: assignment.teacher_message,
        createdAt: assignment.created_at,
        dueAt: assignment.due_at,
        questionCount: questionIds.length,
        answeredCount: answeredQuestionIds.size,
        status:
          answeredQuestionIds.size === 0
            ? 'NOT_STARTED'
            : answeredQuestionIds.size < questionIds.length
              ? 'IN_PROGRESS'
              : 'COMPLETED',
      },
    ];
  });
  const recommendedLessons = lessonProgress
    .filter((item) => item.status === 'NEEDS_SUPPORT')
    .map((item) => ({
      kcId: item.kcId,
      lessonName: item.lessonName,
      reason: `${item.correctCount}/${item.answeredCount} câu gần nhất đúng`,
      recommendedQuestionIds: questions
        .filter((question) => question.kc_id === item.kcId)
        .slice(0, 5)
        .map((question) => question.id),
    }));
  return { ...learner, lessonProgress, assignedWork, recommendedLessons };
}
