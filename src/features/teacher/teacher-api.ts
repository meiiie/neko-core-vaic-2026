import type {
  ClassWideGap,
  TeacherAttentionPlan,
  TeacherGroup,
  TeacherOverrideDecision,
} from '../../domain';
import { fetchWithDeadline } from '../../services/fetch-with-deadline';

export interface TeacherLearnerDto {
  readonly id: string;
  readonly displayLabel: string;
  readonly eventCount: number;
}

export interface TeacherAnswerEvidenceDto {
  readonly eventId: string;
  readonly learnerId: string;
  readonly learnerName: string;
  readonly questionId: string;
  readonly prompt: string;
  readonly selectedChoiceId: string | null;
  readonly selectedChoiceLabel: string;
  readonly correctChoiceId: string;
  readonly correctChoiceLabel: string;
  readonly correct: boolean;
  readonly occurredAt: string;
  readonly assignmentId: string | null;
  readonly assignmentTitle: string;
}

export interface TeacherWrongQuestionDto {
  readonly questionId: string;
  readonly kcId: string;
  readonly prompt: string;
  readonly wrongLearnerCount: number;
  readonly answers: readonly TeacherAnswerEvidenceDto[];
}

export interface TeacherSupportGroupDto extends TeacherGroup {
  readonly learners: readonly TeacherLearnerDto[];
  readonly wrongQuestions: readonly TeacherWrongQuestionDto[];
}

export interface TeacherOverrideDto {
  readonly id: string;
  readonly learnerId: string;
  readonly targetKcId: string;
  readonly decision: TeacherOverrideDecision;
  readonly rootKcId?: string;
  readonly reason: string;
  readonly updatedAt: string;
}

export interface TeacherDashboardDto {
  readonly dataSource: 'SERVER';
  readonly generatedAt: string;
  readonly latestAnswerAt: string | null;
  readonly classId: string;
  readonly className: string;
  readonly rosterCount: number;
  readonly evaluatedLearnerCount: number;
  readonly answerEventCount: number;
  readonly learners: readonly TeacherLearnerDto[];
  readonly groups: readonly TeacherSupportGroupDto[];
  readonly classWideGaps: readonly ClassWideGap[];
  readonly attentionPlan: TeacherAttentionPlan;
  readonly overrides: readonly TeacherOverrideDto[];
}

export interface SaveTeacherOverrideInput {
  readonly learnerId: string;
  readonly targetKcId: string;
  readonly decision: TeacherOverrideDecision;
  readonly rootKcId?: string;
  readonly reason: string;
}

export const EMPTY_TEACHER_DASHBOARD: TeacherDashboardDto = {
  dataSource: 'SERVER',
  generatedAt: '',
  latestAnswerAt: null,
  classId: '',
  className: 'Lớp học',
  rosterCount: 0,
  evaluatedLearnerCount: 0,
  answerEventCount: 0,
  learners: [],
  groups: [],
  classWideGaps: [],
  attentionPlan: {
    policyVersion: 'teacher-budget-v1',
    budgetMinutes: 15,
    usedMinutes: 0,
    remainingMinutes: 15,
    selected: [],
    deferred: [],
  },
  overrides: [],
};

export async function fetchTeacherDashboard(signal?: AbortSignal): Promise<TeacherDashboardDto> {
  const response = await fetchWithDeadline('/api/teacher/dashboard', {
    credentials: 'include',
    deadlineMs: 8_000,
    signal,
  });
  if (!response.ok) throw new Error(`TEACHER_DASHBOARD_${response.status}`);
  return (await response.json()) as TeacherDashboardDto;
}

export async function saveTeacherOverride(input: SaveTeacherOverrideInput): Promise<void> {
  const response = await fetchWithDeadline('/api/teacher/overrides', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    deadlineMs: 8_000,
  });
  if (!response.ok) throw new Error(`TEACHER_OVERRIDE_${response.status}`);
}
