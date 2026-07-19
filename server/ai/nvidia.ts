import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { z } from 'zod';

/**
 * NVIDIA NIM relay (NekoCore provider profile: integrate.api.nvidia.com/v1,
 * OpenAI-compatible, GLM family). The TEACHER owns the key: it arrives as a
 * per-request header from their browser, is forwarded to NVIDIA over TLS, and
 * is never persisted, logged, or echoed. The relay exists because the browser
 * cannot call NVIDIA directly (CSP `connect-src 'self'` plus CORS).
 */

export const NVIDIA_KEY_HEADER = 'x-nvidia-api-key';
const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const messageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().max(30_000).nullable().default(''),
    name: z.string().max(64).optional(),
    tool_call_id: z.string().max(200).optional(),
    tool_calls: z.array(z.unknown()).max(16).optional(),
  })
  .passthrough();

const requestSchema = z
  .object({
    model: z.string().regex(/^[\w./-]{1,100}$/),
    messages: z.array(messageSchema).min(1).max(96),
    stream: z.boolean().default(false),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().min(1).max(4_096).optional(),
    tools: z.array(z.unknown()).max(16).optional(),
  })
  .strict();

export interface NvidiaRouteOptions {
  readonly fetchImpl: typeof fetch;
  readonly requireTeacher: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => { id: string } | null | undefined;
}

/**
 * Key resolution: a key the teacher saved in their own browser wins; otherwise
 * the deployment-wide key from the VM environment (never committed — lives in
 * the gitignored ops/.env on the server) serves every teacher out of the box.
 */
export function resolveNvidiaKey(headerValue: unknown): string {
  const fromHeader = String(headerValue ?? '').trim();
  if (fromHeader && fromHeader.length <= 300) return fromHeader;
  return (process.env.NVIDIA_API_KEY ?? '').trim();
}

export function registerNvidiaRoutes(app: FastifyInstance, options: NvidiaRouteOptions): void {
  app.post('/api/ai/nvidia/chat/completions', async (request, reply) => {
    if (!options.requireTeacher(request, reply)) return;
    const key = resolveNvidiaKey(request.headers[NVIDIA_KEY_HEADER]);
    if (!key || key.length > 300) {
      return reply.code(401).send({ error: 'NVIDIA_KEY_REQUIRED' });
    }
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_AI_REQUEST' });

    let upstream: Response;
    try {
      upstream = await options.fetchImpl(NVIDIA_CHAT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === 'TimeoutError';
      return reply
        .code(timeout ? 504 : 502)
        .send({ error: timeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE' });
    }

    if (!upstream.ok || !upstream.body) {
      const error =
        upstream.status === 401 || upstream.status === 403
          ? 'PROVIDER_AUTH'
          : upstream.status === 429
            ? 'PROVIDER_RATE_LIMIT'
            : upstream.status === 404
              ? 'PROVIDER_MODEL_NOT_FOUND'
              : 'PROVIDER_ERROR';
      return reply.code(upstream.status === 429 ? 503 : 502).send({ error });
    }

    reply.type(
      parsed.data.stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8',
    );
    reply.header('cache-control', 'no-store');
    return reply.send(
      Readable.fromWeb(upstream.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
    );
  });
}

/** Non-stream single completion used by the variants backend. */
export async function nvidiaComplete(
  fetchImpl: typeof fetch,
  key: string,
  model: string,
  prompt: string,
): Promise<string | null> {
  const response = await fetchImpl(NVIDIA_CHAT_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 1_600,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`NVIDIA_${response.status}`);
  const body = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  return body.choices?.[0]?.message?.content ?? null;
}
