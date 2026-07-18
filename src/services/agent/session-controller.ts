import {
  AGENT_SYSTEM_PROMPT,
  runAgentTurn,
  type AgentChatMessage,
  type AgentDeltaHook,
  type AgentProvider,
  type AgentTraceEvent,
  type AgentUsage,
} from './loop';
import {
  ContextManager,
  DEFAULT_CONTEXT_POLICY,
  type ContextCapsule,
  type ContextPolicy,
} from './context-manager';
import type { AgentTool } from './tools';

export interface AgentSessionScope {
  readonly accountId: string;
  readonly role: 'teacher';
  readonly classId: string | null;
}

export interface AgentSessionSnapshot {
  readonly scope: AgentSessionScope;
  readonly messages: readonly AgentChatMessage[];
  readonly capsule: ContextCapsule | null;
  readonly compactionCount: number;
  readonly turnCount: number;
  readonly usage: AgentUsage;
}

export interface AgentSessionRunOptions {
  readonly signal?: AbortSignal;
  readonly onTrace?: (event: AgentTraceEvent) => void;
  readonly onDelta?: AgentDeltaHook;
}

export class AgentSessionController {
  private messages: AgentChatMessage[] = [{ role: 'system', content: AGENT_SYSTEM_PROMPT }];
  private readonly context: ContextManager;
  private originalTask = '';
  private constraints: string[] = [];
  private turns = 0;
  private generation = 0;
  private activeAbort: AbortController | null = null;
  private disposed = false;
  private usage: AgentUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };

  constructor(
    private readonly options: {
      readonly provider: AgentProvider;
      readonly tools: readonly AgentTool[];
      readonly scope: AgentSessionScope;
      readonly contextPolicy?: Partial<ContextPolicy>;
    },
  ) {
    const maxInputTokens = options.contextPolicy?.maxInputTokens ?? options.provider.contextWindow;
    this.context = new ContextManager({
      ...DEFAULT_CONTEXT_POLICY,
      ...(maxInputTokens ? { maxInputTokens } : {}),
      ...options.contextPolicy,
    });
  }

  async run(
    question: string,
    runOptions: AgentSessionRunOptions = {},
  ): Promise<{
    text: string;
    displayUsage?: AgentUsage;
    modelId?: string;
    fallback: boolean;
  }> {
    if (this.disposed) throw new Error('Agent session đã đóng.');
    if (this.activeAbort) throw new Error('Agent session đang xử lý một lượt khác.');
    const trimmed = question.trim();
    if (!trimmed) throw new Error('Câu hỏi trống.');
    if (!this.originalTask) this.originalTask = trimmed;
    if (/(^|\s)(chỉ|không|đừng|luôn|phải)|deterministic|bằng chứng/i.test(trimmed)) {
      this.constraints = [...new Set([...this.constraints, trimmed])];
    }

    this.messages = this.context.compactIfNeeded(
      this.messages,
      this.originalTask,
      this.constraints,
    );
    const before = [...this.messages];
    const controller = new AbortController();
    const generation = ++this.generation;
    this.activeAbort = controller;
    const abortFromParent = () => controller.abort(runOptions.signal?.reason ?? 'aborted');
    runOptions.signal?.addEventListener('abort', abortFromParent, { once: true });
    try {
      const result = await runAgentTurn(
        trimmed,
        this.options.provider,
        this.options.tools,
        this.messages,
        runOptions.onTrace,
        controller.signal,
        runOptions.onDelta,
      );
      if (controller.signal.aborted || generation !== this.generation || this.disposed) {
        throw controller.signal.reason ?? new DOMException('Aborted', 'AbortError');
      }
      this.messages = this.context.compactIfNeeded(
        result.messages,
        this.originalTask,
        this.constraints,
      );
      this.turns += 1;
      this.usage = {
        inputTokens: this.usage.inputTokens + result.usage.inputTokens,
        outputTokens: this.usage.outputTokens + result.usage.outputTokens,
        cachedInputTokens:
          (this.usage.cachedInputTokens ?? 0) + (result.usage.cachedInputTokens ?? 0),
      };
      return {
        text: result.text,
        displayUsage: result.displayUsage,
        modelId: result.modelId,
        fallback: result.fallback,
      };
    } catch (error) {
      this.messages = before;
      throw error;
    } finally {
      runOptions.signal?.removeEventListener('abort', abortFromParent);
      if (this.activeAbort === controller) this.activeAbort = null;
    }
  }

  abort(reason: unknown = 'aborted'): void {
    this.generation += 1;
    this.activeAbort?.abort(reason);
  }

  reset(): void {
    if (this.disposed) throw new Error('Agent session đã đóng.');
    this.abort('reset');
    this.messages = [{ role: 'system', content: AGENT_SYSTEM_PROMPT }];
    this.originalTask = '';
    this.constraints = [];
    this.turns = 0;
    this.usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
    this.context.reset();
  }

  snapshot(): AgentSessionSnapshot {
    return {
      scope: this.options.scope,
      messages: [...this.messages],
      capsule: this.context.currentCapsule,
      compactionCount: this.context.compactionCount,
      turnCount: this.turns,
      usage: this.usage,
    };
  }

  restore(snapshot: AgentSessionSnapshot): void {
    if (this.activeAbort) throw new Error('Không thể restore khi một lượt đang chạy.');
    if (
      snapshot.scope.accountId !== this.options.scope.accountId ||
      snapshot.scope.role !== this.options.scope.role ||
      snapshot.scope.classId !== this.options.scope.classId
    ) {
      throw new Error('Session snapshot không khớp account/class scope.');
    }
    const system = snapshot.messages.find((message) => message.role === 'system');
    if (!system || system.content !== AGENT_SYSTEM_PROMPT) {
      throw new Error('Session snapshot không còn system contract hợp lệ.');
    }
    this.messages = [...snapshot.messages];
    this.originalTask =
      snapshot.capsule?.originalTask ??
      snapshot.messages.find((message) => message.role === 'user')?.content ??
      '';
    this.constraints = [...(snapshot.capsule?.constraints ?? [])];
    this.turns = snapshot.turnCount;
    this.usage = snapshot.usage;
    this.context.restore(snapshot.capsule);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.abort('disposed');
    await this.options.provider.dispose?.();
    this.messages = [];
  }
}
