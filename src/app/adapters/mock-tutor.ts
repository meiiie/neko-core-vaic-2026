/**
 * TEMPORARY integration fixtures for the UI lane.
 *
 * These types mirror the stable integration contract in
 * docs/IMPLEMENTATION_MASTER_PLAN.md §5. They exist so the PWA shell can be
 * typed before `src/domain/**` (Codex lane) lands. Once `src/domain/index.ts`
 * exports the real contract, delete this file and import from the domain
 * package instead. Do NOT add diagnosis/path/grouping logic here.
 */

export type DiagnosisStatus = 'DIAGNOSED' | 'NEEDS_MORE_EVIDENCE' | 'OUT_OF_SCOPE' | 'FAST_PATH';

export interface DiagnosisResult {
  status: DiagnosisStatus;
  learnerId: string;
  targetKcId: string;
  rootKcId?: string;
  competingKcIds: string[];
  evidenceEventIds: string[];
  nextItemId?: string;
  pathKcIds: string[];
  reasonCodes: string[];
  contentVersion: string;
  algorithmVersion: string;
}

export interface TeacherGroup {
  id: string;
  status: 'ACTIONABLE_ROOT' | 'QUICK_CHECK' | 'READY_TO_ADVANCE';
  rootKcId?: string;
  learnerIds: string[];
  sufficientEvidenceCount: number;
  totalLearnerCount: number;
  blockedDescendantCount: number;
  priorityScore: number;
  representativeEventIds: string[];
  suggestedActionId: string;
}

/** Hero learners from docs/CONTENT_MODEL_DRAFT.md — presentation metadata only. */
export const HERO_LEARNERS: ReadonlyArray<{ id: string; label: string; note: string }> = [
  { id: 'an', label: 'An', note: 'Cùng sai một bài — giả thuyết gốc: phân số bằng nhau' },
  { id: 'binh', label: 'Bình', note: 'Cùng sai một bài — giả thuyết gốc: ý nghĩa tỉ số' },
  {
    id: 'chi',
    label: 'Chi',
    note: 'Bằng chứng thưa — hệ thống phải trả lời "cần thêm bằng chứng"',
  },
  { id: 'minh', label: 'Minh', note: 'Đã nắm vững — nhận lộ trình tiến nhanh' },
];
