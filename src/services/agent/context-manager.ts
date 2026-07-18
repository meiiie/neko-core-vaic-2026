import type { AgentChatMessage } from './loop';

const CAPSULE_PREFIX = 'NEKOPATH_CONTEXT_CAPSULE\n';

export interface ContextPolicy {
  readonly maxInputTokens: number;
  readonly compactAtRatio: number;
  readonly outputReserveTokens: number;
  readonly recentTurns: number;
}

export interface CapsuleEvidence {
  readonly toolName: string;
  readonly payload: string;
}

export interface ContextCapsule {
  readonly version: 1;
  readonly originalTask: string;
  readonly constraints: readonly string[];
  readonly evidence: readonly CapsuleEvidence[];
  readonly compactionCount: number;
}

export const DEFAULT_CONTEXT_POLICY: ContextPolicy = {
  maxInputTokens: 4_096,
  compactAtRatio: 0.72,
  outputReserveTokens: 512,
  recentTurns: 3,
};

export function estimateTokens(value: string): number {
  // Conservative language-agnostic approximation. Observed provider usage,
  // when available, can tune policy later; turn count is never consulted.
  return Math.max(1, Math.ceil(new TextEncoder().encode(value).byteLength / 3.2));
}

export function estimateMessagesTokens(messages: readonly AgentChatMessage[]): number {
  return messages.reduce((total, message) => total + 4 + estimateTokens(message.content), 0);
}

export function parseCapsule(message: AgentChatMessage | undefined): ContextCapsule | null {
  if (!message?.content.startsWith(CAPSULE_PREFIX)) return null;
  try {
    return JSON.parse(message.content.slice(CAPSULE_PREFIX.length)) as ContextCapsule;
  } catch {
    return null;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function recentTail(messages: readonly AgentChatMessage[], recentTurns: number): AgentChatMessage[] {
  const userIndexes = messages.flatMap((message, index) => (message.role === 'user' ? [index] : []));
  const start = userIndexes[Math.max(0, userIndexes.length - Math.max(1, recentTurns))];
  return start === undefined ? [] : messages.slice(start);
}

export class ContextManager {
  private count = 0;
  private capsule: ContextCapsule | null = null;

  constructor(private readonly policy: ContextPolicy) {}

  get compactionCount(): number {
    return this.count;
  }

  get currentCapsule(): ContextCapsule | null {
    return this.capsule;
  }

  compactIfNeeded(
    messages: readonly AgentChatMessage[],
    originalTask: string,
    constraints: readonly string[],
  ): AgentChatMessage[] {
    const threshold = Math.min(
      Math.floor(this.policy.maxInputTokens * this.policy.compactAtRatio),
      this.policy.maxInputTokens - this.policy.outputReserveTokens,
    );
    if (estimateMessagesTokens(messages) <= threshold) return [...messages];

    const previous = messages.map(parseCapsule).find((value) => value !== null) ?? this.capsule;
    const newEvidence = messages.flatMap((message) =>
      message.role === 'tool' && message.toolName
        ? [{ toolName: message.toolName, payload: message.content }]
        : [],
    );
    const evidenceByKey = new Map<string, CapsuleEvidence>();
    for (const item of [...(previous?.evidence ?? []), ...newEvidence]) {
      evidenceByKey.set(`${item.toolName}:${item.payload}`, item);
    }
    const evidence = [...evidenceByKey.values()].slice(-12);
    this.count = (previous?.compactionCount ?? this.count) + 1;
    this.capsule = {
      version: 1,
      originalTask: previous?.originalTask || originalTask,
      constraints: unique([...(previous?.constraints ?? []), ...constraints]).slice(-12),
      evidence,
      compactionCount: this.count,
    };

    const system = messages.find((message) => message.role === 'system' && !parseCapsule(message));
    const tail = recentTail(
      messages.filter((message) => !parseCapsule(message) && message !== system),
      this.policy.recentTurns,
    );
    const compacted: AgentChatMessage[] = [
      ...(system ? [system] : []),
      { role: 'system', content: `${CAPSULE_PREFIX}${JSON.stringify(this.capsule)}` },
      ...tail,
    ];
    return compacted;
  }
}
