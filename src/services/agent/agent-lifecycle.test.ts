import { describe, expect, it, vi } from 'vitest';
import { disposeAgentSessions, registerAgentSession } from './agent-lifecycle';
import type { AgentProvider } from './loop';
import { AgentSessionController } from './session-controller';

describe('agent account lifecycle', () => {
  it('aborts active work and disposes the provider before logout completes', async () => {
    const dispose = vi.fn();
    const provider: AgentProvider = {
      id: 'logout-race',
      label: 'logout-race',
      dispose,
      complete: (_messages, _tools, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    };
    const controller = new AgentSessionController({
      provider,
      tools: [],
      scope: { accountId: 'teacher-logout', role: 'teacher', classId: '7A' },
    });
    registerAgentSession('teacher-logout', controller);
    const running = controller.run('Đang xử lý').catch((error: unknown) => error);

    await disposeAgentSessions('teacher-logout');

    await expect(running).resolves.toBeDefined();
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(controller.run('Không được ghi muộn')).rejects.toThrow('đã đóng');
  });
});
