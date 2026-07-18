import { describe, expect, it } from 'vitest';
import {
  applyTeacherOverride,
  allocateTeacherAttention,
  canonicalizeEvents,
  computeMastery,
  detectClassWideGaps,
  diagnose,
  groupForTeacher,
  inferMisconceptionHypotheses,
  planPracticePath,
  topologicalOrder,
  type CurriculumGraph,
} from '../../src/domain';
import {
  eventsFor,
  HERO_DEMO_CONFIG,
  HERO_EVENTS,
  HERO_GRAPH,
  HERO_ITEMS,
} from '../../src/content/hero-demo';

function heroDiagnosis(learnerId: keyof typeof HERO_EVENTS) {
  return diagnose({
    learnerId,
    targetKcId: 'K10',
    graph: HERO_GRAPH,
    items: HERO_ITEMS,
    events: HERO_EVENTS[learnerId],
    config: HERO_DEMO_CONFIG,
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
    expect(() => canonicalizeEvents([event, { ...event, correct: !event.correct }])).toThrow(
      'Conflicting duplicate event id',
    );
    expect(() => canonicalizeEvents([event, { ...event, methodValidity: 'INVALID' }])).toThrow(
      'Conflicting duplicate event id',
    );
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

  it('does not treat a correct answer reached by an invalid method as mastery', () => {
    const base = HERO_EVENTS.an[0]!;
    const valid = {
      ...base,
      id: 'valid-method',
      learnerId: 'method-valid',
      itemId: 'K02-CHECK-1',
      correct: true,
      methodValidity: 'VALID' as const,
    };
    const hiddenMisconception = {
      ...valid,
      id: 'invalid-method',
      learnerId: 'method-invalid',
      methodValidity: 'INVALID' as const,
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
    };

    const validState = computeMastery(HERO_GRAPH, HERO_ITEMS, [valid]).get('K02')!;
    const invalidState = computeMastery(HERO_GRAPH, HERO_ITEMS, [hiddenMisconception]).get('K02')!;

    expect(validState.probability).toBeGreaterThan(0.5);
    expect(invalidState.probability).toBeLessThan(0.5);
  });

  it('only marks a misconception pattern supported after two distinct items', () => {
    const events = HERO_EVENTS.an.filter((event) => event.misconceptionId);
    const firstItemId = events[0]!.itemId;
    const singleItemHypotheses = inferMisconceptionHypotheses(
      HERO_GRAPH,
      HERO_ITEMS,
      events.filter((event) => event.itemId === firstItemId),
      2,
    );
    expect(singleItemHypotheses[0]).toMatchObject({
      verificationStatus: 'NEEDS_VERIFICATION',
      independentItemCount: 1,
    });

    const hypotheses = inferMisconceptionHypotheses(HERO_GRAPH, HERO_ITEMS, events, 2);

    expect(hypotheses[0]).toMatchObject({
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
      kcId: 'K02',
      verificationStatus: 'SUPPORTED_BY_MULTIPLE_ITEMS',
      independentItemCount: 2,
    });
  });
});

describe('hero diagnosis contract', () => {
  it('finds two different roots for the same surface target', () => {
    const an = heroDiagnosis('an');
    const binh = heroDiagnosis('binh');

    expect(an).toMatchObject({
      status: 'DIAGNOSED',
      disposition: 'AUTO_REMEDIATE',
      rootKcId: 'K02',
      pathKcIds: ['K02', 'K08', 'K09', 'K10'],
    });
    expect(an.misconceptionHypotheses[0]).toMatchObject({
      misconceptionId: 'ADDITIVE_EQUIVALENCE',
      verificationStatus: 'SUPPORTED_BY_MULTIPLE_ITEMS',
    });
    expect(binh).toMatchObject({
      status: 'DIAGNOSED',
      disposition: 'AUTO_REMEDIATE',
      rootKcId: 'K07',
      pathKcIds: ['K07', 'K08', 'K09', 'K10'],
    });
  });

  it('can remediate a supported KC gap without inventing a named misconception', () => {
    const eventsWithoutNamedPatterns = HERO_EVENTS.an.map(
      ({ misconceptionId: _misconceptionId, ...event }) => event,
    );
    const result = diagnose({
      learnerId: 'an',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: eventsWithoutNamedPatterns,
      config: HERO_DEMO_CONFIG,
    });

    expect(result).toMatchObject({
      status: 'DIAGNOSED',
      disposition: 'AUTO_REMEDIATE',
      rootKcId: 'K02',
      misconceptionHypotheses: [],
    });
  });

  it('abstains and asks a clearly flagged demo question for Chi', () => {
    const chi = heroDiagnosis('chi');

    expect(chi.status).toBe('NEEDS_MORE_EVIDENCE');
    expect(chi.disposition).toBe('ASK_VERIFY');
    expect(chi.competingKcIds).toEqual(expect.arrayContaining(['K02', 'K07']));
    expect(['K02-DIAGNOSTIC', 'K07-DIAGNOSTIC']).toContain(chi.nextItemId);
  });

  it('checks an unverified prerequisite when a failed surface skill has no unused probe', () => {
    const result = diagnose({
      learnerId: 'surface-gap',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: eventsFor('surface-gap', [
        ['K09-CHECK-1', false],
        ['K09-CHECK-2', false],
      ]),
      config: HERO_DEMO_CONFIG,
    });

    expect(result).toMatchObject({
      status: 'NEEDS_MORE_EVIDENCE',
      disposition: 'ASK_VERIFY',
      competingKcIds: ['K09'],
    });
    expect(['K08-CHECK-1', 'K08-CHECK-2']).toContain(result.nextItemId);
  });

  it('does not select unreviewed content unless demo mode is explicit', () => {
    const chi = diagnose({
      learnerId: 'chi',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: HERO_EVENTS.chi,
    });
    const minh = diagnose({
      learnerId: 'minh',
      targetKcId: 'K10',
      graph: HERO_GRAPH,
      items: HERO_ITEMS,
      events: HERO_EVENTS.minh,
    });

    expect(chi).toMatchObject({ status: 'NEEDS_MORE_EVIDENCE' });
    expect(chi.nextItemId).toBeUndefined();
    expect(minh).toMatchObject({ status: 'FAST_PATH' });
    expect(minh.nextItemId).toBeUndefined();
  });

  it('gives Minh a fast path rather than remediation', () => {
    expect(heroDiagnosis('minh')).toMatchObject({
      status: 'FAST_PATH',
      disposition: 'ADVANCE',
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
        config: HERO_DEMO_CONFIG,
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
    expect(result.disposition).toBe('TEACHER_REVIEW');
    expect(result.nextItemId).toBeUndefined();
    expect(result.reasonCodes).toContain('DIAGNOSTIC_BUDGET_EXHAUSTED');
    expect(groupForTeacher(HERO_GRAPH, [result])[0]).toMatchObject({
      id: 'teacher-review',
      status: 'TEACHER_REVIEW',
      suggestedActionId: 'REVIEW_DIAGNOSIS',
    });
  });
});

describe('paths and teacher decisions', () => {
  it('applies an explicit teacher override without rewriting evidence', () => {
    const original = heroDiagnosis('an');
    const overridden = applyTeacherOverride(HERO_GRAPH, original, {
      learnerId: 'an',
      targetKcId: 'K10',
      decision: 'SET_ROOT',
      rootKcId: 'K07',
    });

    expect(overridden).toMatchObject({
      status: 'DIAGNOSED',
      disposition: 'AUTO_REMEDIATE',
      rootKcId: 'K07',
      pathKcIds: ['K07', 'K08', 'K09', 'K10'],
      reasonCodes: ['TEACHER_OVERRIDE_APPLIED'],
    });
    expect(overridden.evidenceEventIds).toEqual(original.evidenceEventIds);
    expect(HERO_EVENTS.an).toEqual(HERO_EVENTS.an);

    expect(
      applyTeacherOverride(HERO_GRAPH, original, {
        learnerId: 'an',
        targetKcId: 'K10',
        decision: 'NEEDS_MORE_EVIDENCE',
      }),
    ).toMatchObject({
      status: 'NEEDS_MORE_EVIDENCE',
      disposition: 'TEACHER_REVIEW',
      pathKcIds: [],
      reasonCodes: ['TEACHER_OVERRIDE_APPLIED'],
    });
    expect(() =>
      applyTeacherOverride(HERO_GRAPH, original, {
        learnerId: 'an',
        targetKcId: 'K10',
        decision: 'SET_ROOT',
        rootKcId: 'K99',
      }),
    ).toThrow('valid path');
  });

  it('keeps the underlying graph path while skipping mastered practice nodes', () => {
    const masteredK08 = HERO_EVENTS.minh
      .filter((event) => event.itemId.startsWith('K08-'))
      .map((event, index) => ({
        ...event,
        id: `an-extra-${index}`,
        learnerId: 'an',
        sequence: 20 + index,
      }));
    const mastery = computeMastery(HERO_GRAPH, HERO_ITEMS, [...HERO_EVENTS.an, ...masteredK08]);
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
    expect(() => detectClassWideGaps(groups, 3)).toThrow('smaller than represented learners');
  });

  it('allocates a finite teacher-time budget by transparent action value', () => {
    const groups = groupForTeacher(HERO_GRAPH, [
      ...Array.from({ length: 12 }, (_, index) => ({
        ...heroDiagnosis('an'),
        learnerId: `an-${index + 1}`,
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        ...heroDiagnosis('binh'),
        learnerId: `binh-${index + 1}`,
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        ...heroDiagnosis('chi'),
        learnerId: `chi-${index + 1}`,
      })),
    ]);
    const plan = allocateTeacherAttention(groups, 15, {
      RETEACH_K02: 10,
      RETEACH_K07: 8,
      RUN_QUICK_CHECK: 2,
    });

    expect(plan).toMatchObject({
      policyVersion: 'teacher-budget-v1',
      budgetMinutes: 15,
      usedMinutes: 12,
      remainingMinutes: 3,
    });
    expect(plan.selected.map((item) => item.groupId)).toEqual(['root:K02', 'quick-check']);
    expect(plan.deferred.map((item) => item.groupId)).toEqual(['root:K07']);
  });
});
