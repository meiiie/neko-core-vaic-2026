import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CodexAccountResult, CodexDeviceLogin } from './codex-app-server.ts';

export interface CodexManagerPort {
  isEnabled(): boolean;
  status(accountId: string): Promise<CodexAccountResult>;
  startLogin(accountId: string): Promise<CodexDeviceLogin>;
  complete(accountId: string, prompt: string, signal?: AbortSignal): Promise<string>;
  logout(accountId: string): Promise<void>;
  disposeAll(): void;
}

interface TeacherIdentity {
  readonly id: string;
}

const completionSchema = z.object({ prompt: z.string().min(1).max(30_000) }).strict();

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
      return {
        available: true,
        authenticated: state.account?.type === 'chatgpt',
        planType: state.account?.planType ?? null,
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
    const abort = () => controller.abort(new DOMException('Client disconnected', 'AbortError'));
    reply.raw.once('close', abort);
    try {
      const content = await manager.complete(teacher.id, parsed.data.prompt, controller.signal);
      return { content };
    } catch {
      return reply.code(502).send({ error: 'CHATGPT_COMPLETION_FAILED' });
    } finally {
      reply.raw.removeListener('close', abort);
    }
  });

  app.post('/api/ai/chatgpt/logout', async (request, reply) => {
    const teacher = requireTeacher(request, reply);
    if (!teacher) return;
    await manager.logout(teacher.id).catch(() => undefined);
    return { ok: true };
  });
}
