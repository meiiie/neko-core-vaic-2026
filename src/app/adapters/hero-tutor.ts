import {
  buildHeroClassDashboard,
  HERO_DEMO_CONFIG,
  HERO_EVENTS,
  HERO_GRAPH,
  HERO_ITEMS,
  HERO_QUESTIONS,
  type HeroQuestion,
  type HeroSimulationProfileId,
} from '../../content';
import {
  diagnose,
  type DiagnosisReasonCode,
  type DiagnosisResult,
  type DiagnosisStatus,
  type LearnerEvent,
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

export const HERO_LEARNERS: ReadonlyArray<{
  id: HeroSimulationProfileId;
  label: string;
  note: string;
}> = [
  { id: 'an', label: 'An', note: 'Cùng sai một bài — bằng chứng chỉ về phân số bằng nhau' },
  { id: 'binh', label: 'Bình', note: 'Cùng sai một bài — bằng chứng chỉ về ý nghĩa tỉ số' },
  {
    id: 'chi',
    label: 'Chi',
    note: 'Bằng chứng thưa và mâu thuẫn — hệ thống phải trả lời "cần thêm bằng chứng"',
  },
  { id: 'minh', label: 'Minh', note: 'Đã nắm vững — nhận thử thách chuyển giao, không học lại' },
];

export function isHeroLearnerId(value: string | undefined): value is HeroSimulationProfileId {
  return value !== undefined && Object.hasOwn(HERO_EVENTS, value);
}

export function kcName(kcId: string): string {
  return HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;
}

export function questionForItem(itemId: string): HeroQuestion | undefined {
  return HERO_QUESTIONS.find((question) => question.itemId === itemId);
}

/** Payload stored in the local Dexie event record for a hero answer. */
interface HeroAnswerPayload {
  choiceId: string;
  correct: boolean;
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
      return { choiceId: parsed.choiceId, correct: parsed.correct };
    }
    return null;
  } catch {
    return null;
  }
}

function seededMaxSequence(learnerId: HeroSimulationProfileId): number {
  return HERO_EVENTS[learnerId].reduce((max, event) => Math.max(max, event.sequence), 0);
}

/** Build the Dexie record for a locally answered hero question. */
export function buildLocalAnswerRecord(
  learnerId: HeroSimulationProfileId,
  itemId: string,
  choiceId: string,
  correct: boolean,
  existingLocalCount: number,
): LearnerEventRecord {
  return {
    id: `${learnerId}-local-${crypto.randomUUID()}`,
    learnerId,
    itemId,
    sequence: seededMaxSequence(learnerId) + existingLocalCount + 1,
    occurredAt: new Date().toISOString(),
    kind: 'ANSWER',
    payload: JSON.stringify({ choiceId, correct } satisfies HeroAnswerPayload),
  };
}

/** Map locally persisted answer records onto domain events; skip malformed rows. */
export function toDomainEvents(records: readonly LearnerEventRecord[]): LearnerEvent[] {
  const events: LearnerEvent[] = [];
  for (const record of records) {
    const payload = parsePayload(record.payload);
    if (!payload) continue;
    events.push({
      id: record.id,
      learnerId: record.learnerId,
      itemId: record.itemId,
      sequence: record.sequence,
      occurredAt: record.occurredAt,
      correct: payload.correct,
    });
  }
  return events;
}

/**
 * Diagnose a hero learner from the seeded demo evidence plus any answers the
 * user recorded locally in this browser. Pure domain call — no persistence.
 */
export function diagnoseHero(
  learnerId: HeroSimulationProfileId,
  localRecords: readonly LearnerEventRecord[] = [],
): DiagnosisResult {
  return diagnose({
    learnerId,
    targetKcId: HERO_TARGET_KC_ID,
    graph: HERO_GRAPH,
    items: HERO_ITEMS,
    events: [...HERO_EVENTS[learnerId], ...toDomainEvents(localRecords)],
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

export const REASON_LABELS: Record<DiagnosisReasonCode, string> = {
  ROOT_GAP_SUPPORTED: 'Khoảng trống gốc có đủ bằng chứng trực tiếp',
  COMPETING_ROOTS: 'Còn nhiều giả thuyết gốc cạnh tranh',
  INSUFFICIENT_DIRECT_EVIDENCE: 'Chưa đủ bằng chứng trực tiếp',
  DIAGNOSTIC_BUDGET_EXHAUSTED: 'Đã dùng hết ngân sách câu hỏi chẩn đoán',
  TARGET_AND_PREREQUISITES_MASTERED: 'Mục tiêu và các kiến thức nền đều đã vững',
  TARGET_OUTSIDE_GRAPH: 'Mục tiêu nằm ngoài đồ thị đã duyệt',
  NO_ACTIONABLE_ROOT: 'Không tìm thấy gốc có thể hành động',
  NO_VALID_PATH: 'Không có lộ trình hợp lệ',
};

export function actionLabel(actionId: string): string {
  if (actionId.startsWith('RETEACH_')) {
    const kcId = actionId.slice('RETEACH_'.length);
    return `Dạy lại "${kcName(kcId)}" (nhóm nhỏ hoặc cả lớp)`;
  }
  if (actionId === 'OFFER_TRANSFER_CHALLENGE') return 'Giao bài thử thách chuyển giao';
  if (actionId === 'RUN_QUICK_CHECK') return 'Kiểm tra nhanh 2 phút để thu thêm bằng chứng';
  return actionId;
}

export const GROUP_STATUS_LABELS: Record<string, string> = {
  ACTIONABLE_ROOT: 'Nhóm theo gốc cần can thiệp',
  QUICK_CHECK: 'Cần kiểm tra nhanh',
  READY_TO_ADVANCE: 'Sẵn sàng tiến tiếp',
};

export const UNREVIEWED_LABEL = 'Giả thuyết cần giáo viên xác nhận — nội dung chưa được duyệt';
