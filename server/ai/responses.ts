import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';
import { z } from 'zod';

const messageInputSchema = z
  .object({
    role: z.enum(['system', 'developer', 'user', 'assistant']),
    content: z.string().min(1).max(30_000),
  })
  .strict();

const functionCallInputSchema = z
  .object({
    type: z.literal('function_call'),
    call_id: z.string().min(1).max(200),
    name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    arguments: z.string().max(20_000),
  })
  .strict();

const functionOutputInputSchema = z
  .object({
    type: z.literal('function_call_output'),
    call_id: z.string().min(1).max(200),
    output: z.string().max(30_000),
  })
  .strict();

const toolSchema = z
  .object({
    type: z.literal('function'),
    name: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    description: z.string().min(1).max(1_000),
    parameters: z.record(z.string(), z.unknown()),
    strict: z.literal(true),
  })
  .strict();

const requestSchema = z
  .object({
    input: z
      .array(z.union([messageInputSchema, functionCallInputSchema, functionOutputInputSchema]))
      .min(1)
      .max(96),
    tools: z.array(toolSchema).max(16),
  })
  .strict();

export interface ResponsesRouteOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl: typeof fetch;
  readonly requireTeacher: (request: FastifyRequest, reply: FastifyReply) => unknown;
  readonly chatGptAvailable?: () => boolean;
}

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function callOpenAi(
  options: ResponsesRouteOptions,
  body: unknown,
): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await options.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!retryable(response.status) || attempt === 1) return response;
  }
  return response!;
}

export function registerResponsesRoutes(
  app: FastifyInstance,
  options: ResponsesRouteOptions,
): void {
  app.get('/api/ai/providers', (request, reply) => {
    if (!options.requireTeacher(request, reply)) return;
    return {
      providers: [
        { id: 'rule', available: true, location: 'browser' },
        { id: 'web', available: true, location: 'browser', requiresPreload: true },
        { id: 'openai', available: Boolean(options.apiKey), location: 'server' },
        {
          id: 'chatgpt',
          available: options.chatGptAvailable?.() ?? false,
          location: 'local-server',
        },
      ],
    };
  });

  app.post('/api/ai/responses', async (request, reply) => {
    if (!options.requireTeacher(request, reply)) return;
    if (!options.apiKey) return reply.code(503).send({ error: 'OPENAI_NOT_CONFIGURED' });
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_AI_REQUEST' });

    let upstream: Response;
    try {
      upstream = await callOpenAi(options, {
        model: options.model,
        input: parsed.data.input,
        tools: parsed.data.tools,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        store: false,
        stream: true,
        max_output_tokens: 512,
      });
    } catch (error) {
      const code = error instanceof DOMException && error.name === 'TimeoutError' ? 504 : 502;
      return reply.code(code).send({ error: code === 504 ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE' });
    }

    if (!upstream.ok || !upstream.body) {
      const error =
        upstream.status === 401 || upstream.status === 403
          ? 'PROVIDER_AUTH'
          : upstream.status === 429
            ? 'PROVIDER_RATE_LIMIT'
            : 'PROVIDER_ERROR';
      return reply.code(upstream.status === 429 ? 503 : 502).send({ error });
    }

    reply.type('text/event-stream; charset=utf-8');
    reply.header('cache-control', 'no-store');
    return reply.send(
      Readable.fromWeb(upstream.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
    );
  });
}
