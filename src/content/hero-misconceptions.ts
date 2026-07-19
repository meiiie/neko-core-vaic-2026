import type { ReviewState } from '../domain';

export interface HeroMisconceptionDefinition {
  readonly id: string;
  readonly nameVi: string;
  readonly observablePatternVi: string;
  readonly reviewState: ReviewState;
}

/**
 * Small, authored vocabulary used by distractors in the competition slice.
 * These are observable error patterns, not fixed labels for a learner.
 */
export const HERO_MISCONCEPTIONS: readonly HeroMisconceptionDefinition[] = [
  {
    id: 'ADDITIVE_EQUIVALENCE',
    nameVi: 'Thay đổi tử và mẫu theo phép cộng',
    observablePatternVi: 'Cộng cùng một lượng vào tử và mẫu thay vì nhân cùng một hệ số.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'SCALE_ONE_PART_ONLY',
    nameVi: 'Chỉ thay đổi một thành phần',
    observablePatternVi: 'Thay đổi tử hoặc mẫu nhưng không giữ quan hệ nhân giữa hai thành phần.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'RATIO_ORDER_REVERSED',
    nameVi: 'Đảo thứ tự đại lượng trong tỉ số',
    observablePatternVi: 'Viết tỉ số theo thứ tự ngược với câu hỏi.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'PART_TO_WHOLE_CONFUSION',
    nameVi: 'Nhầm tỉ số bộ phận–bộ phận với bộ phận–toàn thể',
    observablePatternVi: 'Dùng tổng số lượng làm vế thứ hai khi đề hỏi so sánh hai nhóm.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'NUMERATOR_DENOMINATOR_SWAP',
    nameVi: 'Đảo tử số và mẫu số',
    observablePatternVi: 'Hoán đổi vai trò của tử số và mẫu số trong biểu diễn.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'WHOLE_NUMBER_THINKING',
    nameVi: 'Áp dụng suy luận số tự nhiên cho phân số hoặc tỉ lệ',
    observablePatternVi: 'Xử lý riêng từng số mà không bảo toàn quan hệ phân số hoặc tỉ lệ.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'PART_TO_PART',
    nameVi: 'Nhầm quan hệ bộ phận–toàn thể',
    observablePatternVi: 'Diễn giải phân số như quan hệ giữa hai bộ phận độc lập.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'ADDITIVE_COMPARISON',
    nameVi: 'So sánh cộng thay cho quan hệ nhân',
    observablePatternVi: 'Dùng hiệu hoặc phép cộng thay vì hệ số tỉ lệ.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'WRONG_SCALE_FACTOR',
    nameVi: 'Chọn sai hệ số nhân',
    observablePatternVi: 'Nhận ra cần nhân nhưng dùng hệ số không nhất quán cho hai vế.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'UNVERIFIED_EQUALITY',
    nameVi: 'Chấp nhận đẳng thức chưa được kiểm tra',
    observablePatternVi: 'Kết luận hai tỉ số bằng nhau mà không kiểm tra quan hệ nhân.',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'INCOMPLETE_CROSS_MULTIPLY',
    nameVi: 'Nhân chéo chưa hoàn chỉnh',
    observablePatternVi: 'Bắt đầu quy tắc nhân chéo nhưng thiếu hoặc sai bước cô lập ẩn số.',
    reviewState: 'UNREVIEWED',
  },
];

export function heroMisconceptionName(id: string): string {
  return HERO_MISCONCEPTIONS.find((definition) => definition.id === id)?.nameVi ?? id;
}

/** The authored vocabulary a generated distractor may reference. Anything else is rejected. */
export const HERO_MISCONCEPTION_IDS: readonly string[] = HERO_MISCONCEPTIONS.map(
  (definition) => definition.id,
);
