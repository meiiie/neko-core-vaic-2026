import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type {
  CodexAccountResult,
  CodexBrowserLogin,
  CodexCompletion,
  CodexDynamicTool,
  CodexDynamicToolCall,
  CodexDynamicToolResult,
  CodexModelInfo,
} from './codex-app-server.ts';

export interface CodexManagerPort {
  isEnabled(): boolean;
  status(accountId: string): Promise<CodexAccountResult>;
  models(accountId: string): Promise<readonly CodexModelInfo[]>;
  startLogin(accountId: string): Promise<CodexBrowserLogin>;
  completeLogin(accountId: string, search: string): Promise<void>;
  complete(
    accountId: string,
    prompt: string,
    onDelta?: (delta: string) => void,
    signal?: AbortSignal,
    model?: string,
    tools?: readonly CodexDynamicTool[],
    executeTool?: (call: CodexDynamicToolCall) => Promise<CodexDynamicToolResult>,
  ): Promise<CodexCompletion>;
  logout(accountId: string): Promise<void>;
  disposeAll(): void;
}

interface TeacherIdentity {
  readonly id: string;
}

const completionSchema = z
  .object({
    prompt: z.string().min(1).max(30_000),
    model: z.string().min(1).max(120).optional(),
    tools: z
      .array(
        z
          .object({
            name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
            description: z.string().min(1).max(500),
            inputSchema: z.record(z.string(), z.unknown()),
          })
          .strict(),
      )
      .max(16)
      .default([]),
  })
  .strict();

const toolResultSchema = z
  .object({
    requestId: z.string().uuid(),
    result: z
      .object({
        ok: z.boolean(),
        data: z.unknown().optional(),
        error: z.string().max(500).optional(),
        errorCode: z.string().max(80).optional(),
      })
      .strict(),
  })
  .strict();

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function registerCodexRoutes(
  app: FastifyInstance,
  manager: CodexManagerPort,
  requireTeacher: (request: FastifyRequest, reply: FastifyReply) => TeacherIdentity | null,
): void {
  const pendingToolResults = new Map<
    string,
    {
      readonly teacherId: string;
      readonly resolve: (result: CodexDynamicToolResult) => void;
      readonly reject: (error: Error) => void;
      readonly timeout: ReturnType<typeof setTimeout>;
    }
  >();

  app.get('/api/ai/chatgpt/status', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    if (!manager.isEnabled()) return { available: false, authenticated: false };
    try {
      const state = await manager.status(teacher.id);
      const authenticated = state.account?.type === 'chatgpt';
      const models = authenticated ? await manager.models(teacher.id) : [];
      return {
        available: true,
        authenticated,
        planType: state.account?.planType ?? null,
        models,
        defaultModel: models.find((model) => model.isDefault)?.model ?? models[0]?.model ?? null,
      };
    } catch {
      return reply.code(503).send({ error: 'CODEX_APP_SERVER_UNAVAILABLE' });
    }
  });

  app.post('/api/ai/chatgpt/login', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    if (!manager.isEnabled()) return reply.code(503).send({ error: 'CHATGPT_NOT_ENABLED' });
    try {
      return await manager.startLogin(teacher.id);
    } catch {
      return reply.code(503).send({ error: 'CODEX_APP_SERVER_UNAVAILABLE' });
    }
  });

  // The App Server's OAuth callback listener lives on 127.0.0.1:1455 inside
  // this container, unreachable from any real browser. The teacher pastes the
  // localhost URL their browser dead-ended on; we forward code+state to the
  // local listener, which finishes the pending login. Only the query string
  // travels — and only to the loopback listener, never to a remote host.
  app.post('/api/ai/chatgpt/login/complete', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    if (!manager.isEnabled()) return reply.code(503).send({ error: 'CHATGPT_NOT_ENABLED' });
    const parsed = z
      .object({ callbackUrl: z.string().min(20).max(4_000) })
      .strict()
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_CALLBACK' });
    let url: URL;
    try {
      url = new URL(parsed.data.callbackUrl);
    } catch {
      return reply.code(400).send({ error: 'INVALID_CALLBACK' });
    }
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '1455' ||
      url.pathname !== '/auth/callback' ||
      !url.searchParams.get('code') ||
      !url.searchParams.get('state')
    ) {
      return reply.code(400).send({ error: 'INVALID_CALLBACK' });
    }
    try {
      await manager.completeLogin(teacher.id, url.search);
    } catch {
      return reply.code(502).send({ error: 'LOGIN_CALLBACK_REJECTED' });
    }
    const state = await manager.status(teacher.id).catch(() => null);
    return { authenticated: state?.account?.type === 'chatgpt' };
  });

  app.post('/api/ai/chatgpt/tool-result', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    const parsed = toolResultSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_TOOL_RESULT' });
    const pending = pendingToolResults.get(parsed.data.requestId);
    if (!pending || pending.teacherId !== teacher.id) {
      return reply.code(404).send({ error: 'TOOL_REQUEST_NOT_FOUND' });
    }
    pendingToolResults.delete(parsed.data.requestId);
    clearTimeout(pending.timeout);
    pending.resolve(parsed.data.result);
    return { ok: true };
  });

  app.post('/api/ai/chatgpt/complete', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    if (!manager.isEnabled()) return reply.code(503).send({ error: 'CHATGPT_NOT_ENABLED' });
    const parsed = completionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_AI_REQUEST' });
    const state = await manager.status(teacher.id).catch(() => null);
    if (state?.account?.type !== 'chatgpt') {
      return reply.code(401).send({ error: 'CHATGPT_LOGIN_REQUIRED' });
    }
    const controller = new AbortController();
    const activeToolRequests = new Set<string>();
    let finished = false;
    const abort = () => {
      if (!finished) controller.abort(new DOMException('Client disconnected', 'AbortError'));
    };
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Origin-Agent-Cluster': '?1',
      'Permissions-Policy': 'tools=(self)',
    });
    reply.raw.flushHeaders?.();
    reply.raw.once('close', abort);
    reply.raw.write(sseEvent('meta', { provider: 'chatgpt' }));
    const heartbeat = setInterval(() => {
      if (!controller.signal.aborted && !reply.raw.destroyed) reply.raw.write(': keepalive\n\n');
    }, 10_000);
    heartbeat.unref?.();
    try {
      const executeTool = (call: CodexDynamicToolCall): Promise<CodexDynamicToolResult> => {
        if (controller.signal.aborted) {
          return Promise.reject(new DOMException('Client disconnected', 'AbortError'));
        }
        const requestId = randomUUID();
        activeToolRequests.add(requestId);
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingToolResults.delete(requestId);
            activeToolRequests.delete(requestId);
            reject(new Error(`Tool ${call.name} không nhận được kết quả từ trình duyệt.`));
          }, 30_000);
          timeout.unref?.();
          pendingToolResults.set(requestId, {
            teacherId: teacher.id,
            resolve,
            reject,
            timeout,
          });
          reply.raw.write(
            sseEvent('tool_call', {
              requestId,
              callId: call.id,
              name: call.name,
              args: call.args,
            }),
          );
        });
      };
      const result = await manager.complete(
        teacher.id,
        parsed.data.prompt,
        (delta) => {
          if (!controller.signal.aborted && !reply.raw.destroyed) {
            reply.raw.write(sseEvent('delta', { text: delta }));
          }
        },
        controller.signal,
        parsed.data.model,
        parsed.data.tools,
        executeTool,
      );
      if (result.usage) reply.raw.write(sseEvent('usage', result.usage));
      reply.raw.write(sseEvent('done', { content: result.content, modelId: result.modelId }));
    } catch (error) {
      if (!controller.signal.aborted && !reply.raw.destroyed) {
        reply.raw.write(
          sseEvent('error', {
            code: 'CHATGPT_COMPLETION_FAILED',
            message: error instanceof Error ? error.message.slice(0, 240) : 'Completion failed',
          }),
        );
      }
    } finally {
      for (const requestId of activeToolRequests) {
        const pending = pendingToolResults.get(requestId);
        if (!pending) continue;
        pendingToolResults.delete(requestId);
        clearTimeout(pending.timeout);
        pending.reject(new Error('Lượt ChatGPT đã kết thúc trước khi công cụ hoàn tất.'));
      }
      clearInterval(heartbeat);
      finished = true;
      reply.raw.removeListener('close', abort);
      if (!reply.raw.destroyed) reply.raw.end();
    }
    return reply;
  });

  app.post('/api/ai/chatgpt/logout', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    await manager.logout(teacher.id).catch(() => undefined);
    return { ok: true };
  });
}
