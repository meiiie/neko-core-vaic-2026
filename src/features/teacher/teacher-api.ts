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
  readonly reviewLearnerRate: number;
  readonly wrongAnswerCount: number;
  readonly evidenceAnswerCount: number;
  readonly wrongAnswerRate: number;
  readonly recommendedKcIds: readonly string[];
  readonly recommendedQuestionIds: readonly string[];
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

export interface TeacherClassDto {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly schoolYear: string;
  readonly createdAt: string;
  readonly studentCount: number;
  readonly needsSupportCount: number;
}

export type LessonProgressStatus =
  'NOT_ASSIGNED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_SUPPORT';

export interface LessonProgressDto {
  readonly kcId: string;
  readonly lessonName: string;
  readonly assignedCount: number;
  readonly answeredCount: number;
  readonly correctCount: number;
  readonly progressPercent: number;
  readonly correctRate: number | null;
  readonly status: LessonProgressStatus;
}

export interface TeacherStudentSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly initials: string;
  readonly shortName: string;
  readonly progressPercent: number;
  readonly needsSupportCount: number;
  readonly latestActivityAt: string | null;
  readonly lessonProgress: readonly LessonProgressDto[];
}

export interface TeacherStudentDetailDto extends Omit<
  TeacherStudentSummaryDto,
  'progressPercent' | 'needsSupportCount' | 'latestActivityAt'
> {
  readonly assignedWork: readonly {
    id: string;
    title: string;
    teacherMessage: string;
    createdAt: string;
    dueAt: string | null;
    questionCount: number;
    answeredCount: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  }[];
  readonly recommendedLessons: readonly {
    kcId: string;
    lessonName: string;
    reason: string;
    recommendedQuestionIds: readonly string[];
  }[];
}

export async function fetchTeacherClasses(
  signal?: AbortSignal,
): Promise<readonly TeacherClassDto[]> {
  const response = await fetchWithDeadline('/api/teacher/classes', {
    credentials: 'include',
    deadlineMs: 8_000,
    signal,
  });
  if (!response.ok) throw new Error(`TEACHER_CLASSES_${response.status}`);
  const body = (await response.json()) as { classes: TeacherClassDto[] };
  return body.classes;
}

export async function fetchTeacherDashboard(
  classId?: string | null,
  signal?: AbortSignal,
): Promise<TeacherDashboardDto> {
  const url = classId
    ? `/api/teacher/classes/${encodeURIComponent(classId)}/dashboard`
    : '/api/teacher/dashboard';
  const response = await fetchWithDeadline(url, {
    credentials: 'include',
    deadlineMs: 8_000,
    signal,
  });
  if (!response.ok) throw new Error(`TEACHER_DASHBOARD_${response.status}`);
  return (await response.json()) as TeacherDashboardDto;
}

export async function saveTeacherOverride(
  input: SaveTeacherOverrideInput,
  classId?: string | null,
): Promise<void> {
  const response = await fetchWithDeadline(
    `/api/teacher/overrides${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      deadlineMs: 8_000,
    },
  );
  if (!response.ok) throw new Error(`TEACHER_OVERRIDE_${response.status}`);
}

export async function createTeacherClass(input: {
  name: string;
  subject: string;
  schoolYear: string;
}): Promise<TeacherClassDto> {
  const response = await fetchWithDeadline('/api/teacher/classes', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    deadlineMs: 8_000,
  });
  if (!response.ok) throw new Error(`CREATE_CLASS_${response.status}`);
  return (await response.json()) as TeacherClassDto;
}

export async function fetchClassStudents(
  classId: string,
  signal?: AbortSignal,
): Promise<{ class: TeacherClassDto; students: readonly TeacherStudentSummaryDto[] }> {
  const response = await fetchWithDeadline(
    `/api/teacher/classes/${encodeURIComponent(classId)}/students`,
    { credentials: 'include', deadlineMs: 8_000, signal },
  );
  if (!response.ok) throw new Error(`CLASS_STUDENTS_${response.status}`);
  return (await response.json()) as {
    class: TeacherClassDto;
    students: TeacherStudentSummaryDto[];
  };
}

export async function fetchStudentDetail(
  classId: string,
  studentId: string,
  signal?: AbortSignal,
): Promise<{ class: TeacherClassDto; student: TeacherStudentDetailDto }> {
  const response = await fetchWithDeadline(
    `/api/teacher/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    { credentials: 'include', deadlineMs: 8_000, signal },
  );
  if (!response.ok) throw new Error(`STUDENT_DETAIL_${response.status}`);
  return (await response.json()) as { class: TeacherClassDto; student: TeacherStudentDetailDto };
}
