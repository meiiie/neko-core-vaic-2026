import type { TutorLlmPort, TutorLlmRequest, TutorLlmResult } from './port';
import { runGuards } from './guards';
import { TUTOR_LLM_RESPONSE_JSON_SCHEMA } from './schema';

/**
 * ONE adapter for every OpenAI-compatible /chat/completions endpoint —
 * a cloud provider behind our server proxy, or a LOCAL server
 * (Ollama / llama-server). Mirrors NekoCore's providers.ts: a new endpoint is
 * a data edit (profile), not a code change.
 *
 * The browser build never holds an API key: the `fpt` profile points at our
 * same-origin proxy which owns the key server-side. Direct keyed calls are
 * only valid for localhost model servers.
 */

export interface OpenAiCompatProfile {
  readonly profileId: string;
  readonly baseUrl: string;
  readonly model?: string;
  /** Extra headers (e.g. none for proxy; local servers need none either). */
  readonly headers?: Readonly<Record<string, string>>;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 2;
const DEFAULT_DEADLINE_MS = 4_000;

/** Circuit breaker: after N consecutive failures, short-circuit for cooldownMs. */
const BREAKER = { failures: 0, openUntil: 0, threshold: 3, cooldownMs: 30_000 };

function buildMessages(request: TutorLlmRequest): unknown[] {
  return [
    {
      role: 'system',
      content:
        'Bạn là trợ lý sư phạm tiếng Việt. Chỉ được diễn đạt lại các dữ kiện được cung cấp; ' +
        'tuyệt đối không thêm kết luận mới, không nêu đáp án của bài tập, không nhắc ID nào ' +
        'ngoài danh sách cho phép. Trả về JSON đúng schema.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        useCase: request.useCase,
        facts: request.facts,
        allowedCitationIds: request.allowedCitationIds,
      }),
    },
  ];
}

export class OpenAiCompatTutorLlm implements TutorLlmPort {
  constructor(
    private readonly profile: OpenAiCompatProfile,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(
    request: TutorLlmRequest,
    opts?: { signal?: AbortSignal; deadlineMs?: number },
  ): Promise<TutorLlmResult> {
    const started = performance.now();
    const fallback = (reason: TutorLlmResult['meta']['fallbackReason']): TutorLlmResult => ({
      status: 'FALLBACK',
      text: request.fallbackText,
      citedIds: [],
      meta: {
        profileId: this.profile.profileId,
        model: this.profile.model,
        latencyMs: Math.round(performance.now() - started),
        fallbackReason: reason,
      },
    });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return fallback('OFFLINE');
    }
    if (Date.now() < BREAKER.openUntil) return fallback('HTTP_ERROR');

    const deadlineMs = opts?.deadlineMs ?? DEFAULT_DEADLINE_MS;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), deadlineMs);
      const onOuterAbort = () => controller.abort();
      opts?.signal?.addEventListener('abort', onOuterAbort, { once: true });
      try {
        const response = await this.fetchImpl(`${this.profile.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...this.profile.headers },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.profile.model,
            messages: buildMessages(request),
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'tutor_reply', schema: TUTOR_LLM_RESPONSE_JSON_SCHEMA },
            },
            stream: false,
          }),
        });

        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) continue;
          BREAKER.failures += 1;
          if (BREAKER.failures >= BREAKER.threshold) {
            BREAKER.openUntil = Date.now() + BREAKER.cooldownMs;
            BREAKER.failures = 0;
          }
          return fallback('HTTP_ERROR');
        }

        BREAKER.failures = 0;
        const body: unknown = await response.json();
        const content =
          typeof body === 'object' && body !== null
            ? ((body as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
                ?.content ?? '')
            : '';
        let candidate: unknown;
        try {
          candidate = JSON.parse(content);
        } catch {
          return fallback('SCHEMA_INVALID');
        }
        const verdict = runGuards(candidate, request);
        if (!verdict.ok) return fallback(verdict.reason);
        return {
          status: 'OK',
          text: verdict.reply.text,
          citedIds: verdict.reply.citedIds,
          meta: {
            profileId: this.profile.profileId,
            model: this.profile.model,
            latencyMs: Math.round(performance.now() - started),
          },
        };
      } catch {
        if (opts?.signal?.aborted) return fallback('TIMEOUT');
        if (attempt < MAX_ATTEMPTS) continue;
        return fallback('TIMEOUT');
      } finally {
        clearTimeout(timer);
        opts?.signal?.removeEventListener('abort', onOuterAbort);
      }
    }
    return fallback('HTTP_ERROR');
  }
}
