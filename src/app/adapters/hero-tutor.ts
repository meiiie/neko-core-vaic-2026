import {
  buildHeroClassDashboard,
  HERO_DEMO_CONFIG,
  HERO_EVENTS,
  HERO_GRAPH,
  HERO_ITEMS,
  HERO_QUESTIONS,
  heroMisconceptionName,
  type HeroQuestion,
  type HeroSimulationProfileId,
} from '../../content';
import {
  diagnose,
  type DiagnosisDisposition,
  type DiagnosisReasonCode,
  type DiagnosisResult,
  type DiagnosisStatus,
  type LearnerEvent,
  type MethodValidity,
} from '../../domain';
import type { LearnerEventRecord } from '../../storage/db';

/**
 * UI adapter over the domain runtime exports. Components call these helpers;
 * they never re-implement diagnosis/grouping (AGENTS.md product invariant).
 * All content here is the guarded hero demo: UNREVIEWED items are allowed
 * only because HERO_DEMO_CONFIG opts in, and every surface that shows them
 * must render the "Chưa được giáo viên duyệt" warning label.
 */

export const HERO_TARGET_KC_ID = 'K10';

export interface StudentDiagnosisContext {
  readonly learnerId: string;
  readonly simulationProfileId?: HeroSimulationProfileId;
}

type StudentDiagnosisReference = HeroSimulationProfileId | StudentDiagnosisContext;

function normalizeStudentContext(reference: StudentDiagnosisReference): StudentDiagnosisContext {
  return typeof reference === 'string'
    ? { learnerId: reference, simulationProfileId: reference }
    : reference;
}

export function isHeroLearnerId(value: string | undefined): value is HeroSimulationProfileId {
  return value !== undefined && Object.hasOwn(HERO_EVENTS, value);
}

export function kcName(kcId: string): string {
  return HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;
}

export const misconceptionName = heroMisconceptionName;

export function questionForItem(itemId: string): HeroQuestion | undefined {
  return HERO_QUESTIONS.find((question) => question.itemId === itemId);
}

/** Payload stored in the local Dexie event record for a hero answer. */
interface HeroAnswerPayload {
  choiceId: string;
  correct: boolean;
  methodValidity: MethodValidity;
  misconceptionId?: string;
}

export interface LocalAnswerEvidence {
  readonly methodValidity?: MethodValidity;
  readonly misconceptionId?: string;
}

function parsePayload(payload: string): HeroAnswerPayload | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'correct' in parsed &&
      typeof parsed.correct === 'boolean' &&
      'choiceId' in parsed &&
      typeof parsed.choiceId === 'string'
    ) {
      const methodValidity =
        'methodValidity' in parsed &&
        ['VALID', 'INVALID', 'UNKNOWN'].includes(String(parsed.methodValidity))
          ? (parsed.methodValidity as MethodValidity)
          : 'UNKNOWN';
      const misconceptionId =
        'misconceptionId' in parsed && typeof parsed.misconceptionId === 'string'
          ? parsed.misconceptionId
          : undefined;
      return {
        choiceId: parsed.choiceId,
        correct: parsed.correct,
        methodValidity,
        ...(misconceptionId ? { misconceptionId } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function seededEvents(context: StudentDiagnosisContext): LearnerEvent[] {
  const profileId = context.simulationProfileId;
  if (!profileId) return [];
  if (context.learnerId === profileId) return [...HERO_EVENTS[profileId]];
  return HERO_EVENTS[profileId].map((event) => ({
    ...event,
    id: `${context.learnerId}-seed-${profileId}-${event.sequence}`,
    learnerId: context.learnerId,
  }));
}

function seededMaxSequence(context: StudentDiagnosisContext): number {
  return seededEvents(context).reduce((max, event) => Math.max(max, event.sequence), 0);
}

/** Build the Dexie record for a locally answered hero question. */
export function buildLocalAnswerRecord(
  reference: StudentDiagnosisReference,
  itemId: string,
  choiceId: string,
  correct: boolean,
  existingLocalCount: number,
  evidence: LocalAnswerEvidence = {},
): LearnerEventRecord {
  const context = normalizeStudentContext(reference);
  const authoredMisconceptionId = questionForItem(itemId)?.choices.find(
    (choice) => choice.id === choiceId,
  )?.misconceptionId;
  const misconceptionId = evidence.misconceptionId ?? authoredMisconceptionId;
  const methodValidity = evidence.methodValidity ?? (misconceptionId ? 'INVALID' : 'UNKNOWN');
  return {
    id: `${context.learnerId}-local-${crypto.randomUUID()}`,
    learnerId: context.learnerId,
    itemId,
    sequence: seededMaxSequence(context) + existingLocalCount + 1,
    occurredAt: new Date().toISOString(),
    kind: 'ANSWER',
    payload: JSON.stringify({
      choiceId,
      correct,
      methodValidity,
      ...(misconceptionId ? { misconceptionId } : {}),
    } satisfies HeroAnswerPayload),
  };
}

/** Map locally persisted answer records onto domain events; skip malformed rows. */
export function toDomainEvents(records: readonly LearnerEventRecord[]): LearnerEvent[] {
  const events: LearnerEvent[] = [];
  for (const record of records) {
    const payload = parsePayload(record.payload);
    const item = HERO_ITEMS.find((candidate) => candidate.id === record.itemId);
    if (!payload || !item) continue;
    const misconceptionId =
      item.misconceptionIds?.includes(payload.misconceptionId ?? '') &&
      (!payload.correct || payload.methodValidity === 'INVALID')
        ? payload.misconceptionId
        : undefined;
    events.push({
      id: record.id,
      learnerId: record.learnerId,
      itemId: record.itemId,
      sequence: record.sequence,
      occurredAt: record.occurredAt,
      correct: payload.correct,
      methodValidity: payload.methodValidity,
      ...(misconceptionId ? { misconceptionId } : {}),
    });
  }
  return events;
}

const HERO_ACCOUNT_PROFILE: Readonly<Record<string, HeroSimulationProfileId>> = {
  'user-student-an': 'an',
  'user-student-binh': 'binh',
  'user-student-chi': 'chi',
  'user-student-minh': 'minh',
};

/**
 * Adapt account-owned browser events to the four synthetic class profiles.
 * This mapping belongs only to the demo presentation boundary; domain and
 * persistence code continue to use the stable account ID.
 */
export function toHeroClassObservedEvents(records: readonly LearnerEventRecord[]): LearnerEvent[] {
  return toDomainEvents(records).flatMap((event) => {
    const profileId = isHeroLearnerId(event.learnerId)
      ? event.learnerId
      : HERO_ACCOUNT_PROFILE[event.learnerId];
    return profileId ? [{ ...event, learnerId: profileId }] : [];
  });
}

/**
 * Diagnose a hero learner from the seeded demo evidence plus any answers the
 * user recorded locally in this browser. Pure domain call — no persistence.
 */
export function diagnoseHero(
  reference: StudentDiagnosisReference,
  localRecords: readonly LearnerEventRecord[] = [],
): DiagnosisResult {
  const context = normalizeStudentContext(reference);
  const localEvents = toDomainEvents(localRecords).filter(
    (event) => event.learnerId === context.learnerId,
  );
  return diagnose({
    learnerId: context.learnerId,
    targetKcId: HERO_TARGET_KC_ID,
    graph: HERO_GRAPH,
    items: HERO_ITEMS,
    events: [...seededEvents(context), ...localEvents],
    config: HERO_DEMO_CONFIG,
  });
}

export { buildHeroClassDashboard };

export const STATUS_LABELS: Record<DiagnosisStatus, string> = {
  DIAGNOSED: 'Đủ bằng chứng — đã xác định gốc',
  NEEDS_MORE_EVIDENCE: 'Cần thêm bằng chứng',
  OUT_OF_SCOPE: 'Ngoài phạm vi',
  FAST_PATH: 'Sẵn sàng tiến nhanh',
};

export const DISPOSITION_LABELS: Record<DiagnosisDisposition, string> = {
  AUTO_REMEDIATE: 'Mở lộ trình bù đắp tự động',
  ASK_VERIFY: 'Hỏi thêm một câu để xác minh',
  TEACHER_REVIEW: 'Chuyển giáo viên xem xét',
  ADVANCE: 'Cho học sinh tiến tới bài chuyển giao',
  OUT_OF_SCOPE: 'Dừng và báo ngoài phạm vi',
};

export const REASON_LABELS: Record<DiagnosisReasonCode, string> = {
  ROOT_GAP_SUPPORTED: 'Khoảng trống gốc có đủ bằng chứng trực tiếp',
  COMPETING_ROOTS: 'Còn nhiều giả thuyết gốc cạnh tranh',
  INSUFFICIENT_DIRECT_EVIDENCE: 'Chưa đủ bằng chứng trực tiếp',
  DIAGNOSTIC_BUDGET_EXHAUSTED: 'Đã dùng hết ngân sách câu hỏi chẩn đoán',
  TARGET_AND_PREREQUISITES_MASTERED: 'Mục tiêu và các kiến thức nền đều đã vững',
  TARGET_OUTSIDE_GRAPH: 'Mục tiêu nằm ngoài đồ thị đã duyệt',
  NO_ACTIONABLE_ROOT: 'Không tìm thấy gốc có thể hành động',
  NO_VALID_PATH: 'Không có lộ trình hợp lệ',
  TEACHER_OVERRIDE_APPLIED: 'Giáo viên đã điều chỉnh quyết định dựa trên bằng chứng lớp học',
};

export function actionLabel(actionId: string): string {
  if (actionId.startsWith('RETEACH_')) {
    const kcId = actionId.slice('RETEACH_'.length);
    return `Dạy lại "${kcName(kcId)}" (nhóm nhỏ hoặc cả lớp)`;
  }
  if (actionId === 'OFFER_TRANSFER_CHALLENGE') return 'Giao bài thử thách chuyển giao';
  if (actionId === 'RUN_QUICK_CHECK') return 'Kiểm tra nhanh 2 phút để thu thêm bằng chứng';
  if (actionId === 'REVIEW_DIAGNOSIS') return 'Giáo viên xem lại bằng chứng chẩn đoán';
  return actionId;
}

export const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIONABLE_ROOT: 'Nhóm theo gốc cần can thiệp',
  QUICK_CHECK: 'Cần kiểm tra nhanh',
  TEACHER_REVIEW: 'Cần giáo viên xem xét',
  READY_TO_ADVANCE: 'Sẵn sàng tiến tiếp',
};

export const UNREVIEWED_LABEL = 'Giả thuyết cần giáo viên xác nhận — nội dung chưa được duyệt';
