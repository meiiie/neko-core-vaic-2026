import { describe, expect, it } from 'vitest';
import {
  canonicalizeEvents,
  computeMastery,
  detectClassWideGaps,
  diagnose,
  groupForTeacher,
  planPracticePath,
  topologicalOrder,
  type CurriculumGraph,
} from '../../src/domain';
import { eventsFor, HERO_EVENTS, HERO_GRAPH, HERO_ITEMS } from './fixtures';

function heroDiagnosis(learnerId: keyof typeof HERO_EVENTS) {
  return diagnose({
    learnerId,
    targetKcId: 'K10',
    graph: HERO_GRAPH,
    items: HERO_ITEMS,
    events: HERO_EVENTS[learnerId],
  });
}

describe('graph and event integrity', () => {
  it('rejects cycles', () => {
    const cyclic: CurriculumGraph = {
      version: 'cycle',
      nodes: [
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
      ],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ],
    };

    expect(() => topologicalOrder(cyclic)).toThrow('must be acyclic');
  });

  it('deduplicates identical event IDs and rejects conflicting duplicates', () => {
    const event = HERO_EVENTS.an[0]!;
    expect(canonicalizeEvents([event, event])).toEqual([event]);
    expect(() =>
      canonicalizeEvents([event, { ...event, correct: !event.correct }]),
    ).toThrow('Conflicting duplicate event id');
  });

  it('counts distinct items rather than repeated attempts as direct evidence', () => {
    const repeatedItem = eventsFor('repeat', [
      ['K01-CHECK-1', true],
      ['K01-CHECK-1', true],
    ]);
    const state = computeMastery(HERO_GRAPH, HERO_ITEMS, repeatedItem).get('K01');

    expect(state?.evidenceEventIds).toHaveLength(2);
    expect(state?.directEvidenceCount).toBe(1);
  });

  it('is deterministic for shuffled input and duplicate delivery', () => {
    const original = heroDiagnosis('an');
    const shuffled = diagnose({
      learnerId: 'an',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: [...HERO_EVENTS.an].reverse().concat(HERO_EVENTS.an[0]!),
    });

    expect(shuffled).toEqual(original);
  });

  it('rejects mixed learners and rejected items at the domain boundary', () => {
    expect(() =>
      computeMastery(HERO_GRAPH, HERO_ITEMS, [HERO_EVENTS.an[0]!, HERO_EVENTS.binh[0]!]),
    ).toThrow('one learner at a time');

    const rejectedItems = HERO_ITEMS.map((item, index) =>
      index === 0 ? { ...item, reviewState: 'REJECTED' as const } : item,
    );
    expect(() => computeMastery(HERO_GRAPH, rejectedItems, HERO_EVENTS.an)).toThrow(
      'Rejected item cannot run',
    );
  });
});

describe('hero diagnosis contract', () => {
  it('finds two different roots for the same surface target', () => {
    const an = heroDiagnosis('an');
    const binh = heroDiagnosis('binh');

    expect(an).toMatchObject({
      status: 'DIAGNOSED',
      rootKcId: 'K02',
      pathKcIds: ['K02', 'K08', 'K09', 'K10'],
    });
    expect(binh).toMatchObject({
      status: 'DIAGNOSED',
      rootKcId: 'K07',
      pathKcIds: ['K07', 'K08', 'K09', 'K10'],
    });
  });

  it('abstains and asks a reviewed discriminating question for Chi', () => {
    const chi = heroDiagnosis('chi');

    expect(chi.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(chi.competingKcIds).toEqual(expect.arrayContaining(['K02', 'K07']));
    expect(['K02-DIAGNOSTIC', 'K07-DIAGNOSTIC']).toContain(chi.nextItemId);
  });

  it('gives Minh a fast path rather than remediation', () => {
    expect(heroDiagnosis('minh')).toMatchObject({
      status: 'FAST_PATH',
      nextItemId: 'K10-TRANSFER',
      pathKcIds: [],
    });
  });

  it('does not grant a fast path from repeated copies of one item per KC', () => {
    const repeatedAnswers = HERO_GRAPH.nodes.flatMap((node) => [
      [`${node.id}-CHECK-1`, true] as const,
      [`${node.id}-CHECK-1`, true] as const,
    ]);
    const result = diagnose({
      learnerId: 'repeater',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: eventsFor('repeater', repeatedAnswers),
    });

    expect(result.status).not.toBe('FAST_PATH');
  });

  it('returns out of scope instead of guessing an unknown target', () => {
    expect(
      diagnose({
        learnerId: 'an',
        targetKcId: 'K99',
        graph: HERO_GRAPH,
        items: HERO_ITEMS,
        events: HERO_EVENTS.an,
      }),
    ).toMatchObject({ status: 'OUT_OF_SCOPE', reasonCodes: ['TARGET_OUTSIDE_GRAPH'] });
  });

  it('stops without another probe when the diagnostic budget is exhausted', () => {
    const ambiguousEvents = eventsFor('ambiguous', [
      ['K01-CHECK-1', true],
      ['K01-CHECK-2', true],
      ['K02-CHECK-1', false],
      ['K02-CHECK-2', false],
      ['K07-CHECK-1', false],
      ['K07-CHECK-2', false],
      ['K10-CHECK-1', false],
    ]);
    const itemsWithOneUsedDiagnostic = HERO_ITEMS.map((item) =>
      item.id === 'K01-CHECK-1' ? { ...item, role: 'DIAGNOSTIC' as const } : item,
    );
    const result = diagnose({
      learnerId: 'ambiguous',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: itemsWithOneUsedDiagnostic,
      events: ambiguousEvents,
      config: { maxDiagnosticItems: 1 },
    });

    expect(result.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(result.nextItemId).toBeUndefined();
    expect(result.reasonCodes).toContain('DIAGNOSTIC_BUDGET_EXHAUSTED');
  });
});

describe('paths and teacher decisions', () => {
  it('keeps the underlying graph path while skipping mastered practice nodes', () => {
    const masteredK08 = HERO_EVENTS.minh
      .filter((event) => event.itemId.startsWith('K08-'))
      .map((event, index) => ({
        ...event,
        id: `an-extra-${index}`,
        learnerId: 'an',
        sequence: 20 + index,
      }));
    const mastery = computeMastery(HERO_GRAPH, HERO_ITEMS, [
      ...HERO_EVENTS.an,
      ...masteredK08,
    ]);
    const path = planPracticePath(HERO_GRAPH, 'K02', 'K10', mastery, 0.8);

    expect(path.graphPathKcIds).toEqual(['K02', 'K08', 'K09', 'K10']);
    expect(path.practiceKcIds).toEqual(['K02', 'K09', 'K10']);
  });

  it('groups by need and exposes the exact priority factors', () => {
    const groups = groupForTeacher(HERO_GRAPH, [
      heroDiagnosis('an'),
      heroDiagnosis('binh'),
      heroDiagnosis('chi'),
      heroDiagnosis('minh'),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      'root:K02',
      'root:K07',
      'quick-check',
      'ready',
    ]);
    expect(groups[0]).toMatchObject({
      learnerIds: ['an'],
      blockedDescendantCount: 3,
      priorityScore: 3,
    });
    expect(detectClassWideGaps(groups, 4)).toEqual([]);
    expect(detectClassWideGaps(groups, 4, 0.25, 1).map((gap) => gap.rootKcId)).toEqual([
      'K02',
      'K07',
    ]);
    expect(() => groupForTeacher(HERO_GRAPH, [heroDiagnosis('an'), heroDiagnosis('an')])).toThrow(
      'Duplicate diagnosis',
    );
    expect(() => detectClassWideGaps(groups, 3)).toThrow(
      'smaller than represented learners',
    );
  });
});
