import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

interface RpcMessage {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: { readonly code?: number; readonly message?: string };
}

export interface CodexTransport {
  start(onMessage: (message: unknown) => void, onError?: (error: Error) => void): void;
  send(message: unknown): void;
  stop(): void;
}

export interface NodeCodexTransportOptions {
  readonly codexHome: string;
  readonly codexBin?: string;
}

function childEnvironment(codexHome: string): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'Path',
    'PATHEXT',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'LANG',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'NO_PROXY',
  ];
  const env: NodeJS.ProcessEnv = { CODEX_HOME: codexHome };
  for (const name of allowed) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  return env;
}

export class NodeCodexTransport implements CodexTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly options: NodeCodexTransportOptions;

  constructor(options: NodeCodexTransportOptions) {
    this.options = options;
  }

  start(onMessage: (message: unknown) => void, onError?: (error: Error) => void): void {
    if (this.child) return;
    const bundledScript = resolve(
      process.cwd(),
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js',
    );
    const command = this.options.codexBin ?? process.execPath;
    const args = this.options.codexBin
      ? ['app-server', '--listen', 'stdio://']
      : [bundledScript, 'app-server', '--listen', 'stdio://'];
    if (!this.options.codexBin && !existsSync(bundledScript)) {
      throw new Error('Không tìm thấy Codex App Server đã pin trong node_modules.');
    }
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: childEnvironment(this.options.codexHome),
      windowsHide: true,
    });
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      try {
        onMessage(JSON.parse(line));
      } catch {
        // Ignore non-protocol stdout; app-server JSON-RPC remains line based.
      }
    });
    child.on('error', (error) => onError?.(error));
    child.on('exit', (code) => {
      this.child = null;
      if (code && code !== 0) onError?.(new Error(`Codex App Server exited (${code}).`));
    });
  }

  send(message: unknown): void {
    if (!this.child?.stdin.writable) throw new Error('Codex App Server chưa chạy.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    if (!child) return;
    child.stdin.end();
    child.kill();
  }
}

export interface CodexAccountResult {
  readonly account: null | {
    readonly type: string;
    readonly email?: string | null;
    readonly planType?: string | null;
  };
  readonly requiresOpenaiAuth: boolean;
}

export interface CodexBrowserLogin {
  readonly loginId: string;
  readonly authUrl: string;
}

export interface CodexUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
}

export interface CodexCompletion {
  readonly content: string;
  readonly modelId: string;
  readonly usage?: CodexUsage;
}

interface CodexModel {
  readonly id: string;
  readonly model: string;
  readonly displayName?: string;
  readonly hidden?: boolean;
  readonly isDefault?: boolean;
}

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

interface PendingTurn {
  readonly resolve: (value: { status: string; error?: string }) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const DEVELOPER_INSTRUCTIONS =
  'Bạn là NekoPath, trợ lý quyết định cho giáo viên. Chỉ diễn giải bằng chứng deterministic ' +
  'được gửi trong nội dung người dùng. Không đọc tệp, không chạy lệnh, không sửa dữ liệu, không ' +
  'dùng web và không bịa số liệu. Trả lời tiếng Việt ngắn gọn; nếu thiếu bằng chứng, nói rõ.';

export class CodexAppServerClient {
  private nextId = 1;
  private initialized = false;
  private disposed = false;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly deltas = new Map<string, string[]>();
  private readonly deltaHooks = new Map<string, (delta: string) => void>();
  private readonly usageByTurn = new Map<string, CodexUsage>();
  private readonly completedTurns = new Map<string, { status: string; error?: string }>();
  private readonly completionWaiters = new Map<string, PendingTurn>();
  private readonly transport: CodexTransport;
  private readonly options: { readonly cwd: string; readonly model?: string };
  private selectedModel: string | null = null;

  constructor(
    transport: CodexTransport,
    options: { readonly cwd: string; readonly model?: string },
  ) {
    this.transport = transport;
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.transport.start(
      (message) => this.handle(message),
      (error) => this.failAll(error),
    );
    await this.request('initialize', {
      clientInfo: { name: 'nekopath', title: 'NekoPath', version: '0.2.0' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    });
    this.transport.send({ method: 'initialized', params: {} });
    this.initialized = true;
  }

  async account(): Promise<CodexAccountResult> {
    await this.initialize();
    return (await this.request('account/read', { refreshToken: false })) as CodexAccountResult;
  }

  async startBrowserLogin(): Promise<CodexBrowserLogin> {
    await this.initialize();
    const result = (await this.request('account/login/start', {
      type: 'chatgpt',
    })) as CodexBrowserLogin & { type?: string };
    if (!result.loginId || !result.authUrl) {
      throw new Error('Codex App Server không trả về browser OAuth URL hợp lệ.');
    }
    return {
      loginId: result.loginId,
      authUrl: result.authUrl,
    };
  }

  async complete(
    prompt: string,
    onDelta?: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<CodexCompletion> {
    await this.initialize();
    const model = await this.resolveModel();
    const thread = (await this.request('thread/start', {
      model,
      cwd: this.options.cwd,
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ephemeral: true,
      serviceName: 'nekopath',
      developerInstructions: DEVELOPER_INSTRUCTIONS,
    })) as { thread: { id: string } };
    const started = (await this.request('turn/start', {
      threadId: thread.thread.id,
      input: [{ type: 'text', text: prompt }],
      cwd: this.options.cwd,
      approvalPolicy: 'never',
      sandboxPolicy: {
        type: 'readOnly',
        access: {
          type: 'restricted',
          includePlatformDefaults: true,
          readableRoots: [this.options.cwd],
        },
      },
    })) as { turn: { id: string } };
    const turnId = started.turn.id;
    if (onDelta) {
      for (const delta of this.deltas.get(turnId) ?? []) onDelta(delta);
      this.deltaHooks.set(turnId, onDelta);
    }
    const completedPromise = this.waitForTurn(turnId);
    const abort = () => {
      void this.request('turn/interrupt', { threadId: thread.thread.id, turnId }, 5_000).catch(
        () => undefined,
      );
      this.rejectTurn(
        turnId,
        signal?.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'),
      );
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      const completed = await completedPromise;
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      if (completed.status !== 'completed') {
        throw new Error(completed.error ?? `Codex turn ${completed.status}.`);
      }
      return {
        content: (this.deltas.get(turnId) ?? []).join('').trim(),
        modelId: model,
        ...(this.usageByTurn.has(turnId) ? { usage: this.usageByTurn.get(turnId) } : {}),
      };
    } finally {
      signal?.removeEventListener('abort', abort);
      this.deltaHooks.delete(turnId);
      this.deltas.delete(turnId);
      this.usageByTurn.delete(turnId);
      this.completedTurns.delete(turnId);
    }
  }

  async logout(): Promise<void> {
    await this.initialize();
    await this.request('account/logout', undefined);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.failAll(new Error('Codex App Server đã đóng.'));
    this.deltas.clear();
    this.deltaHooks.clear();
    this.usageByTurn.clear();
    this.completedTurns.clear();
    this.transport.stop();
  }

  private request(method: string, params?: unknown, timeoutMs = 15_000): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error('Codex App Server đã đóng.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.transport.send({ method, id, ...(params === undefined ? {} : { params }) });
    });
  }

  private async resolveModel(): Promise<string> {
    if (this.selectedModel) return this.selectedModel;
    const models: CodexModel[] = [];
    let cursor: string | null | undefined;
    do {
      const page = (await this.request('model/list', {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      })) as { data?: CodexModel[]; nextCursor?: string | null };
      models.push(...(page.data ?? []));
      cursor = page.nextCursor;
    } while (cursor);
    const visible = models.filter((model) => !model.hidden);
    if (visible.length === 0) throw new Error('Tài khoản ChatGPT không có model khả dụng.');

    if (this.options.model) {
      const explicit = visible.find(
        (model) => model.model === this.options.model || model.id === this.options.model,
      );
      if (!explicit) {
        throw new Error(`Model cấu hình không có trong catalog: ${this.options.model}`);
      }
      this.selectedModel = explicit.model;
      return this.selectedModel;
    }

    const selected =
      visible.find((model) => model.model === 'gpt-5.5' || model.id === 'gpt-5.5') ??
      visible.find((model) => model.isDefault) ??
      visible[0];
    this.selectedModel = selected.model;
    return this.selectedModel;
  }

  private waitForTurn(turnId: string): Promise<{ status: string; error?: string }> {
    const completed = this.completedTurns.get(turnId);
    if (completed) return Promise.resolve(completed);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.completionWaiters.delete(turnId);
        reject(new Error('Codex turn timeout.'));
      }, 120_000);
      this.completionWaiters.set(turnId, { resolve, reject, timeout });
    });
  }

  private rejectTurn(turnId: string, error: Error): void {
    const pending = this.completionWaiters.get(turnId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.completionWaiters.delete(turnId);
    pending.reject(error);
  }

  private handle(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const message = raw as RpcMessage;
    if (typeof message.id === 'number' && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'Codex RPC error.'));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === 'item/agentMessage/delta') {
      const params = message.params as { turnId?: string; delta?: string };
      if (!params.turnId || !params.delta) return;
      const values = this.deltas.get(params.turnId) ?? [];
      values.push(params.delta);
      this.deltas.set(params.turnId, values);
      this.deltaHooks.get(params.turnId)?.(params.delta);
      return;
    }
    if (message.method === 'thread/tokenUsage/updated') {
      const params = message.params as {
        turnId?: string;
        tokenUsage?: {
          last?: {
            inputTokens?: number;
            outputTokens?: number;
            cachedInputTokens?: number;
          };
        };
      };
      const last = params.tokenUsage?.last;
      if (
        !params.turnId ||
        !last ||
        !Number.isFinite(last.inputTokens) ||
        !Number.isFinite(last.outputTokens)
      ) {
        return;
      }
      this.usageByTurn.set(params.turnId, {
        inputTokens: last.inputTokens as number,
        outputTokens: last.outputTokens as number,
        ...(Number.isFinite(last.cachedInputTokens)
          ? { cachedInputTokens: last.cachedInputTokens as number }
          : {}),
      });
      return;
    }
    if (message.method === 'turn/completed') {
      const params = message.params as {
        turn?: { id?: string; status?: string; error?: { message?: string } | null };
      };
      const turnId = params.turn?.id;
      if (!turnId) return;
      const completed = {
        status: params.turn?.status ?? 'failed',
        ...(params.turn?.error?.message ? { error: params.turn.error.message } : {}),
      };
      this.completedTurns.set(turnId, completed);
      const pending = this.completionWaiters.get(turnId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.completionWaiters.delete(turnId);
        pending.resolve(completed);
      }
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
    for (const pending of this.completionWaiters.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.completionWaiters.clear();
  }
}
