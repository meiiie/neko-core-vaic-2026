import type { DatabaseSync } from 'node:sqlite';
import { HERO_GRAPH } from '../src/content/hero-demo.ts';
import {
  allocateTeacherAttention,
  applyTeacherOverride,
  detectClassWideGaps,
  diagnose,
  groupForTeacher,
  type Item,
  type LearnerEvent,
  type MethodValidity,
  type TeacherDiagnosisOverride,
} from '../src/domain/index.ts';
import type {
  TeacherAnswerEvidenceDto,
  TeacherDashboardDto,
  TeacherOverrideDto,
  TeacherSupportGroupDto,
} from '../src/features/teacher/teacher-api.ts';

interface RosterRow {
  id: string;
  name: string;
}

interface QuestionRow {
  id: string;
  kc_id: string;
  prompt: string;
  choices_json: string;
  correct_choice_id: string;
  review_state: string;
}

interface EventRow {
  id: string;
  learner_id: string;
  item_id: string;
  assignment_id: string | null;
  sequence: number;
  occurred_at: string;
  payload: string;
}

interface OverrideRow {
  id: string;
  learner_id: string;
  target_kc_id: string;
  decision: 'SET_ROOT' | 'NEEDS_MORE_EVIDENCE';
  root_kc_id: string | null;
  reason: string;
  updated_at: string;
}

interface AnswerPayload {
  readonly choiceId: string | null;
  readonly correct: boolean;
  readonly methodValidity: MethodValidity;
  readonly misconceptionId?: string;
}

interface Choice {
  readonly id: string;
  readonly label: string;
  readonly misconceptionTag?: string;
}

const TARGET_KC_ID = 'K10';
const TEACHER_BUDGET_MINUTES = 15;
const ACTION_MINUTES: Readonly<Record<string, number>> = {
  RETEACH_K01: 8,
  RETEACH_K02: 10,
  RETEACH_K07: 8,
  RETEACH_K08: 8,
  RETEACH_K09: 8,
  RETEACH_K10: 8,
  RUN_QUICK_CHECK: 2,
  REVIEW_DIAGNOSIS: 5,
};

function parseAnswerPayload(payload: string): AnswerPayload | null {
  try {
    const value: unknown = JSON.parse(payload);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('correct' in value) ||
      typeof value.correct !== 'boolean'
    ) {
      return null;
    }
    const choiceId =
      'choiceId' in value && typeof value.choiceId === 'string' ? value.choiceId : null;
    const methodValidity =
      'methodValidity' in value &&
      (value.methodValidity === 'VALID' ||
        value.methodValidity === 'INVALID' ||
        value.methodValidity === 'UNKNOWN')
        ? value.methodValidity
        : 'UNKNOWN';
    const misconceptionId =
      'misconceptionId' in value && typeof value.misconceptionId === 'string'
        ? value.misconceptionId
        : undefined;
    return {
      choiceId,
      correct: value.correct,
      methodValidity,
      ...(misconceptionId ? { misconceptionId } : {}),
    };
  } catch {
    return null;
  }
}

function latestOverrides(rows: readonly OverrideRow[]): TeacherOverrideDto[] {
  const latest = new Map<string, TeacherOverrideDto>();
  for (const row of rows) {
    const key = `${row.learner_id}:${row.target_kc_id}`;
    if (latest.has(key)) continue;
    latest.set(key, {
      id: row.id,
      learnerId: row.learner_id,
      targetKcId: row.target_kc_id,
      decision: row.decision,
      ...(row.root_kc_id ? { rootKcId: row.root_kc_id } : {}),
      reason: row.reason,
      updatedAt: row.updated_at,
    });
  }
  return [...latest.values()];
}

export function buildTeacherDashboard(
  db: DatabaseSync,
  classId: string,
  teacherId: string,
): TeacherDashboardDto {
  const classRow = db.prepare('SELECT name FROM classes WHERE id = ?').get(classId) as
    { name: string } | undefined;
  const roster = db
    .prepare(
      `SELECT u.id, u.name
       FROM enrollments e JOIN users u ON u.id = e.user_id
       WHERE e.class_id = ? AND u.role = 'STUDENT'
       ORDER BY u.name`,
    )
    .all(classId) as unknown as RosterRow[];
  const questions = db.prepare('SELECT * FROM questions').all() as unknown as QuestionRow[];
  const assignments = db
    .prepare('SELECT id, title FROM assignments WHERE class_id = ?')
    .all(classId) as unknown as { id: string; title: string }[];
  const eventRows = db
    .prepare(
      `SELECT ev.id, ev.learner_id, ev.item_id, ev.assignment_id, ev.sequence,
              ev.occurred_at, ev.payload
       FROM events ev
       JOIN enrollments e ON e.user_id = ev.learner_id
       WHERE e.class_id = ?
       ORDER BY ev.learner_id, ev.sequence, ev.occurred_at, ev.id`,
    )
    .all(classId) as unknown as EventRow[];
  const overrideRows = db
    .prepare(
      `SELECT id, learner_id, target_kc_id, decision, root_kc_id, reason, updated_at
       FROM teacher_overrides
       WHERE class_id = ? AND teacher_id = ?
       ORDER BY updated_at DESC, id DESC`,
    )
    .all(classId, teacherId) as unknown as OverrideRow[];

  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const questionsByEventItemId = new Map<string, QuestionRow>();
  for (const question of questions) {
    questionsByEventItemId.set(question.id, question);
    if (question.id.startsWith('bank-')) {
      questionsByEventItemId.set(question.id.slice('bank-'.length), question);
    }
  }
  const assignmentTitles = new Map(
    assignments.map((assignment) => [assignment.id, assignment.title]),
  );
  const learnerNames = new Map(roster.map((learner) => [learner.id, learner.name]));
  const overrides = latestOverrides(overrideRows);
  const domainItems: Item[] = questions
    .filter((question) => HERO_GRAPH.nodes.some((node) => node.id === question.kc_id))
    .map((question) => {
      const misconceptionIds = [
        ...new Set(
          (JSON.parse(question.choices_json) as Choice[]).flatMap((choice) =>
            choice.misconceptionTag ? [choice.misconceptionTag] : [],
          ),
        ),
      ];
      return {
        id: question.id,
        kcIds: [question.kc_id],
        role: 'CHECK',
        ...(misconceptionIds.length > 0 ? { misconceptionIds } : {}),
        reviewState: question.review_state === 'ACCEPTED' ? 'ACCEPTED' : 'UNREVIEWED',
      };
    });
  const evidence = eventRows.flatMap((row) => {
    const payload = parseAnswerPayload(row.payload);
    const question = questionsByEventItemId.get(row.item_id);
    if (!payload || !question) return [];
    const selectedChoice = (JSON.parse(question.choices_json) as Choice[]).find(
      (choice) => choice.id === payload.choiceId,
    );
    const misconceptionId = payload.misconceptionId ?? selectedChoice?.misconceptionTag;
    const event: LearnerEvent = {
      id: row.id,
      learnerId: row.learner_id,
      itemId: question.id,
      sequence: row.sequence,
      occurredAt: row.occurred_at,
      correct: payload.correct,
      methodValidity:
        payload.methodValidity === 'UNKNOWN' && misconceptionId
          ? 'INVALID'
          : payload.methodValidity,
      ...(!payload.correct && misconceptionId ? { misconceptionId } : {}),
    };
    return [{ row, payload, event, question }];
  });
  const eventsByLearner = new Map<string, LearnerEvent[]>();
  for (const item of evidence) {
    eventsByLearner.set(item.event.learnerId, [
      ...(eventsByLearner.get(item.event.learnerId) ?? []),
      item.event,
    ]);
  }

  const diagnoses = roster.flatMap((learner) => {
    const events = eventsByLearner.get(learner.id) ?? [];
    if (events.length === 0) return [];
    const diagnosis = diagnose({
      learnerId: learner.id,
      targetKcId: TARGET_KC_ID,
      graph: HERO_GRAPH,
      items: domainItems,
      events,
      config: { allowUnreviewedContent: true },
    });
    const override = overrides.find(
      (candidate) =>
        candidate.learnerId === learner.id && candidate.targetKcId === diagnosis.targetKcId,
    );
    const domainOverride: TeacherDiagnosisOverride | undefined = override
      ? {
          learnerId: override.learnerId,
          targetKcId: override.targetKcId,
          decision: override.decision,
          ...(override.rootKcId ? { rootKcId: override.rootKcId } : {}),
        }
      : undefined;
    return [
      domainOverride ? applyTeacherOverride(HERO_GRAPH, diagnosis, domainOverride) : diagnosis,
    ];
  });
  const groups = groupForTeacher(HERO_GRAPH, diagnoses).filter(
    (group) => group.status !== 'READY_TO_ADVANCE',
  );

  const latestEvidence = new Map<string, (typeof evidence)[number]>();
  for (const item of evidence) {
    latestEvidence.set(`${item.event.learnerId}:${item.event.itemId}`, item);
  }

  const supportGroups: TeacherSupportGroupDto[] = groups.map((group) => {
    const learners = group.learnerIds.flatMap((learnerId) => {
      const displayLabel = learnerNames.get(learnerId);
      return displayLabel
        ? [{ id: learnerId, displayLabel, eventCount: eventsByLearner.get(learnerId)?.length ?? 0 }]
        : [];
    });
    const answersByQuestion = new Map<string, TeacherAnswerEvidenceDto[]>();
    for (const item of latestEvidence.values()) {
      if (!group.learnerIds.includes(item.event.learnerId) || item.event.correct) continue;
      const question = item.question;
      const learnerName = learnerNames.get(item.event.learnerId);
      if (!question || !learnerName) continue;
      const choices = JSON.parse(question.choices_json) as Choice[];
      const selectedChoice = choices.find((choice) => choice.id === item.payload.choiceId);
      const correctChoice = choices.find((choice) => choice.id === question.correct_choice_id);
      const answer: TeacherAnswerEvidenceDto = {
        eventId: item.event.id,
        learnerId: item.event.learnerId,
        learnerName,
        questionId: question.id,
        prompt: question.prompt,
        selectedChoiceId: item.payload.choiceId,
        selectedChoiceLabel: selectedChoice?.label ?? 'Không ghi nhận',
        correctChoiceId: question.correct_choice_id,
        correctChoiceLabel: correctChoice?.label ?? question.correct_choice_id,
        correct: false,
        occurredAt: item.event.occurredAt,
        assignmentId: item.row.assignment_id,
        assignmentTitle: item.row.assignment_id
          ? (assignmentTitles.get(item.row.assignment_id) ?? 'Bài được giao')
          : 'Luyện tập cá nhân',
      };
      answersByQuestion.set(question.id, [...(answersByQuestion.get(question.id) ?? []), answer]);
    }
    const wrongQuestions = [...answersByQuestion].map(([questionId, answers]) => {
      const question = questionsById.get(questionId)!;
      return {
        questionId,
        kcId: question.kc_id,
        prompt: question.prompt,
        wrongLearnerCount: answers.length,
        answers: answers.sort((left, right) => left.learnerName.localeCompare(right.learnerName)),
      };
    });
    const groupEvidence = [...latestEvidence.values()].filter((item) =>
      group.learnerIds.includes(item.event.learnerId),
    );
    const wrongAnswerCount = groupEvidence.filter((item) => !item.event.correct).length;
    const recommendedKcIds = [
      ...new Set([
        ...(group.rootKcId ? [group.rootKcId] : []),
        ...wrongQuestions.map((question) => question.kcId),
        ...(!group.rootKcId && wrongQuestions.length === 0 ? [TARGET_KC_ID] : []),
      ]),
    ];
    const recommendedQuestionIds = questions
      .filter((question) => recommendedKcIds.includes(question.kc_id))
      .map((question) => question.id)
      .sort();
    return {
      ...group,
      learners,
      wrongQuestions,
      reviewLearnerRate:
        eventsByLearner.size > 0 ? group.totalLearnerCount / eventsByLearner.size : 0,
      wrongAnswerCount,
      evidenceAnswerCount: groupEvidence.length,
      wrongAnswerRate: groupEvidence.length > 0 ? wrongAnswerCount / groupEvidence.length : 0,
      recommendedKcIds,
      recommendedQuestionIds,
    };
  });

  return {
    dataSource: 'SERVER',
    generatedAt: new Date().toISOString(),
    latestAnswerAt: evidence.reduce<string | null>(
      (latest, item) =>
        !latest || item.event.occurredAt > latest ? item.event.occurredAt : latest,
      null,
    ),
    classId,
    className: classRow?.name ?? classId,
    rosterCount: roster.length,
    evaluatedLearnerCount: eventsByLearner.size,
    answerEventCount: evidence.length,
    learners: roster.map((learner) => ({
      id: learner.id,
      displayLabel: learner.name,
      eventCount: eventsByLearner.get(learner.id)?.length ?? 0,
    })),
    groups: supportGroups,
    classWideGaps: detectClassWideGaps(groups, roster.length),
    attentionPlan: allocateTeacherAttention(groups, TEACHER_BUDGET_MINUTES, ACTION_MINUTES),
    overrides,
  };
}
