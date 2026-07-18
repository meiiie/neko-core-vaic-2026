import { kcName } from '../../app/adapters/hero-tutor';
import type { TeacherOverrideDto, TeacherSupportGroupDto } from './teacher-api';

export interface TeacherLearnerWrongAnswer {
  readonly eventId: string;
  readonly questionId: string;
  readonly prompt: string;
  readonly selectedChoiceLabel: string;
  readonly correctChoiceLabel: string;
  readonly occurredAt: string;
  readonly assignmentTitle: string;
}

export interface TeacherLearnerEvidenceRow {
  readonly learnerId: string;
  readonly learnerLabel: string;
  readonly decisionLabel: string;
  readonly evidenceCount: number;
  readonly wrongAnswers: readonly TeacherLearnerWrongAnswer[];
  readonly overridden: boolean;
}

const GROUP_DECISION_LABELS = {
  ACTIONABLE_ROOT: 'Đã đánh giá',
  QUICK_CHECK: 'Cần làm thêm câu hỏi',
  TEACHER_REVIEW: 'Cần cô xem xét',
  READY_TO_ADVANCE: 'Sẵn sàng học bài mới',
} as const;

export function buildTeacherLearnerEvidenceRows(
  group: TeacherSupportGroupDto,
  overrides: readonly TeacherOverrideDto[],
): readonly TeacherLearnerEvidenceRow[] {
  const decisionLabel = group.rootKcId
    ? `Cần ôn: ${kcName(group.rootKcId)}`
    : (GROUP_DECISION_LABELS[group.status] ?? 'Đã đánh giá');

  return group.learners.map((learner) => ({
    learnerId: learner.id,
    learnerLabel: learner.displayLabel,
    decisionLabel,
    evidenceCount: learner.eventCount,
    wrongAnswers: group.wrongQuestions.flatMap((question) =>
      question.answers
        .filter((answer) => answer.learnerId === learner.id && !answer.correct)
        .map((answer) => ({
          eventId: answer.eventId,
          questionId: question.questionId,
          prompt: question.prompt,
          selectedChoiceLabel: answer.selectedChoiceLabel,
          correctChoiceLabel: answer.correctChoiceLabel,
          occurredAt: answer.occurredAt,
          assignmentTitle: answer.assignmentTitle,
        })),
    ),
    overridden: overrides.some(
      (override) => override.learnerId === learner.id && override.targetKcId === 'K10',
    ),
  }));
}
