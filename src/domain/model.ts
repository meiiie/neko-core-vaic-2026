export type ReviewState = 'UNREVIEWED' | 'ACCEPTED' | 'REVISE' | 'REJECTED';

export interface KnowledgeComponent {
  readonly id: string;
  readonly name: string;
}

export interface PrerequisiteEdge {
  readonly from: string;
  readonly to: string;
}

export interface CurriculumGraph {
  readonly version: string;
  readonly nodes: readonly KnowledgeComponent[];
  readonly edges: readonly PrerequisiteEdge[];
}

export type ItemRole = 'DIAGNOSTIC' | 'PRACTICE' | 'CHECK' | 'TRANSFER';

export interface Item {
  readonly id: string;
  readonly kcIds: readonly string[];
  readonly role: ItemRole;
  readonly slip?: number;
  readonly guess?: number;
  readonly reviewState: ReviewState;
}

export interface LearnerEvent {
  readonly id: string;
  readonly learnerId: string;
  readonly itemId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly correct: boolean;
}

export interface MasteryState {
  readonly kcId: string;
  readonly probability: number;
  readonly directEvidenceCount: number;
  readonly evidenceEventIds: readonly string[];
}

export interface DomainConfig {
  readonly initialMastery: number;
  readonly learnProbability: number;
  readonly defaultSlip: number;
  readonly defaultGuess: number;
  readonly masteryThreshold: number;
  readonly gapThreshold: number;
  readonly minDirectEvidence: number;
  readonly maxDiagnosticItems: number;
  readonly ambiguityMargin: number;
}

export const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
  initialMastery: 0.5,
  learnProbability: 0.05,
  defaultSlip: 0.1,
  defaultGuess: 0.2,
  masteryThreshold: 0.8,
  gapThreshold: 0.4,
  minDirectEvidence: 2,
  maxDiagnosticItems: 6,
  ambiguityMargin: 0.08,
};

export type DiagnosisStatus =
  | 'DIAGNOSED'
  | 'NEEDS_MORE_EVIDENCE'
  | 'OUT_OF_SCOPE'
  | 'FAST_PATH';

export type DiagnosisReasonCode =
  | 'ROOT_GAP_SUPPORTED'
  | 'COMPETING_ROOTS'
  | 'INSUFFICIENT_DIRECT_EVIDENCE'
  | 'DIAGNOSTIC_BUDGET_EXHAUSTED'
  | 'TARGET_AND_PREREQUISITES_MASTERED'
  | 'TARGET_OUTSIDE_GRAPH'
  | 'NO_ACTIONABLE_ROOT'
  | 'NO_VALID_PATH';

export interface DiagnosisResult {
  readonly status: DiagnosisStatus;
  readonly learnerId: string;
  readonly targetKcId: string;
  readonly rootKcId?: string;
  readonly competingKcIds: readonly string[];
  readonly evidenceEventIds: readonly string[];
  readonly nextItemId?: string;
  readonly pathKcIds: readonly string[];
  readonly reasonCodes: readonly DiagnosisReasonCode[];
  readonly contentVersion: string;
  readonly algorithmVersion: string;
}

export interface DiagnosisInput {
  readonly learnerId: string;
  readonly targetKcId: string;
  readonly graph: CurriculumGraph;
  readonly items: readonly Item[];
  readonly events: readonly LearnerEvent[];
  readonly config?: Partial<DomainConfig>;
}

export interface PathPlan {
  readonly graphPathKcIds: readonly string[];
  readonly practiceKcIds: readonly string[];
}

export interface TeacherGroup {
  readonly id: string;
  readonly status: 'ACTIONABLE_ROOT' | 'QUICK_CHECK' | 'READY_TO_ADVANCE';
  readonly rootKcId?: string;
  readonly learnerIds: readonly string[];
  readonly sufficientEvidenceCount: number;
  readonly totalLearnerCount: number;
  readonly blockedDescendantCount: number;
  readonly priorityScore: number;
  readonly representativeEventIds: readonly string[];
  readonly suggestedActionId: string;
}

export interface ClassWideGap {
  readonly rootKcId: string;
  readonly learnerCount: number;
  readonly classSize: number;
  readonly rate: number;
  readonly thresholdRate: number;
  readonly thresholdCount: number;
}
