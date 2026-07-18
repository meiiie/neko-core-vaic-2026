import {
  DEFAULT_DOMAIN_CONFIG,
  type ClassWideGap,
  type CurriculumGraph,
  type DiagnosisInput,
  type DiagnosisResult,
  type DomainConfig,
  type Item,
  type LearnerEvent,
  type MasteryState,
  type MisconceptionHypothesis,
  type PathPlan,
  type TeacherAttentionItem,
  type TeacherAttentionPlan,
  type TeacherDiagnosisOverride,
  type TeacherGroup,
} from './model.ts';

export const ALGORITHM_VERSION = 'root-frontier-v2-dve';

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareIds);
}

function clampProbability(value: number): number {
  return Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, value));
}

function assertProbability(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

function resolveConfig(overrides?: Partial<DomainConfig>): DomainConfig {
  const config = { ...DEFAULT_DOMAIN_CONFIG, ...overrides };

  assertProbability('initialMastery', config.initialMastery);
  assertProbability('learnProbability', config.learnProbability);
  assertProbability('defaultSlip', config.defaultSlip);
  assertProbability('defaultGuess', config.defaultGuess);
  assertProbability('masteryThreshold', config.masteryThreshold);
  assertProbability('gapThreshold', config.gapThreshold);
  assertProbability('ambiguityMargin', config.ambiguityMargin);

  if (config.gapThreshold >= config.masteryThreshold) {
    throw new Error('gapThreshold must be lower than masteryThreshold');
  }
  if (!Number.isInteger(config.minDirectEvidence) || config.minDirectEvidence < 1) {
    throw new Error('minDirectEvidence must be a positive integer');
  }
  if (!Number.isInteger(config.maxDiagnosticItems) || config.maxDiagnosticItems < 1) {
    throw new Error('maxDiagnosticItems must be a positive integer');
  }

  return config;
}

function buildAdjacency(graph: CurriculumGraph): {
  readonly outgoing: ReadonlyMap<string, readonly string[]>;
  readonly incoming: ReadonlyMap<string, readonly string[]>;
} {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const id of nodeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }

  const edgeKeys = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Edge ${edge.from}->${edge.to} references an unknown KC`);
    }
    if (edge.from === edge.to) {
      throw new Error(`Self edge is not allowed: ${edge.from}`);
    }
    const key = `${edge.from}->${edge.to}`;
    if (edgeKeys.has(key)) {
      throw new Error(`Duplicate edge: ${key}`);
    }
    edgeKeys.add(key);
    outgoing.get(edge.from)!.push(edge.to);
    incoming.get(edge.to)!.push(edge.from);
  }

  for (const values of outgoing.values()) values.sort(compareIds);
  for (const values of incoming.values()) values.sort(compareIds);

  return { outgoing, incoming };
}

export function topologicalOrder(graph: CurriculumGraph): string[] {
  if (!graph.version.trim()) throw new Error('Graph version is required');

  const nodeIds = graph.nodes.map((node) => node.id);
  if (nodeIds.some((id) => !id.trim())) throw new Error('Every KC needs a non-empty id');
  if (new Set(nodeIds).size !== nodeIds.length) throw new Error('Duplicate KC id');

  const { outgoing, incoming } = buildAdjacency(graph);
  const indegree = new Map(nodeIds.map((id) => [id, incoming.get(id)!.length]));
  const ready = nodeIds.filter((id) => indegree.get(id) === 0).sort(compareIds);
  const order: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift()!;
    order.push(current);
    for (const next of outgoing.get(current)!) {
      const remaining = indegree.get(next)! - 1;
      indegree.set(next, remaining);
      if (remaining === 0) {
        ready.push(next);
        ready.sort(compareIds);
      }
    }
  }

  if (order.length !== nodeIds.length) throw new Error('Curriculum graph must be acyclic');
  return order;
}

export function ancestorIds(graph: CurriculumGraph, kcId: string): string[] {
  topologicalOrder(graph);
  const { incoming } = buildAdjacency(graph);
  if (!incoming.has(kcId)) return [];

  const found = new Set<string>();
  const queue = [...incoming.get(kcId)!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (found.has(current)) continue;
    found.add(current);
    queue.push(...incoming.get(current)!);
  }
  return sortedUnique([...found]);
}

export function descendantIds(graph: CurriculumGraph, kcId: string): string[] {
  topologicalOrder(graph);
  const { outgoing } = buildAdjacency(graph);
  if (!outgoing.has(kcId)) return [];

  const found = new Set<string>();
  const queue = [...outgoing.get(kcId)!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (found.has(current)) continue;
    found.add(current);
    queue.push(...outgoing.get(current)!);
  }
  return sortedUnique([...found]);
}

export function shortestPath(graph: CurriculumGraph, from: string, to: string): string[] {
  topologicalOrder(graph);
  const { outgoing } = buildAdjacency(graph);
  if (!outgoing.has(from) || !outgoing.has(to)) return [];

  const queue: string[][] = [[from]];
  const visited = new Set<string>([from]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1]!;
    if (current === to) return path;
    for (const next of outgoing.get(current)!) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }
  return [];
}

function sameEvent(left: LearnerEvent, right: LearnerEvent): boolean {
  return (
    left.learnerId === right.learnerId &&
    left.itemId === right.itemId &&
    left.sequence === right.sequence &&
    left.occurredAt === right.occurredAt &&
    left.correct === right.correct &&
    left.methodValidity === right.methodValidity &&
    left.misconceptionId === right.misconceptionId
  );
}

export function canonicalizeEvents(events: readonly LearnerEvent[]): LearnerEvent[] {
  const byId = new Map<string, LearnerEvent>();
  for (const event of events) {
    if (!event.id.trim() || !event.learnerId.trim() || !event.itemId.trim()) {
      throw new Error('Event id, learnerId and itemId are required');
    }
    if (!Number.isInteger(event.sequence) || event.sequence < 0) {
      throw new Error(`Invalid sequence for event ${event.id}`);
    }
    if (Number.isNaN(Date.parse(event.occurredAt))) {
      throw new Error(`Invalid occurredAt for event ${event.id}`);
    }
    if (
      event.methodValidity !== undefined &&
      !['VALID', 'INVALID', 'UNKNOWN'].includes(event.methodValidity)
    ) {
      throw new Error(`Invalid methodValidity for event ${event.id}`);
    }
    if (event.misconceptionId !== undefined && !event.misconceptionId.trim()) {
      throw new Error(`Invalid misconceptionId for event ${event.id}`);
    }

    const existing = byId.get(event.id);
    if (existing && !sameEvent(existing, event)) {
      throw new Error(`Conflicting duplicate event id: ${event.id}`);
    }
    if (!existing) byId.set(event.id, event);
  }

  return [...byId.values()].sort(
    (left, right) =>
      left.sequence - right.sequence ||
      compareIds(left.occurredAt, right.occurredAt) ||
      compareIds(left.id, right.id),
  );
}

function validateItems(graph: CurriculumGraph, items: readonly Item[]): Map<string, Item> {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const itemMap = new Map<string, Item>();

  for (const item of items) {
    if (!item.id.trim()) throw new Error('Every item needs a non-empty id');
    if (itemMap.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`);
    if (item.kcIds.length === 0) throw new Error(`Item ${item.id} needs at least one KC`);
    if (item.reviewState === 'REJECTED') throw new Error(`Rejected item cannot run: ${item.id}`);
    for (const kcId of item.kcIds) {
      if (!nodeIds.has(kcId)) throw new Error(`Item ${item.id} references unknown KC ${kcId}`);
    }
    if (item.misconceptionIds) {
      if (item.misconceptionIds.some((id) => !id.trim())) {
        throw new Error(`Item ${item.id} has an empty misconception id`);
      }
      if (new Set(item.misconceptionIds).size !== item.misconceptionIds.length) {
        throw new Error(`Item ${item.id} has duplicate misconception ids`);
      }
    }
    assertProbability(`slip for ${item.id}`, item.slip ?? DEFAULT_DOMAIN_CONFIG.defaultSlip);
    assertProbability(`guess for ${item.id}`, item.guess ?? DEFAULT_DOMAIN_CONFIG.defaultGuess);
    itemMap.set(item.id, item);
  }

  return itemMap;
}

function validateEventEvidence(item: Item, event: LearnerEvent): void {
  if (!event.misconceptionId) return;
  if (!item.misconceptionIds?.includes(event.misconceptionId)) {
    throw new Error(
      `Event ${event.id} reports misconception ${event.misconceptionId} outside item ${item.id}`,
    );
  }
  if (item.kcIds.length !== 1) {
    throw new Error(`Misconception evidence requires a single-KC item: ${item.id}`);
  }
  if (event.correct && event.methodValidity !== 'INVALID') {
    throw new Error(`Correct event ${event.id} needs an invalid method to support a misconception`);
  }
}

function bktUpdate(
  prior: number,
  correct: boolean,
  slip: number,
  guess: number,
  learnProbability: number,
): number {
  const numerator = correct ? prior * (1 - slip) : prior * slip;
  const denominator = correct
    ? numerator + (1 - prior) * guess
    : numerator + (1 - prior) * (1 - guess);
  const observed = denominator === 0 ? prior : numerator / denominator;
  return clampProbability(observed + (1 - observed) * learnProbability);
}

export function computeMastery(
  graph: CurriculumGraph,
  items: readonly Item[],
  events: readonly LearnerEvent[],
  configOverrides?: Partial<DomainConfig>,
): ReadonlyMap<string, MasteryState> {
  topologicalOrder(graph);
  const config = resolveConfig(configOverrides);
  const itemMap = validateItems(graph, items);
  const working = new Map(
    graph.nodes.map((node) => [
      node.id,
      {
        probability: config.initialMastery,
        evidenceEventIds: [] as string[],
        evidenceItemIds: new Set<string>(),
      },
    ]),
  );

  const canonicalEvents = canonicalizeEvents(events);
  if (new Set(canonicalEvents.map((event) => event.learnerId)).size > 1) {
    throw new Error('computeMastery accepts events for one learner at a time');
  }

  for (const event of canonicalEvents) {
    const item = itemMap.get(event.itemId);
    if (!item) throw new Error(`Event ${event.id} references unknown item ${event.itemId}`);
    validateEventEvidence(item, event);
    const slip = item.slip ?? config.defaultSlip;
    const guess = item.guess ?? config.defaultGuess;
    const observationCorrect = event.correct && event.methodValidity !== 'INVALID';
    for (const kcId of item.kcIds) {
      const state = working.get(kcId)!;
      state.probability = bktUpdate(
        state.probability,
        observationCorrect,
        slip,
        guess,
        config.learnProbability,
      );
      state.evidenceEventIds.push(event.id);
      state.evidenceItemIds.add(item.id);
    }
  }

  return new Map(
    [...working].map(([kcId, state]) => [
      kcId,
      {
        kcId,
        probability: state.probability,
        directEvidenceCount: state.evidenceItemIds.size,
        evidenceEventIds: [...state.evidenceEventIds],
      },
    ]),
  );
}

export function inferMisconceptionHypotheses(
  graph: CurriculumGraph,
  items: readonly Item[],
  events: readonly LearnerEvent[],
  minIndependentItems = 2,
): MisconceptionHypothesis[] {
  topologicalOrder(graph);
  if (!Number.isInteger(minIndependentItems) || minIndependentItems < 1) {
    throw new Error('minIndependentItems must be a positive integer');
  }
  const itemMap = validateItems(graph, items);
  const buckets = new Map<
    string,
    { misconceptionId: string; kcId: string; eventIds: string[]; itemIds: Set<string> }
  >();

  const canonicalEvents = canonicalizeEvents(events);
  if (new Set(canonicalEvents.map((event) => event.learnerId)).size > 1) {
    throw new Error('inferMisconceptionHypotheses accepts one learner at a time');
  }
  for (const event of canonicalEvents) {
    const item = itemMap.get(event.itemId);
    if (!item) throw new Error(`Event ${event.id} references unknown item ${event.itemId}`);
    validateEventEvidence(item, event);
    if (!event.misconceptionId) continue;
    const kcId = item.kcIds[0]!;
    const key = `${kcId}:${event.misconceptionId}`;
    const bucket = buckets.get(key) ?? {
      misconceptionId: event.misconceptionId,
      kcId,
      eventIds: [],
      itemIds: new Set<string>(),
    };
    bucket.eventIds.push(event.id);
    bucket.itemIds.add(item.id);
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket): MisconceptionHypothesis => ({
      misconceptionId: bucket.misconceptionId,
      kcId: bucket.kcId,
      verificationStatus:
        bucket.itemIds.size >= minIndependentItems
          ? 'SUPPORTED_BY_MULTIPLE_ITEMS'
          : 'NEEDS_VERIFICATION',
      supportingEventIds: sortedUnique(bucket.eventIds),
      independentItemCount: bucket.itemIds.size,
    }))
    .sort(
      (left, right) =>
        Number(right.verificationStatus === 'SUPPORTED_BY_MULTIPLE_ITEMS') -
          Number(left.verificationStatus === 'SUPPORTED_BY_MULTIPLE_ITEMS') ||
        right.independentItemCount - left.independentItemCount ||
        compareIds(left.misconceptionId, right.misconceptionId),
    );
}

function entropy(probability: number): number {
  const p = clampProbability(probability);
  return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function expectedInformationGain(prior: number, item: Item, config: DomainConfig): number {
  const slip = item.slip ?? config.defaultSlip;
  const guess = item.guess ?? config.defaultGuess;
  const correctProbability = prior * (1 - slip) + (1 - prior) * guess;
  const afterCorrect = bktUpdate(prior, true, slip, guess, config.learnProbability);
  const afterIncorrect = bktUpdate(prior, false, slip, guess, config.learnProbability);
  return (
    entropy(prior) -
    correctProbability * entropy(afterCorrect) -
    (1 - correctProbability) * entropy(afterIncorrect)
  );
}

function selectProbe(
  candidateKcIds: readonly string[],
  items: readonly Item[],
  events: readonly LearnerEvent[],
  mastery: ReadonlyMap<string, MasteryState>,
  config: DomainConfig,
): string | undefined {
  const usedItemIds = new Set(events.map((event) => event.itemId));
  return items
    .filter(
      (item) =>
        (item.role === 'DIAGNOSTIC' || item.role === 'CHECK') &&
        (item.reviewState === 'ACCEPTED' ||
          (config.allowUnreviewedContent && item.reviewState === 'UNREVIEWED')) &&
        item.kcIds.length === 1 &&
        candidateKcIds.includes(item.kcIds[0]!) &&
        !usedItemIds.has(item.id),
    )
    .map((item) => ({
      id: item.id,
      gain: expectedInformationGain(mastery.get(item.kcIds[0]!)!.probability, item, config),
    }))
    .sort((left, right) => right.gain - left.gain || compareIds(left.id, right.id))[0]?.id;
}

/**
 * When the observed gap itself has no unused question, walk toward its
 * unverified prerequisites instead of ending the learner flow. This gathers
 * evidence only; it never promotes the observed skill to a root gap.
 */
function selectUpstreamProbe(
  candidateKcIds: readonly string[],
  graph: CurriculumGraph,
  items: readonly Item[],
  events: readonly LearnerEvent[],
  mastery: ReadonlyMap<string, MasteryState>,
  config: DomainConfig,
): string | undefined {
  const { incoming } = buildAdjacency(graph);
  const visited = new Set(candidateKcIds);
  let frontier = sortedUnique(candidateKcIds.flatMap((kcId) => incoming.get(kcId) ?? []));

  while (frontier.length > 0) {
    const unresolved = frontier.filter(
      (kcId) => !isSufficientlyMastered(mastery.get(kcId)!, config),
    );
    const nextItemId = selectProbe(unresolved, items, events, mastery, config);
    if (nextItemId) return nextItemId;

    unresolved.forEach((kcId) => visited.add(kcId));
    frontier = sortedUnique(
      unresolved.flatMap((kcId) => incoming.get(kcId) ?? []).filter((kcId) => !visited.has(kcId)),
    );
  }

  return undefined;
}

function selectProbeOrUpstream(
  candidateKcIds: readonly string[],
  graph: CurriculumGraph,
  items: readonly Item[],
  events: readonly LearnerEvent[],
  mastery: ReadonlyMap<string, MasteryState>,
  config: DomainConfig,
): string | undefined {
  return (
    selectProbe(candidateKcIds, items, events, mastery, config) ??
    selectUpstreamProbe(candidateKcIds, graph, items, events, mastery, config)
  );
}

export function planPracticePath(
  graph: CurriculumGraph,
  rootKcId: string,
  targetKcId: string,
  mastery: ReadonlyMap<string, MasteryState>,
  masteryThreshold: number,
  minDirectEvidence = 1,
): PathPlan {
  const graphPathKcIds = shortestPath(graph, rootKcId, targetKcId);
  const practiceKcIds = graphPathKcIds.filter(
    (kcId) =>
      kcId === rootKcId ||
      kcId === targetKcId ||
      (mastery.get(kcId)?.probability ?? 0) < masteryThreshold ||
      (mastery.get(kcId)?.directEvidenceCount ?? 0) < minDirectEvidence,
  );
  return { graphPathKcIds, practiceKcIds };
}

function diagnosticEventCount(events: readonly LearnerEvent[], items: readonly Item[]): number {
  const roles = new Map(items.map((item) => [item.id, item.role]));
  return events.filter((event) => roles.get(event.itemId) === 'DIAGNOSTIC').length;
}

function isSufficientlyMastered(state: MasteryState, config: DomainConfig): boolean {
  return (
    state.probability >= config.masteryThreshold &&
    state.directEvidenceCount >= config.minDirectEvidence
  );
}

function emptyResult(
  input: DiagnosisInput,
  status: DiagnosisResult['status'],
  misconceptionHypotheses: readonly MisconceptionHypothesis[] = [],
): DiagnosisResult {
  const disposition =
    status === 'DIAGNOSED'
      ? 'AUTO_REMEDIATE'
      : status === 'FAST_PATH'
        ? 'ADVANCE'
        : status === 'OUT_OF_SCOPE'
          ? 'OUT_OF_SCOPE'
          : 'TEACHER_REVIEW';
  return {
    status,
    disposition,
    learnerId: input.learnerId,
    targetKcId: input.targetKcId,
    competingKcIds: [],
    evidenceEventIds: [],
    pathKcIds: [],
    reasonCodes: [],
    misconceptionHypotheses,
    contentVersion: input.graph.version,
    algorithmVersion: ALGORITHM_VERSION,
  };
}

export function diagnose(input: DiagnosisInput): DiagnosisResult {
  topologicalOrder(input.graph);
  const config = resolveConfig(input.config);
  const graphNodeIds = new Set(input.graph.nodes.map((node) => node.id));
  if (!graphNodeIds.has(input.targetKcId)) {
    return {
      ...emptyResult(input, 'OUT_OF_SCOPE'),
      reasonCodes: ['TARGET_OUTSIDE_GRAPH'],
    };
  }

  const learnerEvents = canonicalizeEvents(
    input.events.filter((event) => event.learnerId === input.learnerId),
  );
  const mastery = computeMastery(input.graph, input.items, learnerEvents, config);
  const misconceptionHypotheses = inferMisconceptionHypotheses(
    input.graph,
    input.items,
    learnerEvents,
  );
  const ancestors = ancestorIds(input.graph, input.targetKcId);
  const targetAndPrerequisites = [input.targetKcId, ...ancestors];

  if (targetAndPrerequisites.every((kcId) => isSufficientlyMastered(mastery.get(kcId)!, config))) {
    const usedItemIds = new Set(learnerEvents.map((event) => event.itemId));
    const transferItem = input.items
      .filter(
        (item) =>
          item.role === 'TRANSFER' &&
          (item.reviewState === 'ACCEPTED' ||
            (config.allowUnreviewedContent && item.reviewState === 'UNREVIEWED')) &&
          item.kcIds.includes(input.targetKcId) &&
          !usedItemIds.has(item.id),
      )
      .sort((left, right) => compareIds(left.id, right.id))[0];
    return {
      ...emptyResult(input, 'FAST_PATH', misconceptionHypotheses),
      evidenceEventIds: sortedUnique(
        targetAndPrerequisites.flatMap((kcId) => mastery.get(kcId)!.evidenceEventIds),
      ),
      ...(transferItem ? { nextItemId: transferItem.id } : {}),
      reasonCodes: ['TARGET_AND_PREREQUISITES_MASTERED'],
    };
  }

  const { incoming } = buildAdjacency(input.graph);
  const evidencedGaps = ancestors.filter((kcId) => {
    const state = mastery.get(kcId)!;
    return (
      state.directEvidenceCount >= config.minDirectEvidence &&
      state.probability <= config.gapThreshold
    );
  });
  const actionable = evidencedGaps.filter((kcId) =>
    incoming
      .get(kcId)!
      .every((prerequisiteId) => isSufficientlyMastered(mastery.get(prerequisiteId)!, config)),
  );
  const ranked = [...actionable].sort(
    (left, right) =>
      mastery.get(left)!.probability - mastery.get(right)!.probability || compareIds(left, right),
  );
  const diagnosticsUsed = diagnosticEventCount(learnerEvents, input.items);

  if (ranked.length > 0) {
    const best = ranked[0]!;
    const second = ranked[1];
    if (
      second &&
      Math.abs(mastery.get(best)!.probability - mastery.get(second)!.probability) <=
        config.ambiguityMargin
    ) {
      const competingKcIds = [best, second];
      const nextItemId =
        diagnosticsUsed < config.maxDiagnosticItems
          ? selectProbeOrUpstream(
              competingKcIds,
              input.graph,
              input.items,
              learnerEvents,
              mastery,
              config,
            )
          : undefined;
      return {
        ...emptyResult(input, 'NEEDS_MORE_EVIDENCE', misconceptionHypotheses),
        disposition: nextItemId ? 'ASK_VERIFY' : 'TEACHER_REVIEW',
        competingKcIds,
        evidenceEventIds: sortedUnique(
          competingKcIds.flatMap((kcId) => mastery.get(kcId)!.evidenceEventIds),
        ),
        ...(nextItemId ? { nextItemId } : {}),
        reasonCodes:
          diagnosticsUsed < config.maxDiagnosticItems
            ? ['COMPETING_ROOTS']
            : ['COMPETING_ROOTS', 'DIAGNOSTIC_BUDGET_EXHAUSTED'],
      };
    }

    const path = planPracticePath(
      input.graph,
      best,
      input.targetKcId,
      mastery,
      config.masteryThreshold,
      config.minDirectEvidence,
    );
    if (path.graphPathKcIds.length === 0) {
      return {
        ...emptyResult(input, 'OUT_OF_SCOPE', misconceptionHypotheses),
        rootKcId: best,
        evidenceEventIds: mastery.get(best)!.evidenceEventIds,
        reasonCodes: ['NO_VALID_PATH'],
      };
    }
    return {
      ...emptyResult(input, 'DIAGNOSED', misconceptionHypotheses),
      rootKcId: best,
      evidenceEventIds: mastery.get(best)!.evidenceEventIds,
      pathKcIds: path.practiceKcIds,
      reasonCodes: ['ROOT_GAP_SUPPORTED'],
    };
  }

  const belowMastery = ancestors.filter(
    (kcId) => mastery.get(kcId)!.probability < config.masteryThreshold,
  );
  const directlyObserved = belowMastery.filter(
    (kcId) => mastery.get(kcId)!.directEvidenceCount > 0,
  );
  const uncertainCandidates = (directlyObserved.length > 0 ? directlyObserved : belowMastery)
    .sort(
      (left, right) =>
        Math.abs(mastery.get(left)!.probability - 0.5) -
          Math.abs(mastery.get(right)!.probability - 0.5) || compareIds(left, right),
    )
    .slice(0, 2);
  const budgetAvailable = diagnosticsUsed < config.maxDiagnosticItems;
  const nextItemId = budgetAvailable
    ? selectProbeOrUpstream(
        uncertainCandidates,
        input.graph,
        input.items,
        learnerEvents,
        mastery,
        config,
      )
    : undefined;
  return {
    ...emptyResult(input, 'NEEDS_MORE_EVIDENCE', misconceptionHypotheses),
    disposition: nextItemId ? 'ASK_VERIFY' : 'TEACHER_REVIEW',
    competingKcIds: uncertainCandidates,
    evidenceEventIds: sortedUnique(
      uncertainCandidates.flatMap((kcId) => mastery.get(kcId)!.evidenceEventIds),
    ),
    ...(nextItemId ? { nextItemId } : {}),
    reasonCodes: budgetAvailable
      ? ['INSUFFICIENT_DIRECT_EVIDENCE', 'NO_ACTIONABLE_ROOT']
      : ['INSUFFICIENT_DIRECT_EVIDENCE', 'DIAGNOSTIC_BUDGET_EXHAUSTED'],
  };
}

/** Apply an explicit human decision without mutating or fabricating learner evidence. */
export function applyTeacherOverride(
  graph: CurriculumGraph,
  diagnosis: DiagnosisResult,
  override: TeacherDiagnosisOverride,
): DiagnosisResult {
  topologicalOrder(graph);
  if (override.learnerId !== diagnosis.learnerId) {
    throw new Error('Teacher override learner does not match diagnosis');
  }
  if (override.targetKcId !== diagnosis.targetKcId) {
    throw new Error('Teacher override target does not match diagnosis');
  }

  const common = {
    learnerId: diagnosis.learnerId,
    targetKcId: diagnosis.targetKcId,
    evidenceEventIds: diagnosis.evidenceEventIds,
    reasonCodes: ['TEACHER_OVERRIDE_APPLIED'] as const,
    misconceptionHypotheses: diagnosis.misconceptionHypotheses,
    contentVersion: diagnosis.contentVersion,
    algorithmVersion: diagnosis.algorithmVersion,
  };

  if (override.decision === 'NEEDS_MORE_EVIDENCE') {
    return {
      ...common,
      status: 'NEEDS_MORE_EVIDENCE',
      disposition: 'TEACHER_REVIEW',
      competingKcIds: diagnosis.competingKcIds,
      pathKcIds: [],
    };
  }

  if (!override.rootKcId) throw new Error('SET_ROOT override requires rootKcId');
  const pathKcIds = shortestPath(graph, override.rootKcId, diagnosis.targetKcId);
  if (pathKcIds.length === 0) {
    throw new Error('Teacher override root needs a valid path to the target');
  }
  return {
    ...common,
    status: 'DIAGNOSED',
    disposition: 'AUTO_REMEDIATE',
    rootKcId: override.rootKcId,
    competingKcIds: [],
    pathKcIds,
  };
}

export function groupForTeacher(
  graph: CurriculumGraph,
  diagnoses: readonly DiagnosisResult[],
): TeacherGroup[] {
  topologicalOrder(graph);
  const buckets = new Map<string, DiagnosisResult[]>();
  const seenLearners = new Set<string>();

  for (const diagnosis of diagnoses) {
    if (seenLearners.has(diagnosis.learnerId)) {
      throw new Error(`Duplicate diagnosis for learner ${diagnosis.learnerId}`);
    }
    seenLearners.add(diagnosis.learnerId);
    if (diagnosis.status === 'DIAGNOSED' && !diagnosis.rootKcId) {
      throw new Error(`Diagnosed learner ${diagnosis.learnerId} needs a rootKcId`);
    }
    const key =
      diagnosis.status === 'DIAGNOSED'
        ? `root:${diagnosis.rootKcId}`
        : diagnosis.status === 'FAST_PATH'
          ? 'ready'
          : diagnosis.disposition === 'ASK_VERIFY'
            ? 'quick-check'
            : 'teacher-review';
    const bucket = buckets.get(key) ?? [];
    bucket.push(diagnosis);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([id, members]): TeacherGroup => {
      const rootKcId = id.startsWith('root:') ? id.slice(5) : undefined;
      const status = rootKcId
        ? 'ACTIONABLE_ROOT'
        : id === 'ready'
          ? 'READY_TO_ADVANCE'
          : id === 'quick-check'
            ? 'QUICK_CHECK'
            : 'TEACHER_REVIEW';
      const blockedDescendantCount = rootKcId ? descendantIds(graph, rootKcId).length : 0;
      const learnerIds = sortedUnique(members.map((member) => member.learnerId));
      return {
        id,
        status,
        ...(rootKcId ? { rootKcId } : {}),
        learnerIds,
        sufficientEvidenceCount: members.filter(
          (member) => member.status === 'DIAGNOSED' || member.status === 'FAST_PATH',
        ).length,
        totalLearnerCount: learnerIds.length,
        blockedDescendantCount,
        priorityScore: rootKcId ? learnerIds.length * blockedDescendantCount : 0,
        representativeEventIds: sortedUnique(
          members.flatMap((member) => member.evidenceEventIds),
        ).slice(0, 3),
        suggestedActionId: rootKcId
          ? `RETEACH_${rootKcId}`
          : id === 'ready'
            ? 'OFFER_TRANSFER_CHALLENGE'
            : id === 'quick-check'
              ? 'RUN_QUICK_CHECK'
              : 'REVIEW_DIAGNOSIS',
      };
    })
    .sort(
      (left, right) => right.priorityScore - left.priorityScore || compareIds(left.id, right.id),
    );
}

export function detectClassWideGaps(
  groups: readonly TeacherGroup[],
  classSize: number,
  thresholdRate = 0.3,
  thresholdCount = 3,
): ClassWideGap[] {
  if (!Number.isInteger(classSize) || classSize < 1) throw new Error('classSize must be positive');
  assertProbability('thresholdRate', thresholdRate);
  if (!Number.isInteger(thresholdCount) || thresholdCount < 1) {
    throw new Error('thresholdCount must be a positive integer');
  }
  const representedLearners = new Set(groups.flatMap((group) => group.learnerIds));
  if (representedLearners.size > classSize) {
    throw new Error('classSize cannot be smaller than represented learners');
  }

  return groups
    .filter(
      (group) =>
        group.status === 'ACTIONABLE_ROOT' &&
        group.rootKcId &&
        group.sufficientEvidenceCount >= thresholdCount &&
        group.sufficientEvidenceCount / classSize >= thresholdRate,
    )
    .map((group) => ({
      rootKcId: group.rootKcId!,
      learnerCount: group.sufficientEvidenceCount,
      classSize,
      rate: group.sufficientEvidenceCount / classSize,
      thresholdRate,
      thresholdCount,
    }))
    .sort((left, right) => right.rate - left.rate || compareIds(left.rootKcId, right.rootKcId));
}

interface AttentionSelection {
  readonly value: number;
  readonly groupIds: readonly string[];
}

function selectionKey(selection: AttentionSelection): string {
  return [...selection.groupIds].sort(compareIds).join('|');
}

function betterSelection(
  candidate: AttentionSelection,
  current: AttentionSelection | undefined,
): boolean {
  if (!current) return true;
  return (
    candidate.value > current.value ||
    (candidate.value === current.value && selectionKey(candidate) < selectionKey(current))
  );
}

export function allocateTeacherAttention(
  groups: readonly TeacherGroup[],
  budgetMinutes: number,
  actionMinutes: Readonly<Record<string, number>>,
): TeacherAttentionPlan {
  if (!Number.isInteger(budgetMinutes) || budgetMinutes < 0) {
    throw new Error('budgetMinutes must be a non-negative integer');
  }
  if (new Set(groups.map((group) => group.id)).size !== groups.length) {
    throw new Error('Teacher groups need unique ids');
  }

  const candidates: TeacherAttentionItem[] = groups
    .filter((group) => group.status !== 'READY_TO_ADVANCE')
    .map((group): TeacherAttentionItem => {
      const minutes = actionMinutes[group.suggestedActionId];
      if (!Number.isInteger(minutes) || minutes < 1) {
        throw new Error(`Missing positive minute estimate for ${group.suggestedActionId}`);
      }
      const attentionValue =
        group.status === 'ACTIONABLE_ROOT' ? group.priorityScore : group.totalLearnerCount;
      const reasonCode =
        group.status === 'ACTIONABLE_ROOT'
          ? 'ROOT_BOTTLENECK'
          : group.status === 'TEACHER_REVIEW'
            ? 'HUMAN_ESCALATION'
            : 'UNCERTAINTY_QUEUE';
      return {
        groupId: group.id,
        actionId: group.suggestedActionId,
        minutes,
        attentionValue,
        valuePerMinute: attentionValue / minutes,
        reasonCode,
      };
    })
    .filter((candidate) => candidate.attentionValue > 0);

  const byId = new Map(candidates.map((candidate) => [candidate.groupId, candidate]));
  const states: Array<AttentionSelection | undefined> = Array.from({
    length: budgetMinutes + 1,
  });
  states[0] = { value: 0, groupIds: [] };

  for (const candidate of candidates) {
    for (let used = budgetMinutes - candidate.minutes; used >= 0; used -= 1) {
      const state = states[used];
      if (!state) continue;
      const nextUsed = used + candidate.minutes;
      const proposal: AttentionSelection = {
        value: state.value + candidate.attentionValue,
        groupIds: [...state.groupIds, candidate.groupId],
      };
      if (betterSelection(proposal, states[nextUsed])) states[nextUsed] = proposal;
    }
  }

  let bestUsed = 0;
  let best = states[0]!;
  for (let used = 1; used < states.length; used += 1) {
    const state = states[used];
    if (!state) continue;
    if (
      state.value > best.value ||
      (state.value === best.value && used < bestUsed) ||
      (state.value === best.value && used === bestUsed && selectionKey(state) < selectionKey(best))
    ) {
      best = state;
      bestUsed = used;
    }
  }

  const selectedIds = new Set(best.groupIds);
  const selected = groups
    .map((group) => byId.get(group.id))
    .filter((candidate): candidate is TeacherAttentionItem =>
      Boolean(candidate && selectedIds.has(candidate.groupId)),
    );
  const deferred = groups
    .map((group) => byId.get(group.id))
    .filter((candidate): candidate is TeacherAttentionItem =>
      Boolean(candidate && !selectedIds.has(candidate.groupId)),
    );

  return {
    policyVersion: 'teacher-budget-v1',
    budgetMinutes,
    usedMinutes: bestUsed,
    remainingMinutes: budgetMinutes - bestUsed,
    selected,
    deferred,
  };
}
