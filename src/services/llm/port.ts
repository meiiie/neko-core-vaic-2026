/**
 * TutorLlmPort — the ONE interface every caller depends on (mirrors NekoCore's
 * Provider port: one port, one method; adapters are interchangeable data-driven
 * profiles). See E:\Sach\Sua\hanoi_thi\LLM_HARNESS_PLAN.md.
 *
 * Locked principles:
 * - The LLM is the voice, never the brain: requests carry only IDs and
 *   already-computed deterministic facts; no call may change mastery, root,
 *   path, grouping or priority.
 * - Without any provider the product stays complete: every use case has a
 *   deterministic fallback, surfaced honestly via status='FALLBACK'.
 */

export type TutorLlmUseCase = 'EXPLAIN_DIAGNOSIS' | 'REWORD_HINT' | 'TEACHER_SUMMARY';

export interface TutorLlmRequest {
  readonly requestId: string;
  readonly useCase: TutorLlmUseCase;
  readonly locale: 'vi-VN';
  /** Deterministic facts only (IDs, labels, statuses). Never raw learner data. */
  readonly facts: Readonly<Record<string, string | number | boolean>>;
  /** IDs the response may cite; anything else is a guard violation. */
  readonly allowedCitationIds: readonly string[];
  /** Strings that must NOT appear in the output (e.g. the correct answer). */
  readonly forbiddenStrings: readonly string[];
  /** Deterministic text used when the provider fails or is disabled. */
  readonly fallbackText: string;
}

export type TutorLlmFallbackReason =
  | 'DISABLED'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'SCHEMA_INVALID'
  | 'CITATION_VIOLATION'
  | 'ANSWER_LEAKAGE'
  | 'CONSISTENCY_VIOLATION'
  | 'BUDGET_EXHAUSTED';

export interface TutorLlmResult {
  readonly status: 'OK' | 'FALLBACK';
  readonly text: string;
  readonly citedIds: readonly string[];
  readonly meta: {
    readonly profileId: string;
    readonly model?: string;
    readonly latencyMs: number;
    readonly fallbackReason?: TutorLlmFallbackReason;
  };
}

export interface TutorLlmPort {
  complete(
    request: TutorLlmRequest,
    opts?: { signal?: AbortSignal; deadlineMs?: number },
  ): Promise<TutorLlmResult>;
}
