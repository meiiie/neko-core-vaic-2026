// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CodexAppServerClient, type CodexTransport } from './codex-app-server.ts';

interface WireMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
}

class FakeTransport implements CodexTransport {
  readonly writes: WireMessage[] = [];
  private onMessage: ((message: unknown) => void) | null = null;

  constructor(private readonly finishTurns = true) {}

  start(onMessage: (message: unknown) => void): void {
    this.onMessage = onMessage;
  }

  send(message: unknown): void {
    const wire = message as WireMessage;
    this.writes.push(wire);
    if (wire.id === undefined) return;
    queueMicrotask(() => {
      switch (wire.method) {
        case 'initialize':
          this.reply(wire.id!, {});
          break;
        case 'account/read':
          this.reply(wire.id!, {
            account: { type: 'chatgpt', email: 'teacher@example.test', planType: 'plus' },
            requiresOpenaiAuth: true,
          });
          break;
        case 'account/login/start':
          this.reply(wire.id!, {
            type: 'chatgpt',
            loginId: 'login-1',
            authUrl: 'https://auth.openai.com/authorize?client_id=codex',
          });
          break;
        case 'model/list':
          this.reply(wire.id!, {
            data: [
              {
                id: 'gpt-default',
                model: 'gpt-default',
                displayName: 'GPT Default',
                description: 'Recommended',
                isDefault: true,
                hidden: false,
              },
              {
                id: 'gpt-5.5',
                model: 'gpt-5.5',
                displayName: 'GPT 5.5',
                description: 'Previous generation',
                isDefault: false,
                hidden: false,
              },
            ],
            nextCursor: null,
          });
          break;
        case 'thread/start':
          this.reply(wire.id!, { thread: { id: 'thread-1' } });
          break;
        case 'turn/start':
          this.reply(wire.id!, { turn: { id: 'turn-1', status: 'inProgress', items: [] } });
          if (!this.finishTurns) break;
          this.notify('item/agentMessage/delta', {
            threadId: 'thread-1',
            turnId: 'turn-1',
            itemId: 'message-1',
            delta: 'Phân số ',
          });
          this.notify('item/agentMessage/delta', {
            threadId: 'thread-1',
            turnId: 'turn-1',
            itemId: 'message-1',
            delta: 'bằng nhau',
          });
          this.notify('thread/tokenUsage/updated', {
            threadId: 'thread-1',
            turnId: 'turn-1',
            tokenUsage: {
              last: { inputTokens: 120, outputTokens: 8, cachedInputTokens: 40 },
            },
          });
          this.notify('turn/completed', {
            threadId: 'thread-1',
            turn: { id: 'turn-1', status: 'completed', items: [] },
          });
          break;
        case 'account/logout':
          this.reply(wire.id!, {});
          break;
        default:
          this.reply(wire.id!, {});
      }
    });
  }

  stop(): void {}

  private reply(id: number, result: unknown): void {
    this.onMessage?.({ id, result });
  }

  private notify(method: string, params: unknown): void {
    this.onMessage?.({ method, params });
  }
}

describe('Codex App Server managed ChatGPT client', () => {
  it('initializes, reads managed auth and starts browser login', async () => {
    const transport = new FakeTransport();
    const client = new CodexAppServerClient(transport, { cwd: 'C:\\isolated-empty' });
    await client.initialize();

    expect(await client.account()).toMatchObject({
      account: { type: 'chatgpt', planType: 'plus' },
    });
    expect(await client.startBrowserLogin()).toEqual({
      loginId: 'login-1',
      authUrl: 'https://auth.openai.com/authorize?client_id=codex',
    });
    expect(
      transport.writes.find((message) => message.method === 'account/login/start')?.params,
    ).toEqual({ type: 'chatgpt' });
    expect(transport.writes[0]).toMatchObject({
      method: 'initialize',
      params: { capabilities: { experimentalApi: false, requestAttestation: false } },
    });
    expect(transport.writes.some((message) => message.method === 'initialized')).toBe(true);
  });

  it('runs an ephemeral read-only turn and collects only final answer deltas', async () => {
    const transport = new FakeTransport();
    const client = new CodexAppServerClient(transport, { cwd: 'C:\\isolated-empty' });
    await client.initialize();
    const deltas: string[] = [];

    const answer = await client.complete(
      'Dựa trên bằng chứng đã cung cấp.',
      (delta) => deltas.push(delta),
      undefined,
      'gpt-5.5',
    );

    expect(answer).toEqual({
      content: 'Phân số bằng nhau',
      modelId: 'gpt-5.5',
      usage: { inputTokens: 120, outputTokens: 8, cachedInputTokens: 40 },
    });
    expect(deltas).toEqual(['Phân số ', 'bằng nhau']);
    const threadStart = transport.writes.find((message) => message.method === 'thread/start');
    expect(threadStart?.params).toMatchObject({
      model: 'gpt-5.5',
      cwd: 'C:\\isolated-empty',
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ephemeral: true,
    });
    const turnStart = transport.writes.find((message) => message.method === 'turn/start');
    expect(turnStart?.params).toEqual({
      threadId: 'thread-1',
      input: [{ type: 'text', text: 'Dựa trên bằng chứng đã cung cấp.' }],
      model: 'gpt-5.5',
    });
  });

  it('exposes the authenticated model catalog for a real model picker', async () => {
    const client = new CodexAppServerClient(new FakeTransport(), { cwd: 'C:\\isolated-empty' });

    await expect(client.models()).resolves.toEqual([
      {
        id: 'gpt-default',
        model: 'gpt-default',
        displayName: 'GPT Default',
        description: 'Recommended',
        isDefault: true,
      },
      {
        id: 'gpt-5.5',
        model: 'gpt-5.5',
        displayName: 'GPT 5.5',
        description: 'Previous generation',
        isDefault: false,
      },
    ]);
  });

  it('uses the catalog default when gpt-5.5 is absent and rejects a missing explicit model', async () => {
    class CatalogTransport extends FakeTransport {
      override send(message: unknown): void {
        const wire = message as WireMessage;
        if (wire.method !== 'model/list') return super.send(message);
        this.writes.push(wire);
        queueMicrotask(() => {
          const handler = (this as unknown as { onMessage: (message: unknown) => void }).onMessage;
          handler({
            id: wire.id,
            result: {
              data: [
                {
                  id: 'gpt-default',
                  model: 'gpt-default',
                  displayName: 'GPT Default',
                  description: '',
                  isDefault: true,
                  hidden: false,
                },
              ],
              nextCursor: null,
            },
          });
        });
      }
    }

    const fallbackTransport = new CatalogTransport();
    const fallbackClient = new CodexAppServerClient(fallbackTransport, {
      cwd: 'C:\\isolated-empty',
    });
    const completion = await fallbackClient.complete('Dựa trên bằng chứng.');
    expect(completion.modelId).toBe('gpt-default');

    const explicitTransport = new CatalogTransport();
    const explicitClient = new CodexAppServerClient(explicitTransport, {
      cwd: 'C:\\isolated-empty',
      model: 'missing-model',
    });
    await expect(explicitClient.complete('Dựa trên bằng chứng.')).rejects.toThrow('missing-model');
  });

  it('interrupts and rejects a pending turn immediately on abort', async () => {
    const transport = new FakeTransport(false);
    const client = new CodexAppServerClient(transport, { cwd: 'C:\\isolated-empty' });
    const controller = new AbortController();
    const completion = client.complete('Dừng lượt này.', undefined, controller.signal);

    await vi.waitFor(() => {
      expect(transport.writes.some((message) => message.method === 'turn/start')).toBe(true);
    });
    controller.abort();

    await expect(completion).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport.writes.some((message) => message.method === 'turn/interrupt')).toBe(true);
    client.dispose();
  });
});
