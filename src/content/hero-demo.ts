import type { CurriculumGraph, Item, LearnerEvent } from '../domain';

export const HERO_GRAPH: CurriculumGraph = {
  version: 'hero-demo-v1-unreviewed',
  nodes: [
    { id: 'K01', name: 'Ý nghĩa phân số' },
    { id: 'K02', name: 'Phân số bằng nhau' },
    { id: 'K07', name: 'Ý nghĩa và thứ tự của tỉ số' },
    { id: 'K08', name: 'Các tỉ số bằng nhau' },
    { id: 'K09', name: 'Định nghĩa tỉ lệ thức' },
    { id: 'K10', name: 'Tìm giá trị chưa biết trong tỉ lệ thức' },
  ],
  edges: [
    { from: 'K01', to: 'K02' },
    { from: 'K01', to: 'K07' },
    { from: 'K02', to: 'K08' },
    { from: 'K07', to: 'K08' },
    { from: 'K08', to: 'K09' },
    { from: 'K09', to: 'K10' },
  ],
};

function checkItems(kcId: string): Item[] {
  return [
    {
      id: `${kcId}-CHECK-1`,
      kcIds: [kcId],
      role: 'CHECK',
      reviewState: 'UNREVIEWED',
    },
    {
      id: `${kcId}-CHECK-2`,
      kcIds: [kcId],
      role: 'CHECK',
      reviewState: 'UNREVIEWED',
    },
  ];
}

export const HERO_ITEMS: Item[] = [
  ...HERO_GRAPH.nodes.flatMap((node) => checkItems(node.id)),
  {
    id: 'K02-DIAGNOSTIC',
    kcIds: ['K02'],
    role: 'DIAGNOSTIC',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'K07-DIAGNOSTIC',
    kcIds: ['K07'],
    role: 'DIAGNOSTIC',
    reviewState: 'UNREVIEWED',
  },
  {
    id: 'K10-TRANSFER',
    kcIds: ['K10'],
    role: 'TRANSFER',
    reviewState: 'UNREVIEWED',
  },
];

export interface HeroQuestion {
  readonly itemId: string;
  readonly promptVi: string;
  readonly choices: readonly { readonly id: string; readonly label: string }[];
  readonly correctChoiceId: string;
  readonly hypothesisLabel: string;
}

export const HERO_QUESTIONS: readonly HeroQuestion[] = [
  {
    itemId: 'K10-CHECK-1',
    promptVi: 'Tìm x biết x/12 = 3/4. Em đã dùng quan hệ nào?',
    choices: [
      { id: 'a', label: 'x = 9; nhân cả tử và mẫu của 3/4 với 3' },
      { id: 'b', label: 'x = 6; cộng 3 vào tử và 8 vào mẫu' },
      { id: 'c', label: 'x = 16; nhân chéo rồi cộng' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi demo chưa được giáo viên duyệt',
  },
  {
    itemId: 'K02-DIAGNOSTIC',
    promptVi: 'Phân số nào bằng 3/4?',
    choices: [
      { id: 'a', label: '6/8' },
      { id: 'b', label: '4/5' },
      { id: 'c', label: '6/7' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi phân biệt giả thuyết K02, chưa được giáo viên duyệt',
  },
  {
    itemId: 'K07-DIAGNOSTIC',
    promptVi: 'Một hộp có 3 bút đỏ và 5 bút xanh. Tỉ số số bút đỏ so với số bút xanh là?',
    choices: [
      { id: 'a', label: '3:5' },
      { id: 'b', label: '5:3' },
      { id: 'c', label: '3:8' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi phân biệt giả thuyết K07, chưa được giáo viên duyệt',
  },
  {
    itemId: 'K10-TRANSFER',
    promptVi: 'Nếu 4 quyển vở giá 36.000 đồng, 7 quyển cùng loại có giá bao nhiêu?',
    choices: [
      { id: 'a', label: '63.000 đồng' },
      { id: 'b', label: '39.000 đồng' },
      { id: 'c', label: '72.000 đồng' },
    ],
    correctChoiceId: 'a',
    hypothesisLabel: 'Câu hỏi chuyển giao demo, chưa được giáo viên duyệt',
  },
];

export type HeroAnswer = readonly [itemId: string, correct: boolean];

export function eventsFor(learnerId: string, answers: readonly HeroAnswer[]): LearnerEvent[] {
  return answers.map(([itemId, correct], index) => ({
    id: `${learnerId}-event-${index + 1}`,
    learnerId,
    itemId,
    sequence: index + 1,
    occurredAt: new Date(Date.UTC(2026, 6, 17, 8, index)).toISOString(),
    correct,
  }));
}

const mastered = (kcId: string): HeroAnswer[] => [
  [`${kcId}-CHECK-1`, true],
  [`${kcId}-CHECK-2`, true],
];

const gap = (kcId: string): HeroAnswer[] => [
  [`${kcId}-CHECK-1`, false],
  [`${kcId}-CHECK-2`, false],
];

export const HERO_EVENTS = {
  an: eventsFor('an', [
    ...mastered('K01'),
    ...gap('K02'),
    ...mastered('K07'),
    ['K10-CHECK-1', false],
  ]),
  binh: eventsFor('binh', [
    ...mastered('K01'),
    ...mastered('K02'),
    ...gap('K07'),
    ['K10-CHECK-1', false],
  ]),
  chi: eventsFor('chi', [
    ...mastered('K01'),
    ['K02-CHECK-1', true],
    ['K02-CHECK-2', false],
    ['K07-CHECK-1', false],
    ['K07-CHECK-2', true],
    ['K10-CHECK-1', false],
  ]),
  minh: eventsFor('minh', [
    ...mastered('K01'),
    ...mastered('K02'),
    ...mastered('K07'),
    ...mastered('K08'),
    ...mastered('K09'),
    ['K10-CHECK-1', false],
    ['K10-CHECK-1', true],
    ['K10-CHECK-2', true],
  ]),
} as const;

export const HERO_DEMO_CONFIG = { allowUnreviewedContent: true } as const;
