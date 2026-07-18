import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type {
  CodexAccountResult,
  CodexBrowserLogin,
  CodexCompletion,
  CodexModelInfo,
} from './codex-app-server.ts';

export interface CodexManagerPort {
  isEnabled(): boolean;
  status(accountId: string): Promise<CodexAccountResult>;
  models(accountId: string): Promise<readonly CodexModelInfo[]>;
  startLogin(accountId: string): Promise<CodexBrowserLogin>;
  complete(
    accountId: string,
    prompt: string,
    onDelta?: (delta: string) => void,
    signal?: AbortSignal,
    model?: string,
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
    });
    reply.raw.flushHeaders?.();
    reply.raw.once('close', abort);
    reply.raw.write(sseEvent('meta', { provider: 'chatgpt' }));
    const heartbeat = setInterval(() => {
      if (!controller.signal.aborted && !reply.raw.destroyed) reply.raw.write(': keepalive\n\n');
    }, 10_000);
    heartbeat.unref?.();
    try {
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
