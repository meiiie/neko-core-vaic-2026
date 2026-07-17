import type { TutorLlmFallbackReason, TutorLlmRequest } from './port';
import { tutorLlmModelReplySchema, type TutorLlmModelReply } from './schema';

/**
 * Guard pipeline — runs on EVERY model reply, in order. The first failure
 * rejects the reply with a typed reason; the caller then serves the
 * deterministic fallback. No guard may mutate the reply.
 */

export type GuardVerdict =
  { ok: true; reply: TutorLlmModelReply } | { ok: false; reason: TutorLlmFallbackReason };

function normalize(value: string): string {
  return value.toLocaleLowerCase('vi-VN').normalize('NFC').replace(/\s+/g, ' ');
}

export function runGuards(rawReply: unknown, request: TutorLlmRequest): GuardVerdict {
  // 1. Schema: the reply must parse exactly.
  const parsed = tutorLlmModelReplySchema.safeParse(rawReply);
  if (!parsed.success) return { ok: false, reason: 'SCHEMA_INVALID' };
  const reply = parsed.data;

  // 2. Citation: every cited ID must be explicitly allowed.
  const allowed = new Set(request.allowedCitationIds);
  if (reply.citedIds.some((id) => !allowed.has(id))) {
    return { ok: false, reason: 'CITATION_VIOLATION' };
  }

  // 3. No answer leakage: forbidden strings (correct answers, result values)
  //    must not appear in the text.
  const haystack = normalize(reply.text);
  for (const forbidden of request.forbiddenStrings) {
    const needle = normalize(forbidden);
    if (needle.length > 0 && haystack.includes(needle)) {
      return { ok: false, reason: 'ANSWER_LEAKAGE' };
    }
  }

  // 4. Consistency: the reply must not contradict supplied boolean facts by
  //    claiming mastery of the diagnosed root gap.
  const rootName = request.facts['rootKcName'];
  if (typeof rootName === 'string' && rootName.length > 0) {
    const contradictions = [`đã vững ${normalize(rootName)}`, `đã nắm chắc ${normalize(rootName)}`];
    if (contradictions.some((phrase) => haystack.includes(phrase))) {
      return { ok: false, reason: 'CONSISTENCY_VIOLATION' };
    }
  }

  return { ok: true, reply };
}
