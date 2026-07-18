import { contentGraphDraft } from './curriculum';
import { HERO_ITEMS } from './hero-demo';
import { LESSON_SUMMARIES } from './lessons.v1';

export const PILOT_KC_IDS = ['K02', 'K07', 'K08', 'K09', 'K10'] as const;

export function pilotCurriculumIssues(): readonly string[] {
  const pilot = new Set<string>(PILOT_KC_IDS);
  const issues: string[] = [];
  for (const node of contentGraphDraft.nodes.filter((candidate) => pilot.has(candidate.id))) {
    if (node.review.state !== 'ACCEPTED') issues.push(`node:${node.id}:${node.review.state}`);
  }
  for (const edge of contentGraphDraft.edges.filter(
    (candidate) => pilot.has(candidate.from) && pilot.has(candidate.to),
  )) {
    if (edge.review.state !== 'ACCEPTED') {
      issues.push(`edge:${edge.from}->${edge.to}:${edge.review.state}`);
    }
  }
  for (const item of HERO_ITEMS.filter((candidate) =>
    candidate.kcIds.some((id) => pilot.has(id)),
  )) {
    if (item.reviewState !== 'ACCEPTED') issues.push(`item:${item.id}:${item.reviewState}`);
  }
  for (const lesson of LESSON_SUMMARIES.filter((candidate) => pilot.has(candidate.kcId))) {
    if (lesson.reviewState !== 'ACCEPTED') {
      issues.push(`lesson:${lesson.kcId}:${lesson.reviewState}`);
    }
  }
  return issues.sort();
}

export function assertPilotCurriculumReady(): void {
  const issues = pilotCurriculumIssues();
  if (issues.length > 0) {
    throw new Error(`Pilot curriculum is not human-reviewed:\n${issues.join('\n')}`);
  }
}
