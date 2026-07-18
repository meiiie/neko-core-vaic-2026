import type { CurriculumGraph, Item } from '../domain/index.ts';
import { contentGraphDraft } from './curriculum.ts';
import { PRACTICE_QUESTIONS } from './hero-practice.ts';
import { toSupportedDomainGraph } from './schema.ts';

export { eventsFor, HERO_EVENTS, type HeroAnswer } from './hero-events.ts';

/** KCs with complete synthetic questions in the current demo slice. */
export const HERO_SUPPORTED_KC_IDS = ['K01', 'K02', 'K07', 'K08', 'K09', 'K10'] as const;
export const HERO_CHECK_IN_QUESTION_LIMIT = 3;

export const HERO_GRAPH: CurriculumGraph = toSupportedDomainGraph(
  contentGraphDraft,
  HERO_SUPPORTED_KC_IDS,
);

function checkItems(kcId: string): Item[] {
  return [`${kcId}-CHECK-1`, `${kcId}-CHECK-2`].map((id) => {
    const misconceptionIds = [
      ...new Set(
        PRACTICE_QUESTIONS.find((question) => question.itemId === id)?.choices.flatMap((choice) =>
          choice.misconceptionTag ? [choice.misconceptionTag] : [],
        ) ?? [],
      ),
    ];
    return {
      id,
      kcIds: [kcId],
      role: 'CHECK',
      ...(misconceptionIds.length > 0 ? { misconceptionIds } : {}),
      reviewState: 'UNREVIEWED',
    } satisfies Item;
  });
}

export const HERO_ITEMS: Item[] = [
  ...HERO_SUPPORTED_KC_IDS.flatMap((kcId) => checkItems(kcId)),
  {
    id: 'K02-DIAGNOSTIC',
    kcIds: ['K02'],
    role: 'DIAGNOSTIC',
    misconceptionIds: ['ADDITIVE_EQUIVALENCE', 'SCALE_ONE_PART_ONLY'],
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'K07-DIAGNOSTIC',
    kcIds: ['K07'],
    role: 'DIAGNOSTIC',
    misconceptionIds: ['RATIO_ORDER_REVERSED', 'PART_TO_WHOLE_CONFUSION'],
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'K10-TRANSFER',
    kcIds: ['K10'],
    role: 'TRANSFER',
    misconceptionIds: ['ADDITIVE_COMPARISON', 'WHOLE_NUMBER_THINKING'],
    reviewState: 'UNREVIEWED',
  },
];

export interface HeroQuestion {
  readonly itemId: string;
  readonly promptVi: string;
  readonly choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly misconceptionId?: string;
  }[];
  readonly correctChoiceId: string;
  readonly hypothesisLabel: string;
}

export const HERO_QUESTIONS: readonly HeroQuestion[] = [
  {
    itemId: 'K10-CHECK-1',
    promptVi: 'Tìm x biết x/12 = 3/4. Em đã dùng quan hệ nào?',
    choices: [
      { id: 'a', label: 'x = 9; nhân cả tử và mẫu của 3/4 với 3' },
      {
        id: 'b',
        label: 'x = 6; cộng 3 vào tử và 8 vào mẫu',
        misconceptionId: 'ADDITIVE_EQUIVALENCE',
      },
      {
        id: 'c',
        label: 'x = 16; nhân chéo rồi cộng',
        misconceptionId: 'INCOMPLETE_CROSS_MULTIPLY',
      },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi chẩn đoán chưa được giáo viên duyệt',
  },
  {
    itemId: 'K02-DIAGNOSTIC',
    promptVi: 'Phân số nào bằng 3/4?',
    choices: [
      { id: 'a', label: '6/8' },
      { id: 'b', label: '4/5', misconceptionId: 'ADDITIVE_EQUIVALENCE' },
      { id: 'c', label: '6/7', misconceptionId: 'SCALE_ONE_PART_ONLY' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi phân biệt giả thuyết K02, chưa được giáo viên duyệt',
  },
  {
    itemId: 'K07-DIAGNOSTIC',
    promptVi: 'Một hộp có 3 bút đỏ và 5 bút xanh. Tỉ số số bút đỏ so với số bút xanh là?',
    choices: [
      { id: 'a', label: '3:5' },
      { id: 'b', label: '5:3', misconceptionId: 'RATIO_ORDER_REVERSED' },
      { id: 'c', label: '3:8', misconceptionId: 'PART_TO_WHOLE_CONFUSION' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi phân biệt giả thuyết K07, chưa được giáo viên duyệt',
  },
  {
    itemId: 'K10-TRANSFER',
    promptVi: 'Nếu 4 quyển vở giá 36.000 đồng, 7 quyển cùng loại có giá bao nhiêu?',
    choices: [
      { id: 'a', label: '63.000 đồng' },
      { id: 'b', label: '39.000 đồng', misconceptionId: 'ADDITIVE_COMPARISON' },
      { id: 'c', label: '72.000 đồng', misconceptionId: 'WHOLE_NUMBER_THINKING' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi chuyển giao chưa được giáo viên duyệt',
  },
];

export const HERO_DEMO_CONFIG = {
  allowUnreviewedContent: true,
  maxDiagnosticItems: HERO_CHECK_IN_QUESTION_LIMIT,
} as const;
