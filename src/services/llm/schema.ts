import { z } from 'zod';

/**
 * Zod schemas for both directions of the LLM boundary. The provider is asked
 * for schema-constrained JSON (response_format: json_schema); this file is the
 * single source of truth for what a valid model reply looks like.
 */

export const tutorLlmRequestSchema = z.object({
  requestId: z.string().min(1),
  useCase: z.enum(['EXPLAIN_DIAGNOSIS', 'REWORD_HINT', 'TEACHER_SUMMARY']),
  locale: z.literal('vi-VN'),
  facts: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  allowedCitationIds: z.array(z.string()),
  forbiddenStrings: z.array(z.string()),
  fallbackText: z.string().min(1),
});

/** What the model must return (before guards run). */
export const tutorLlmModelReplySchema = z.object({
  text: z.string().min(1).max(1200),
  citedIds: z.array(z.string()).default([]),
});

export type TutorLlmModelReply = z.infer<typeof tutorLlmModelReplySchema>;

/** JSON Schema handed to OpenAI-compatible endpoints as response_format. */
export const TUTOR_LLM_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'citedIds'],
  properties: {
    text: { type: 'string', maxLength: 1200 },
    citedIds: { type: 'array', items: { type: 'string' } },
  },
} as const;
