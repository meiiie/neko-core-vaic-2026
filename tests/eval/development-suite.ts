import { HERO_DEMO_CONFIG, HERO_GRAPH, HERO_ITEMS } from '../../src/content/hero-demo';
import type { DiagnosisStatus } from '../../src/domain';
import type { FrozenEvaluationCase } from './report';
import { simulateResponses, type SimulationProfile } from './simulator';

export interface DisclosedProfile {
  readonly id: string;
  readonly masteredKcIds: readonly string[];
  readonly slip: number;
  readonly guess: number;
  readonly seed: number;
  readonly expectedStatus: DiagnosisStatus;
  readonly expectedRootKcId?: string;
}

const allKcIds = HERO_GRAPH.nodes.map((node) => node.id);

function profileSeries(
  prefix: string,
  masteredKcIds: readonly string[],
  expectedStatus: DiagnosisStatus,
  expectedRootKcId?: string,
): DisclosedProfile[] {
  return [
    { slip: 0.02, guess: 0.02, seed: 101 },
    { slip: 0.05, guess: 0.05, seed: 211 },
    { slip: 0.08, guess: 0.08, seed: 307 },
    { slip: 0.1, guess: 0.05, seed: 401 },
    { slip: 0.05, guess: 0.1, seed: 503 },
    { slip: 0.12, guess: 0.12, seed: 601 },
  ].map((noise, index) => ({
    id: `${prefix}-${index + 1}`,
    masteredKcIds,
    ...noise,
    expectedStatus,
    ...(expectedRootKcId ? { expectedRootKcId } : {}),
  }));
}

/**
 * Public development cases: labels and generation parameters are visible to implementers.
 * These are not held-out results and must never be presented as such.
 */
export const DISCLOSED_DEVELOPMENT_PROFILES: readonly DisclosedProfile[] = [
  ...profileSeries('fraction-root', ['K01', 'K07'], 'DIAGNOSED', 'K02'),
  ...profileSeries('ratio-root', ['K01', 'K02'], 'DIAGNOSED', 'K07'),
  ...profileSeries('competing-roots', ['K01'], 'NEEDS_MORE_EVIDENCE'),
  ...profileSeries('ready', allKcIds, 'FAST_PATH'),
];

export const DISCLOSED_DEVELOPMENT_CASES: readonly FrozenEvaluationCase[] =
  DISCLOSED_DEVELOPMENT_PROFILES.map((profile) => {
    const simulatorProfile: SimulationProfile = {
      learnerId: profile.id,
      masteredKcIds: profile.masteredKcIds,
      slip: profile.slip,
      guess: profile.guess,
      seed: profile.seed,
    };
    return {
      id: profile.id,
      input: {
        learnerId: profile.id,
        targetKcId: 'K10',
        graph: HERO_GRAPH,
        items: HERO_ITEMS,
        events: simulateResponses(simulatorProfile, HERO_ITEMS),
        config: HERO_DEMO_CONFIG,
      },
      expectedStatus: profile.expectedStatus,
      ...(profile.expectedRootKcId ? { expectedRootKcId: profile.expectedRootKcId } : {}),
    };
  });
