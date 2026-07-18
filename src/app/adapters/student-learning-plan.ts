import type { CurriculumNodeView } from '../../content';
import type { DiagnosisResult } from '../../domain';
import type { LearnerEventRecord } from '../../storage/db';
import type { ResourceRecord } from '../../storage/db';
import { selectResourcesForStep } from './resource-selection';

export type StudentPlanStatus =
  'NEEDS_CHECK_IN' | 'READY' | 'IN_PROGRESS' | 'TEACHER_REVIEW' | 'COMPLETED' | 'FAST_PATH';

export type StudentStepPhase = 'EXPLAIN' | 'GUIDED_PRACTICE' | 'POST_CHECK' | 'DONE';

export interface StudentLearningStep {
  readonly kcId: string;
  readonly gradeLabels: readonly number[];
  readonly titleVi: string;
  readonly reasonVi: string;
  readonly phase: StudentStepPhase;
  readonly status: 'CURRENT' | 'UPCOMING' | 'DONE';
  readonly resourceIds: readonly string[];
  readonly estimatedMinutes: number;
  readonly nextHref: string;
  readonly nextActionVi: string;
}

export interface StudentLearningPlan {
  readonly status: StudentPlanStatus;
  readonly targetKcId: string;
  readonly rootKcId?: string;
  readonly steps: readonly StudentLearningStep[];
  readonly currentStepIndex?: number;
  readonly checkInQuestionLimit: number;
  readonly contentVersion: string;
  readonly algorithmVersion: string;
}

export interface StudentLearningPlanInput {
  readonly diagnosis: DiagnosisResult;
  readonly catalog: readonly CurriculumNodeView[];
  readonly records: readonly LearnerEventRecord[];
  readonly resources?: readonly ResourceRecord[];
  readonly checkInQuestionLimit?: number;
}

interface ActivityPayload {
  readonly kcId?: string;
  readonly correct?: boolean;
}

function parseActivity(record: LearnerEventRecord): ActivityPayload {
  try {
    const parsed: unknown = JSON.parse(record.payload);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return {
      ...('kcId' in parsed && typeof parsed.kcId === 'string' ? { kcId: parsed.kcId } : {}),
      ...('correct' in parsed && typeof parsed.correct === 'boolean'
        ? { correct: parsed.correct }
        : {}),
    };
  } catch {
    return {};
  }
}

function kcIdForActivity(record: LearnerEventRecord): string | undefined {
  const payloadKcId = parseActivity(record).kcId;
  if (payloadKcId) return payloadKcId;
  return /^(?:bank-)?(K\d{2})-/.exec(record.itemId)?.[1];
}

export function selectStudentPhase(
  kcId: string,
  records: readonly LearnerEventRecord[],
): StudentStepPhase {
  const relevant = records.filter((record) => kcIdForActivity(record) === kcId);
  const checkPassed = relevant.some(
    (record) => record.kind === 'POST_CHECK_ANSWER' && parseActivity(record).correct === true,
  );
  if (checkPassed) return 'DONE';

  const practicePassed = relevant.some(
    (record) => record.kind === 'PRACTICE_ANSWER' && parseActivity(record).correct === true,
  );
  if (practicePassed) return 'POST_CHECK';

  const explanationOpened = relevant.some((record) => record.kind === 'RESOURCE_VIEWED');
  return explanationOpened ? 'GUIDED_PRACTICE' : 'EXPLAIN';
}

function nextAction(
  kcId: string,
  phase: StudentStepPhase,
): Pick<StudentLearningStep, 'nextHref' | 'nextActionVi' | 'estimatedMinutes'> {
  switch (phase) {
    case 'EXPLAIN':
      return {
        nextHref: `/student/lesson/${kcId}`,
        nextActionVi: 'Mở tóm tắt 2 phút',
        estimatedMinutes: 2,
      };
    case 'GUIDED_PRACTICE':
      return {
        nextHref: `/student/practice?phase=guided&kc=${kcId}`,
        nextActionVi: 'Luyện có gợi ý',
        estimatedMinutes: 5,
      };
    case 'POST_CHECK':
      return {
        nextHref: `/student/practice?phase=check&kc=${kcId}`,
        nextActionVi: 'Kiểm tra lại không gợi ý',
        estimatedMinutes: 3,
      };
    case 'DONE':
      return { nextHref: '/student/path', nextActionVi: 'Đã hoàn thành', estimatedMinutes: 0 };
  }
}

function emptyPlan(
  diagnosis: DiagnosisResult,
  status: StudentPlanStatus,
  checkInQuestionLimit: number,
): StudentLearningPlan {
  return {
    status,
    targetKcId: diagnosis.targetKcId,
    steps: [],
    checkInQuestionLimit,
    contentVersion: diagnosis.contentVersion,
    algorithmVersion: diagnosis.algorithmVersion,
  };
}

/**
 * Project diagnosis + canonical activity events into student-facing actions.
 * This function is deterministic and never persists derived state.
 */
export function deriveStudentLearningPlan({
  diagnosis,
  catalog,
  records,
  resources = [],
  checkInQuestionLimit = 3,
}: StudentLearningPlanInput): StudentLearningPlan {
  if (diagnosis.status === 'OUT_OF_SCOPE') {
    return emptyPlan(diagnosis, 'TEACHER_REVIEW', checkInQuestionLimit);
  }
  if (diagnosis.status === 'NEEDS_MORE_EVIDENCE') {
    return emptyPlan(
      diagnosis,
      diagnosis.disposition === 'ASK_VERIFY' ? 'NEEDS_CHECK_IN' : 'TEACHER_REVIEW',
      checkInQuestionLimit,
    );
  }
  if (diagnosis.status === 'FAST_PATH') {
    return emptyPlan(diagnosis, 'FAST_PATH', checkInQuestionLimit);
  }
  if (!diagnosis.rootKcId || diagnosis.pathKcIds.length === 0) {
    return emptyPlan(diagnosis, 'TEACHER_REVIEW', checkInQuestionLimit);
  }

  const learnerRecords = records.filter((record) => record.learnerId === diagnosis.learnerId);
  const catalogById = new Map(catalog.map((node) => [node.id, node]));
  const targetTitle = catalogById.get(diagnosis.targetKcId)?.titleVi ?? diagnosis.targetKcId;
  const phases = diagnosis.pathKcIds.map((kcId) => selectStudentPhase(kcId, learnerRecords));
  const firstIncomplete = phases.findIndex((phase) => phase !== 'DONE');
  const currentStepIndex = firstIncomplete === -1 ? undefined : firstIncomplete;
  const steps = diagnosis.pathKcIds.map((kcId, index): StudentLearningStep => {
    const node = catalogById.get(kcId);
    const phase = phases[index] ?? 'EXPLAIN';
    const action = nextAction(kcId, phase);
    const gradeLabels = [...new Set(node?.anchors.map((anchor) => anchor.grade) ?? [])].sort(
      (left, right) => left - right,
    );
    return {
      kcId,
      gradeLabels,
      titleVi: node?.titleVi ?? kcId,
      reasonVi:
        index === 0
          ? `Đây là mắt xích nền cần củng cố trước khi quay lại ${targetTitle}.`
          : `Bước nối tiếp cần thiết để tiến gần hơn tới ${targetTitle}.`,
      phase,
      status: phase === 'DONE' ? 'DONE' : index === currentStepIndex ? 'CURRENT' : 'UPCOMING',
      resourceIds: selectResourcesForStep({ kcId, gradeLabels }, resources).map(
        (resource) => resource.id,
      ),
      ...action,
    };
  });

  const hasProgress = learnerRecords.some((record) =>
    ['RESOURCE_VIEWED', 'PRACTICE_ANSWER', 'POST_CHECK_ANSWER'].includes(record.kind),
  );
  return {
    status: currentStepIndex === undefined ? 'COMPLETED' : hasProgress ? 'IN_PROGRESS' : 'READY',
    targetKcId: diagnosis.targetKcId,
    rootKcId: diagnosis.rootKcId,
    steps,
    ...(currentStepIndex === undefined ? {} : { currentStepIndex }),
    checkInQuestionLimit,
    contentVersion: diagnosis.contentVersion,
    algorithmVersion: diagnosis.algorithmVersion,
  };
}

export function gradeBandVi(grades: readonly number[]): string {
  if (grades.length === 0) return 'Kiến thức nền';
  if (grades.length === 1) return `Kiến thức nền lớp ${grades[0]}`;
  return `Kiến thức nền lớp ${grades[0]}-${grades.at(-1)}`;
}

export function buildResourceViewedRecord(
  learnerId: string,
  kcId: string,
  existingRecords: readonly LearnerEventRecord[],
  occurredAt = new Date().toISOString(),
): LearnerEventRecord {
  const nextSequence =
    existingRecords
      .filter((record) => record.learnerId === learnerId)
      .reduce((maximum, record) => Math.max(maximum, record.sequence), 0) + 1;
  return {
    id: `${learnerId}:resource-viewed:text:${kcId}`,
    learnerId,
    itemId: `text:${kcId}`,
    sequence: nextSequence,
    occurredAt,
    kind: 'RESOURCE_VIEWED',
    payload: JSON.stringify({ kcId, resourceId: `text:${kcId}` }),
  };
}
