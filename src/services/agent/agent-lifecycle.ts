import type { AgentSessionController } from './session-controller';

const sessions = new Map<string, Set<AgentSessionController>>();

export function registerAgentSession(
  accountId: string,
  controller: AgentSessionController,
): () => void {
  const accountSessions = sessions.get(accountId) ?? new Set<AgentSessionController>();
  accountSessions.add(controller);
  sessions.set(accountId, accountSessions);
  return () => {
    accountSessions.delete(controller);
    if (accountSessions.size === 0) sessions.delete(accountId);
  };
}

export async function disposeAgentSessions(accountId: string): Promise<void> {
  const accountSessions = sessions.get(accountId);
  if (!accountSessions) return;
  sessions.delete(accountId);
  for (const controller of accountSessions) controller.abort('logout');
  await Promise.allSettled([...accountSessions].map((controller) => controller.dispose()));
}
