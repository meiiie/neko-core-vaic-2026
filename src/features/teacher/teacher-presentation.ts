import { actionLabel } from '../../app/adapters/hero-tutor';

export const TEACHER_GROUP_LABELS: Record<string, string> = {
  ACTIONABLE_ROOT: 'Nhóm cần ôn lại',
  QUICK_CHECK: 'Cần làm thêm câu hỏi',
  TEACHER_REVIEW: 'Cần cô xem xét',
  READY_TO_ADVANCE: 'Sẵn sàng học bài mới',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  UNSPECIFIED: 'Chưa phân loại',
  EASY: 'Dễ',
  MEDIUM: 'Vừa',
  HARD: 'Khó',
};

export function teacherActionLabel(actionId: string): string {
  const label = actionLabel(actionId);
  if (label.startsWith('Dạy lại')) return label.replace('Dạy lại', 'Ôn lại');
  if (actionId === 'RUN_QUICK_CHECK') return 'Cho nhóm làm thêm một câu hỏi ngắn trong 2 phút';
  if (actionId === 'REVIEW_DIAGNOSIS') return 'Xem lại bằng chứng trước khi giao bài';
  if (actionId === 'OFFER_TRANSFER_CHALLENGE') return 'Giao bài mới có mức thử thách cao hơn';
  return label;
}

export function priorityBand(score: number): 'SUPPORT_FIRST' | 'MONITOR' {
  return score > 0 ? 'SUPPORT_FIRST' : 'MONITOR';
}
