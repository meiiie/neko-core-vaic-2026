import type { NekoPathDb } from '../../storage/db';
import type { AgentSessionScope, AgentSessionSnapshot } from './session-controller';

function sessionId(scope: AgentSessionScope, providerId: string): string {
  return [scope.accountId, scope.role, scope.classId ?? '-', providerId]
    .map((part) => encodeURIComponent(part))
    .join(':');
}

export class AgentSessionStore {
  constructor(private readonly database: NekoPathDb) {}

  async save(snapshot: AgentSessionSnapshot, providerId: string): Promise<void> {
    await this.database.agentSessions.put({
      id: sessionId(snapshot.scope, providerId),
      accountId: snapshot.scope.accountId,
      role: snapshot.scope.role,
      classId: snapshot.scope.classId,
      providerId,
      payload: JSON.stringify(snapshot),
      updatedAt: new Date().toISOString(),
    });
  }

  async load(scope: AgentSessionScope, providerId: string): Promise<AgentSessionSnapshot | null> {
    const record = await this.database.agentSessions.get(sessionId(scope, providerId));
    if (!record) return null;
    if (
      record.accountId !== scope.accountId ||
      record.role !== scope.role ||
      record.classId !== scope.classId ||
      record.providerId !== providerId
    ) {
      return null;
    }
    try {
      const snapshot = JSON.parse(record.payload) as AgentSessionSnapshot;
      if (
        snapshot.scope.accountId !== scope.accountId ||
        snapshot.scope.role !== scope.role ||
        snapshot.scope.classId !== scope.classId
      ) {
        return null;
      }
      return snapshot;
    } catch {
      return null;
    }
  }

  async remove(scope: AgentSessionScope, providerId: string): Promise<void> {
    await this.database.agentSessions.delete(sessionId(scope, providerId));
  }

  async clearAccount(accountId: string): Promise<void> {
    await this.database.agentSessions.where('accountId').equals(accountId).delete();
  }
}
