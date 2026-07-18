import { describe, expect, it } from 'vitest';
import { HERO_GRAPH } from './hero-demo';
import { buildHeroClassDashboard, HERO_ACTION_MINUTES, HERO_CLASS_LEARNERS } from './hero-class';

describe('synthetic 40-learner classroom', () => {
  it('uses anonymous stable IDs and deterministic event histories', () => {
    expect(HERO_CLASS_LEARNERS).toHaveLength(40);
    expect(new Set(HERO_CLASS_LEARNERS.map((learner) => learner.id)).size).toBe(40);
    expect(HERO_CLASS_LEARNERS[0]?.id).toBe('hs-01');
    expect(HERO_CLASS_LEARNERS[39]?.id).toBe('hs-40');
    expect(buildHeroClassDashboard()).toEqual(buildHeroClassDashboard());
  });

  it('produces reproducible need groups and one obvious whole-class action', () => {
    const dashboard = buildHeroClassDashboard();

    expect(dashboard.groups.map((group) => [group.id, group.totalLearnerCount])).toEqual([
      ['root:K02', 12],
      ['root:K07', 10],
      ['quick-check', 8],
      ['ready', 10],
    ]);
    expect(dashboard.groups[0]).toMatchObject({
      id: 'root:K02',
      priorityScore: 36,
      suggestedActionId: 'RETEACH_K02',
    });
    expect(dashboard.classWideGaps).toEqual([
      {
        rootKcId: 'K02',
        learnerCount: 12,
        classSize: 40,
        rate: 0.3,
        thresholdRate: 0.3,
        thresholdCount: 3,
      },
    ]);
    expect(dashboard.attentionPlan).toMatchObject({
      policyVersion: 'teacher-budget-v1',
      budgetMinutes: 15,
      usedMinutes: 12,
      remainingMinutes: 3,
    });
    expect(dashboard.attentionPlan.selected.map((item) => item.groupId)).toEqual([
      'root:K02',
      'quick-check',
    ]);
  });

  it('keeps simulation labels out of learner event payloads', () => {
    const serializedEvents = JSON.stringify(
      HERO_CLASS_LEARNERS.flatMap((learner) => learner.events),
    );

    expect(serializedEvents).not.toContain('simulationProfileId');
    expect(serializedEvents).not.toContain('displayLabel');
  });

  it('defines a positive minute estimate for every valid hero action', () => {
    for (const node of HERO_GRAPH.nodes) {
      expect(HERO_ACTION_MINUTES[`RETEACH_${node.id}`]).toBeGreaterThan(0);
    }
    expect(HERO_ACTION_MINUTES.RUN_QUICK_CHECK).toBeGreaterThan(0);
    expect(HERO_ACTION_MINUTES.REVIEW_DIAGNOSIS).toBeGreaterThan(0);
  });

  it('feeds one observed learner event into one representative class profile', () => {
    const observed = {
      id: 'an-local-observed',
      learnerId: 'an',
      itemId: 'K02-CHECK-1',
      sequence: 99,
      occurredAt: '2026-07-18T10:00:00.000Z',
      correct: true,
    } as const;
    const dashboard = buildHeroClassDashboard(HERO_CLASS_LEARNERS, [observed]);

    expect(
      dashboard.learners.filter((learner) =>
        learner.events.some((event) => event.id === observed.id),
      ),
    ).toHaveLength(1);
  });

  it('moves only the overridden learner while preserving the event history', () => {
    const before = buildHeroClassDashboard();
    const after = buildHeroClassDashboard(
      HERO_CLASS_LEARNERS,
      [],
      [
        {
          learnerId: 'hs-01',
          targetKcId: 'K10',
          decision: 'SET_ROOT',
          rootKcId: 'K07',
        },
      ],
    );

    expect(after.groups.find((group) => group.id === 'root:K02')?.totalLearnerCount).toBe(11);
    expect(after.groups.find((group) => group.id === 'root:K07')?.totalLearnerCount).toBe(11);
    expect(after.learners[0]?.events).toEqual(before.learners[0]?.events);
  });
});
