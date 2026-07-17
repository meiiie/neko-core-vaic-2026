/**
 * TEMPORARY integration fixtures for the UI lane.
 *
 * Presentation fixtures stay here; domain contracts come from the real core.
 * Do NOT add diagnosis/path/grouping logic to this adapter.
 */

export type { DiagnosisResult, DiagnosisStatus, TeacherGroup } from '../../domain';

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
