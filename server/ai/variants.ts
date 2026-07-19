import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HERO_GRAPH } from '../../src/content/hero-demo.ts';
import { HERO_MISCONCEPTIONS } from '../../src/content/hero-misconceptions.ts';
import { NVIDIA_KEY_HEADER, nvidiaComplete, resolveNvidiaKey } from './nvidia.ts';

/**
 * POST /api/ai/variants — schema-framed exercise-variant generation
 * (docs/REQUIREMENTS_FIT_AUDIT.md §3.2, HANDOFF_LLM_VARIANT_GENERATION.md).
 *
 * The LLM is framed, never trusted: the server re-validates every variant
 * against the same schema and authored misconception vocabulary the client
 * guard uses, hardcodes reviewState to UNREVIEWED regardless of model output,
 * and persists nothing — drafts only become questions when the teacher
 * approves them through the existing question-bank flow.
 *
 * Backends, in order: the configured OpenAI API key; otherwise the teacher's
 * own ChatGPT session through the Codex App Server manager when enabled.
 */

const requestSchema = z.object({
  kcId: z.string().regex(/^K(0[1-9]|1[0-2])$/),
  count: z.number().int().min(1).max(3),
});

// Mirror of the client contract in src/services/agent/tools.ts:443-459 — the
// two must reject the same shapes, so the client guard never sees a surprise.
const variantChoiceSchema = z.object({
  id: z.string().min(1).max(20),
  label: z.string().min(1).max(200),
  misconceptionTag: z.string().max(40).optional(),
});

const variantSchema = z.object({
  prompt: z.string().min(8).max(500),
  choices: z.array(variantChoiceSchema).min(2).max(5),
  correctChoiceId: z.string().min(1).max(20),
  explanation: z.string().max(500).default(''),
  reviewState: z.literal('UNREVIEWED'),
});

const variantSetSchema = z.object({
  variants: z.array(variantSchema).min(1).max(3),
});

const MISCONCEPTION_IDS = new Set(HERO_MISCONCEPTIONS.map((definition) => definition.id));

const RATE_LIMIT_PER_MINUTE = 10;

export interface VariantsRouteOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl: typeof fetch;
  readonly requireTeacher: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => { id: string } | null | undefined;
  /**
   * ChatGPT-backed plain-text completion for a specific teacher (Codex App
   * Server). Returns null when the provider is disabled or the teacher has no
   * authenticated ChatGPT account — the route then reports 503 honestly.
   */
  readonly chatGptComplete?: (
    teacherId: string,
    prompt: string,
    signal: AbortSignal,
  ) => Promise<string | null>;
}

function buildPrompt(kcId: string, kcName: string, count: number): string {
  const catalog = HERO_MISCONCEPTIONS.map(
    (definition) => `- ${definition.id}: ${definition.nameVi}`,
  ).join('\n');
  return (
    'Bạn là trợ lý soạn câu hỏi Toán cho NekoPath, lát cắt phân số–tỉ số lớp 5–7.\n' +
    `Sinh đúng ${count} câu hỏi trắc nghiệm cho kiến thức ${kcId}: ${kcName}.\n\n` +
    'QUY TẮC NGHIÊM NGẶT (vi phạm sẽ bị từ chối):\n' +
    '1. Mỗi câu có 2–5 lựa chọn với id ngắn dạng "a","b","c",...\n' +
    '2. Đúng MỘT lựa chọn đúng; các lựa chọn khác là distractor.\n' +
    '3. Distractor CÓ THỂ gán "misconceptionTag" nhưng CHỈ từ danh mục sau:\n' +
    `${catalog}\n` +
    '4. KHÔNG bịa tag ngoài danh mục trên.\n' +
    '5. "correctChoiceId" phải trùng id của lựa chọn đúng.\n' +
    '6. "reviewState" LUÔN là "UNREVIEWED".\n' +
    '7. prompt dài 8–500 ký tự, tiếng Việt tự nhiên có dấu, đúng chương trình lớp 5–7.\n' +
    '8. explanation ngắn gọn, đúng toán học.\n\n' +
    'Trả về DUY NHẤT một khối JSON đúng dạng:\n' +
    '{"variants":[{"prompt":"...","choices":[{"id":"a","label":"..."},' +
    '{"id":"b","label":"...","misconceptionTag":"..."}],"correctChoiceId":"a",' +
    '"explanation":"...","reviewState":"UNREVIEWED"}]}\n' +
    'KHÔNG viết bất kỳ chữ nào ngoài JSON.'
  );
}

/** Extract the first JSON object from model text (models love ``` fences). */
function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```json/gi, '```');
  const fenced = /```([\s\S]*?)```/.exec(cleaned)?.[1] ?? cleaned;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export type VariantValidation =
  | { readonly ok: true; readonly variants: z.infer<typeof variantSetSchema>['variants'] }
  | { readonly ok: false; readonly reason: string };

/** Same grounding rules as the client guard; exported for direct tests. */
export function validateVariantSet(raw: unknown): VariantValidation {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    Array.isArray((raw as { variants?: unknown[] }).variants)
  ) {
    // The model's reviewState is opinion, not authority (trap #1 in the
    // handoff): hardcode UNREVIEWED before validating.
    raw = {
      variants: (raw as { variants: unknown[] }).variants.map((variant) =>
        variant !== null && typeof variant === 'object'
          ? { ...variant, reviewState: 'UNREVIEWED' }
          : variant,
      ),
    };
  }
  const parsed = variantSetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: `LLM_SCHEMA: ${parsed.error.issues[0]?.message ?? 'unknown'}` };
  }
  for (const variant of parsed.data.variants) {
    const ids = new Set<string>();
    for (const choice of variant.choices) {
      if (ids.has(choice.id)) return { ok: false, reason: 'LLM_CHOICE_ID_COLLISION' };
      ids.add(choice.id);
    }
    if (!ids.has(variant.correctChoiceId)) {
      return { ok: false, reason: 'LLM_CORRECT_CHOICE_MISMATCH' };
    }
    for (const choice of variant.choices) {
      if (
        choice.id !== variant.correctChoiceId &&
        choice.misconceptionTag &&
        !MISCONCEPTION_IDS.has(choice.misconceptionTag)
      ) {
        return { ok: false, reason: `LLM_UNKNOWN_MISCONCEPTION: ${choice.misconceptionTag}` };
      }
    }
  }
  return { ok: true, variants: parsed.data.variants };
}

export function registerVariantsRoutes(app: FastifyInstance, options: VariantsRouteOptions): void {
  const recentRequests = new Map<string, number[]>();

  const rateLimited = (teacherId: string): boolean => {
    const now = Date.now();
    const kept = (recentRequests.get(teacherId) ?? []).filter((at) => now - at < 60_000);
    if (kept.length >= RATE_LIMIT_PER_MINUTE) {
      recentRequests.set(teacherId, kept);
      return true;
    }
    kept.push(now);
    recentRequests.set(teacherId, kept);
    return false;
  };

  const callOpenAi = async (prompt: string): Promise<string | null> => {
    const response = await options.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`OPENAI_${response.status}`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    return body.choices?.[0]?.message?.content ?? null;
  };

  app.post('/api/ai/variants', async (request, reply) => {
    const teacher = options.requireTeacher(request, reply);
    if (!teacher) return;
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_VARIANT_REQUEST' });
    const { kcId, count } = parsed.data;

    const kc = HERO_GRAPH.nodes.find((node) => node.id === kcId);
    if (!kc) return reply.code(400).send({ error: 'UNKNOWN_KC' });
    if (rateLimited(teacher.id)) return reply.code(429).send({ error: 'RATE_LIMITED' });

    const prompt = buildPrompt(kcId, kc.name, count);
    // Backend order: server-configured OpenAI key, then the teacher's own
    // NVIDIA key riding this request (NekoCore profile: GLM via NIM — the key
    // is forwarded once, never stored), then the teacher's ChatGPT session.
    const nvidiaKey = resolveNvidiaKey(request.headers[NVIDIA_KEY_HEADER]);
    const rawNvidiaModel = (request.body as { nvidiaModel?: unknown }).nvidiaModel;
    const nvidiaModel =
      typeof rawNvidiaModel === 'string' && /^[\w./-]{1,100}$/.test(rawNvidiaModel)
        ? rawNvidiaModel
        : (process.env.NEKOPATH_NVIDIA_MODEL ?? 'z-ai/glm-5.2');
    let text: string | null = null;
    try {
      if (options.apiKey) {
        text = await callOpenAi(prompt);
      } else if (nvidiaKey) {
        text = await nvidiaComplete(options.fetchImpl, nvidiaKey, nvidiaModel, prompt);
      } else if (options.chatGptComplete) {
        text = await options.chatGptComplete(teacher.id, prompt, AbortSignal.timeout(60_000));
      }
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === 'TimeoutError';
      request.log.warn({ err: error }, 'variant generation provider failed');
      return reply
        .code(timeout ? 504 : 502)
        .send({ error: timeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE' });
    }
    if (text === null) return reply.code(503).send({ error: 'NO_VARIANT_PROVIDER' });

    const json = extractJson(text);
    if (json === null) {
      request.log.warn('variant generation returned non-JSON output');
      return reply.code(502).send({ error: 'LLM_OUTPUT_INVALID' });
    }
    const validated = validateVariantSet(json);
    if (!validated.ok) {
      request.log.warn({ reason: validated.reason }, 'variant generation failed grounding');
      return reply.code(502).send({ error: 'LLM_OUTPUT_INVALID' });
    }
    return { variants: validated.variants };
  });
}
