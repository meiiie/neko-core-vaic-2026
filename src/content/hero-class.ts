import {
  applyTeacherOverride,
  allocateTeacherAttention,
  detectClassWideGaps,
  diagnose,
  groupForTeacher,
  type ClassWideGap,
  type DiagnosisResult,
  type LearnerEvent,
  type TeacherAttentionPlan,
  type TeacherDiagnosisOverride,
  type TeacherGroup,
} from '../domain';
import { eventsFor, HERO_DEMO_CONFIG, HERO_EVENTS, HERO_GRAPH, HERO_ITEMS } from './hero-demo';

export type HeroSimulationProfileId = keyof typeof HERO_EVENTS;

export interface HeroClassLearner {
  readonly id: string;
  readonly displayLabel: string;
  /** Generation metadata only. The diagnosis function never receives this field. */
  readonly simulationProfileId: HeroSimulationProfileId;
  readonly events: readonly LearnerEvent[];
}

export interface HeroClassDashboard {
  readonly learners: readonly HeroClassLearner[];
  readonly diagnoses: readonly DiagnosisResult[];
  readonly groups: readonly TeacherGroup[];
  readonly classWideGaps: readonly ClassWideGap[];
  readonly attentionPlan: TeacherAttentionPlan;
}

export const HERO_TEACHER_BUDGET_MINUTES = 15;

export const HERO_ACTION_MINUTES: Readonly<Record<string, number>> = {
  RETEACH_K01: 8,
  RETEACH_K02: 10,
  RETEACH_K07: 8,
  RETEACH_K08: 8,
  RETEACH_K09: 8,
  RETEACH_K10: 8,
  RUN_QUICK_CHECK: 2,
  REVIEW_DIAGNOSIS: 5,
};

const PROFILE_COUNTS: readonly {
  readonly profileId: HeroSimulationProfileId;
  readonly count: number;
}[] = [
  { profileId: 'an', count: 12 },
  { profileId: 'binh', count: 10 },
  { profileId: 'chi', count: 8 },
  { profileId: 'minh', count: 10 },
];

export const HERO_CLASS_LEARNERS: readonly HeroClassLearner[] = PROFILE_COUNTS.flatMap(
  ({ profileId, count }, profileIndex) => {
    const precedingCount = PROFILE_COUNTS.slice(0, profileIndex).reduce(
      (total, profile) => total + profile.count,
      0,
    );
    return Array.from({ length: count }, (_, offset) => {
      const ordinal = precedingCount + offset + 1;
      const id = `hs-${String(ordinal).padStart(2, '0')}`;
      const sourceEvents = HERO_EVENTS[profileId];
      return {
        id,
        displayLabel: `HS ${String(ordinal).padStart(2, '0')}`,
        simulationProfileId: profileId,
        events: eventsFor(
          id,
          sourceEvents.map((event) => [event.itemId, event.correct] as const),
        ),
      };
    });
  },
);

export function buildHeroClassDashboard(
  learners: readonly HeroClassLearner[] = HERO_CLASS_LEARNERS,
  observedEvents: readonly LearnerEvent[] = [],
  overrides: readonly TeacherDiagnosisOverride[] = [],
): HeroClassDashboard {
  const representativeByProfile = new Map<HeroSimulationProfileId, string>();
  for (const learner of learners) {
    if (!representativeByProfile.has(learner.simulationProfileId)) {
      representativeByProfile.set(learner.simulationProfileId, learner.id);
    }
  }

  const effectiveLearners = learners.map((learner): HeroClassLearner => {
    if (representativeByProfile.get(learner.simulationProfileId) !== learner.id) return learner;
    const profileEvents = observedEvents
      .filter((event) => event.learnerId === learner.simulationProfileId)
      .map((event) => ({ ...event, learnerId: learner.id }));
    return profileEvents.length > 0
      ? { ...learner, events: [...learner.events, ...profileEvents] }
      : learner;
  });

  const diagnoses = effectiveLearners.map((learner) => {
    const diagnosis = diagnose({
      learnerId: learner.id,
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: learner.events,
      config: HERO_DEMO_CONFIG,
    });
    const override = overrides.find(
      (candidate) =>
        candidate.learnerId === learner.id && candidate.targetKcId === diagnosis.targetKcId,
    );
    return override ? applyTeacherOverride(HERO_GRAPH, diagnosis, override) : diagnosis;
  });
  const groups = groupForTeacher(HERO_GRAPH, diagnoses);

  return {
    learners: effectiveLearners,
    diagnoses,
    groups,
    classWideGaps: detectClassWideGaps(groups, learners.length),
    attentionPlan: allocateTeacherAttention(
      groups,
      HERO_TEACHER_BUDGET_MINUTES,
      HERO_ACTION_MINUTES,
    ),
  };
}
