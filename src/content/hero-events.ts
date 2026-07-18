import type { LearnerEvent, MethodValidity } from '../domain/model.ts';

export type HeroAnswer = readonly [
  itemId: string,
  correct: boolean,
  misconceptionId?: string,
  methodValidity?: MethodValidity,
];

export function eventsFor(learnerId: string, answers: readonly HeroAnswer[]): LearnerEvent[] {
  return answers.map(([itemId, correct, misconceptionId, methodValidity], index) => ({
    id: `${learnerId}-event-${index + 1}`,
    learnerId,
    itemId,
    sequence: index + 1,
    occurredAt: new Date(Date.UTC(2026, 6, 17, 8, index)).toISOString(),
    correct,
    ...(methodValidity ? { methodValidity } : {}),
    ...(misconceptionId ? { misconceptionId } : {}),
  }));
}

const mastered = (kcId: string): HeroAnswer[] => [
  [`${kcId}-CHECK-1`, true],
  [`${kcId}-CHECK-2`, true],
];

const GAP_MISCONCEPTION_BY_KC: Readonly<Record<string, string>> = {
  K01: 'NUMERATOR_DENOMINATOR_SWAP',
  K02: 'ADDITIVE_EQUIVALENCE',
  K07: 'RATIO_ORDER_REVERSED',
  K08: 'ADDITIVE_EQUIVALENCE',
  K09: 'UNVERIFIED_EQUALITY',
  K10: 'INCOMPLETE_CROSS_MULTIPLY',
};

const gap = (kcId: string): HeroAnswer[] => {
  const misconceptionId = GAP_MISCONCEPTION_BY_KC[kcId];
  return [
    [`${kcId}-CHECK-1`, false, misconceptionId, 'INVALID'],
    [`${kcId}-CHECK-2`, false, misconceptionId, 'INVALID'],
  ];
};

/** Synthetic walkthrough history. Production student surfaces receive these
 * records only after SQLite has seeded and returned them through /api/events. */
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
