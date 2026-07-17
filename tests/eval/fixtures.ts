import type { CurriculumGraph, Item, LearnerEvent } from '../../src/domain';

export const HERO_GRAPH: CurriculumGraph = {
  version: 'hero-graph-v1',
  nodes: [
    { id: 'K01', name: 'Fraction meaning' },
    { id: 'K02', name: 'Equivalent fractions' },
    { id: 'K07', name: 'Ratio meaning and order' },
    { id: 'K08', name: 'Equivalent ratios' },
    { id: 'K09', name: 'Proportion definition' },
    { id: 'K10', name: 'Missing value in a proportion' },
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
      reviewState: 'ACCEPTED',
    },
    {
      id: `${kcId}-CHECK-2`,
      kcIds: [kcId],
      role: 'CHECK',
      reviewState: 'ACCEPTED',
    },
  ];
}

export const HERO_ITEMS: Item[] = [
  ...HERO_GRAPH.nodes.flatMap((node) => checkItems(node.id)),
  {
    id: 'K02-DIAGNOSTIC',
    kcIds: ['K02'],
    role: 'DIAGNOSTIC',
    reviewState: 'ACCEPTED',
  },
  {
    id: 'K07-DIAGNOSTIC',
    kcIds: ['K07'],
    role: 'DIAGNOSTIC',
    reviewState: 'ACCEPTED',
  },
  {
    id: 'K10-TRANSFER',
    kcIds: ['K10'],
    role: 'TRANSFER',
    reviewState: 'ACCEPTED',
  },
];

export type Answer = readonly [itemId: string, correct: boolean];

export function eventsFor(learnerId: string, answers: readonly Answer[]): LearnerEvent[] {
  return answers.map(([itemId, correct], index) => ({
    id: `${learnerId}-event-${index + 1}`,
    learnerId,
    itemId,
    sequence: index + 1,
    occurredAt: `2026-07-17T08:${String(index).padStart(2, '0')}:00.000Z`,
    correct,
  }));
}

const mastered = (kcId: string): Answer[] => [
  [`${kcId}-CHECK-1`, true],
  [`${kcId}-CHECK-2`, true],
];

const gap = (kcId: string): Answer[] => [
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
