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
  /** Misconception IDs that authored answer options on this item may emit. */
  readonly misconceptionIds?: readonly string[];
  readonly slip?: number;
  readonly guess?: number;
  readonly reviewState: ReviewState;
}

export type MethodValidity = 'VALID' | 'INVALID' | 'UNKNOWN';

export interface LearnerEvent {
  readonly id: string;
  readonly learnerId: string;
  readonly itemId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly correct: boolean;
  /** Separate answer correctness from whether the observed method was pedagogically valid. */
  readonly methodValidity?: MethodValidity;
  /** Authored distractor signal. Never inferred from a learner/profile name. */
  readonly misconceptionId?: string;
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
  readonly allowUnreviewedContent: boolean;
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
  allowUnreviewedContent: false,
};

export type DiagnosisStatus = 'DIAGNOSED' | 'NEEDS_MORE_EVIDENCE' | 'OUT_OF_SCOPE' | 'FAST_PATH';

export type DiagnosisDisposition =
  'AUTO_REMEDIATE' | 'ASK_VERIFY' | 'TEACHER_REVIEW' | 'ADVANCE' | 'OUT_OF_SCOPE';

export interface MisconceptionHypothesis {
  readonly misconceptionId: string;
  readonly kcId: string;
  readonly verificationStatus: 'NEEDS_VERIFICATION' | 'SUPPORTED_BY_MULTIPLE_ITEMS';
  readonly supportingEventIds: readonly string[];
  readonly independentItemCount: number;
}

export type DiagnosisReasonCode =
  | 'ROOT_GAP_SUPPORTED'
  | 'COMPETING_ROOTS'
  | 'INSUFFICIENT_DIRECT_EVIDENCE'
  | 'DIAGNOSTIC_BUDGET_EXHAUSTED'
  | 'TARGET_AND_PREREQUISITES_MASTERED'
  | 'TARGET_OUTSIDE_GRAPH'
  | 'NO_ACTIONABLE_ROOT'
  | 'NO_VALID_PATH'
  | 'TEACHER_OVERRIDE_APPLIED';

export interface DiagnosisResult {
  readonly status: DiagnosisStatus;
  readonly disposition: DiagnosisDisposition;
  readonly learnerId: string;
  readonly targetKcId: string;
  readonly rootKcId?: string;
  readonly competingKcIds: readonly string[];
  readonly evidenceEventIds: readonly string[];
  readonly nextItemId?: string;
  readonly pathKcIds: readonly string[];
  readonly reasonCodes: readonly DiagnosisReasonCode[];
  readonly misconceptionHypotheses: readonly MisconceptionHypothesis[];
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

export type TeacherOverrideDecision = 'SET_ROOT' | 'NEEDS_MORE_EVIDENCE';

export interface TeacherDiagnosisOverride {
  readonly learnerId: string;
  readonly targetKcId: string;
  readonly decision: TeacherOverrideDecision;
  readonly rootKcId?: string;
}

export interface PathPlan {
  readonly graphPathKcIds: readonly string[];
  readonly practiceKcIds: readonly string[];
}

export interface TeacherGroup {
  readonly id: string;
  readonly status: 'ACTIONABLE_ROOT' | 'QUICK_CHECK' | 'TEACHER_REVIEW' | 'READY_TO_ADVANCE';
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

export type TeacherAttentionReasonCode =
  'ROOT_BOTTLENECK' | 'UNCERTAINTY_QUEUE' | 'HUMAN_ESCALATION';

export interface TeacherAttentionItem {
  readonly groupId: string;
  readonly actionId: string;
  readonly minutes: number;
  /** Transparent heuristic value, not a claimed learning-gain estimate. */
  readonly attentionValue: number;
  readonly valuePerMinute: number;
  readonly reasonCode: TeacherAttentionReasonCode;
}

export interface TeacherAttentionPlan {
  readonly policyVersion: 'teacher-budget-v1';
  readonly budgetMinutes: number;
  readonly usedMinutes: number;
  readonly remainingMinutes: number;
  readonly selected: readonly TeacherAttentionItem[];
  readonly deferred: readonly TeacherAttentionItem[];
}
