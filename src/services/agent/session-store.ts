import type { NekoPathDb } from '../../storage/db';
import type { AgentSessionScope, AgentSessionSnapshot } from './session-controller';
import { z } from 'zod';

const MAX_SESSION_PAYLOAD_LENGTH = 512_000;

function isBoundedJson(value: unknown): boolean {
  try {
    return JSON.stringify(value).length <= 20_000;
  } catch {
    return false;
  }
}

const sessionScopeSchema = z
  .object({
    accountId: z.string().min(1).max(256),
    role: z.literal('teacher'),
    classId: z.string().max(256).nullable(),
  })
  .strict();

const messageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().max(100_000),
    toolName: z.string().max(120).optional(),
    toolCallId: z.string().max(256).optional(),
    toolArgs: z
      .record(z.string().max(120), z.unknown())
      .refine(isBoundedJson, 'tool arguments are too large')
      .optional(),
  })
  .strict();

const capsuleSchema = z
  .object({
    version: z.literal(1),
    originalTask: z.string().max(20_000),
    constraints: z.array(z.string().max(8_000)).max(12),
    evidence: z
      .array(
        z
          .object({
            toolName: z.string().min(1).max(120),
            payload: z.string().max(100_000),
          })
          .strict(),
      )
      .max(12),
    compactionCount: z.number().int().nonnegative().max(1_000_000),
  })
  .strict();

const usageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    outputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    cachedInputTokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();

const sessionSnapshotSchema = z
  .object({
    scope: sessionScopeSchema,
    messages: z.array(messageSchema).min(1).max(200),
    capsule: capsuleSchema.nullable(),
    compactionCount: z.number().int().nonnegative().max(1_000_000),
    turnCount: z.number().int().nonnegative().max(1_000_000),
    usage: usageSchema,
  })
  .strict();

function sessionId(scope: AgentSessionScope, providerId: string): string {
  return [scope.accountId, scope.role, scope.classId ?? '-', providerId]
    .map((part) => encodeURIComponent(part))
    .join(':');
}

export class AgentSessionStore {
  constructor(private readonly database: NekoPathDb) {}

  async save(snapshot: AgentSessionSnapshot, providerId: string): Promise<void> {
    const validated = sessionSnapshotSchema.parse(snapshot);
    const payload = JSON.stringify(validated);
    if (payload.length > MAX_SESSION_PAYLOAD_LENGTH) {
      throw new Error('Agent session payload is too large.');
    }
    await this.database.agentSessions.put({
      id: sessionId(snapshot.scope, providerId),
      accountId: snapshot.scope.accountId,
      role: snapshot.scope.role,
      classId: snapshot.scope.classId,
      providerId,
      payload,
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
    if (record.payload.length > MAX_SESSION_PAYLOAD_LENGTH) return null;
    try {
      const parsed = sessionSnapshotSchema.safeParse(JSON.parse(record.payload));
      if (!parsed.success) return null;
      const snapshot = parsed.data as AgentSessionSnapshot;
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
