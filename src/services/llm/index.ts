import { MockTutorLlm } from './mock';
import { OpenAiCompatTutorLlm } from './openai-compat';
import type { TutorLlmPort } from './port';

export type { TutorLlmPort, TutorLlmRequest, TutorLlmResult, TutorLlmUseCase } from './port';
export { runGuards } from './guards';
export { MockTutorLlm } from './mock';
export { OpenAiCompatTutorLlm, type OpenAiCompatProfile } from './openai-compat';

/**
 * Profiles are DATA, not code (NekoCore config.ts:82 — "a new model/endpoint
 * is a data edit, not a code change").
 *
 * - mock:  deterministic templates; offline default. Active profile for L1.
 * - fpt:   same-origin server proxy holding the provider key (admitted at L2
 *          only after core gates pass — see LLM_HARNESS_PLAN.md §3).
 * - local: an OpenAI-compatible local server (Ollama / llama-server).
 */
export const LLM_PROFILES = {
  mock: { kind: 'mock' },
  fpt: { kind: 'openai_compat', profileId: 'fpt', baseUrl: '/api/v1/llm' },
  local: {
    kind: 'openai_compat',
    profileId: 'local',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b-instruct',
  },
} as const;

export type LlmProfileId = keyof typeof LLM_PROFILES;

/** L1 default. Switching to 'fpt'/'local' is a one-line data change. */
export const ACTIVE_LLM_PROFILE: LlmProfileId = 'mock';

export function resolveTutorLlm(profileId: LlmProfileId = ACTIVE_LLM_PROFILE): TutorLlmPort {
  const profile = LLM_PROFILES[profileId];
  if (profile.kind === 'mock') return new MockTutorLlm();
  return new OpenAiCompatTutorLlm(profile);
}
