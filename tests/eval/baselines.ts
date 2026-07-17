import {
  ancestorIds,
  computeMastery,
  topologicalOrder,
  type DiagnosisInput,
} from '../../src/domain';

export function surfaceSkillBaseline(input: DiagnosisInput): string {
  return input.targetKcId;
}

export function fixedPrerequisiteBaseline(input: DiagnosisInput): string {
  const ancestors = new Set(ancestorIds(input.graph, input.targetKcId));
  return topologicalOrder(input.graph).find((kcId) => ancestors.has(kcId)) ?? input.targetKcId;
}

export function lowestMasteryBaseline(input: DiagnosisInput): string {
  const learnerEvents = input.events.filter((event) => event.learnerId === input.learnerId);
  const mastery = computeMastery(input.graph, input.items, learnerEvents, input.config);
  return (
    ancestorIds(input.graph, input.targetKcId)
      .sort(
        (left, right) =>
          mastery.get(left)!.probability - mastery.get(right)!.probability ||
          left.localeCompare(right),
      )[0] ?? input.targetKcId
  );
}
