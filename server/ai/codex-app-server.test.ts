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
            type: 'chatgptDeviceCode',
            loginId: 'login-1',
            verificationUrl: 'https://auth.openai.com/codex/device',
            userCode: 'ABCD-1234',
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
  it('initializes, reads managed auth and starts device-code login', async () => {
    const transport = new FakeTransport();
    const client = new CodexAppServerClient(transport, { cwd: 'C:\\isolated-empty' });
    await client.initialize();

    expect(await client.account()).toMatchObject({
      account: { type: 'chatgpt', planType: 'plus' },
    });
    expect(await client.startDeviceLogin()).toEqual({
      loginId: 'login-1',
      verificationUrl: 'https://auth.openai.com/codex/device',
      userCode: 'ABCD-1234',
    });
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

    const answer = await client.complete('Dựa trên bằng chứng đã cung cấp.', (delta) =>
      deltas.push(delta),
    );

    expect(answer).toBe('Phân số bằng nhau');
    expect(deltas).toEqual(['Phân số ', 'bằng nhau']);
    const threadStart = transport.writes.find((message) => message.method === 'thread/start');
    expect(threadStart?.params).toMatchObject({
      cwd: 'C:\\isolated-empty',
      approvalPolicy: 'never',
      sandbox: 'read-only',
      ephemeral: true,
    });
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
