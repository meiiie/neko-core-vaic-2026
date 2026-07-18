import { describe, expect, it, vi } from 'vitest';
import { ChatGptAgentProvider, startChatGptLogin } from './chatgpt-provider';
import { AGENT_TOOLS } from './tools';

function sseResponse(content: string): Response {
  return new Response(content, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function evidenceMessages() {
  return [
    { role: 'system' as const, content: 'contract' },
    { role: 'user' as const, content: 'Chẩn đoán An thế nào?' },
    {
      role: 'tool' as const,
      toolName: 'chan_doan_hoc_sinh',
      content: '{"ok":true,"data":{"kienThucGoc":"Phân số bằng nhau"}}',
    },
  ];
}

describe('managed ChatGPT provider', () => {
  it('sends ordinary conversation to the selected model and streams it', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      sseResponse(
        'event: delta\ndata: {"text":"Xin "}\n\n' +
          'event: delta\ndata: {"text":"chào cô Hà!"}\n\n' +
          'event: done\ndata: {"content":"Xin chào cô Hà!","modelId":"gpt-5.6-sol"}\n\n',
      ),
    );
    const provider = new ChatGptAgentProvider(fetchImpl);
    provider.setModel('gpt-5.6-sol');
    const deltas: string[] = [];

    const result = await provider.complete(
      [{ role: 'user', content: 'Xin chào' }],
      AGENT_TOOLS,
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(result.content).toBe('Xin chào cô Hà!');
    expect(deltas).toEqual(['Xin ', 'chào cô Hà!']);
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      prompt: string;
      model: string;
    };
    expect(body.model).toBe('gpt-5.6-sol');
    expect(body.prompt).toContain('Xin chào');
  });

  it('lets the model select a browser tool without leaking its JSON into the transcript', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      sseResponse(
        'event: delta\ndata: {"text":"{\\"tool\\":\\"chan_doan_hoc_sinh\\","}\n\n' +
          'event: delta\ndata: {"text":"\\"args\\":{\\"hoc_sinh\\":\\"an\\"}}"}\n\n' +
          'event: done\ndata: {"content":"{\\"tool\\":\\"chan_doan_hoc_sinh\\",\\"args\\":{\\"hoc_sinh\\":\\"an\\"}}","modelId":"gpt-5.6-sol"}\n\n',
      ),
    );
    const deltas: string[] = [];

    const result = await new ChatGptAgentProvider(fetchImpl).complete(
      [{ role: 'user', content: 'Chẩn đoán An thế nào?' }],
      AGENT_TOOLS,
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(result.toolCalls).toEqual([{ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } }]);
    expect(deltas).toEqual([]);
    expect(String(fetchImpl.mock.calls[0][1]?.body)).toContain('chan_doan_hoc_sinh');
  });

  it('asks Codex App Server to synthesize after deterministic evidence exists', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      sseResponse(
        'event: delta\ndata: {"text":"An cần củng cố "}\n\n' +
          'event: delta\ndata: {"text":"Phân số bằng nhau."}\n\n' +
          'event: done\ndata: {"content":"An cần củng cố Phân số bằng nhau.","modelId":"gpt-5.5"}\n\n',
      ),
    );
    const provider = new ChatGptAgentProvider(fetchImpl);

    const result = await provider.complete(evidenceMessages(), AGENT_TOOLS);

    expect(result.content).toContain('Phân số bằng nhau');
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as { prompt: string };
    expect(body.prompt).toContain('Phân số bằng nhau');
    expect(body.prompt).toContain('CÔNG CỤ ĐÃ CHẠY');
  });

  it('uses evidence retained in a compacted capsule for a contextual follow-up', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      sseResponse(
        'event: done\ndata: {"content":"Vì bằng chứng cho thấy khoảng trống Phân số bằng nhau.","modelId":"gpt-default"}',
      ),
    );
    const provider = new ChatGptAgentProvider(fetchImpl);
    const capsule = {
      version: 1,
      originalTask: 'Chẩn đoán An thế nào?',
      constraints: [],
      evidence: [
        {
          toolName: 'chan_doan_hoc_sinh',
          payload: '{"ok":true,"data":{"kienThucGoc":"Phân số bằng nhau"}}',
        },
      ],
      compactionCount: 3,
    };

    const result = await provider.complete(
      [
        { role: 'system', content: `NEKOPATH_CONTEXT_CAPSULE\n${JSON.stringify(capsule)}` },
        { role: 'user', content: 'Vì sao?' },
      ],
      AGENT_TOOLS,
    );

    expect(result.content).toContain('Phân số bằng nhau');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][1]?.body)).toContain('Phân số bằng nhau');
  });

  it('parses fragmented CRLF records, streams ordered deltas and keeps reported usage', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: delta\r\nda',
      'ta: {"text":"Phân "}\r\n\r\nevent: delta\r\ndata: {"text":"số"}\r\n\r\n',
      'event: usage\ndata: {"inputTokens":30,"outputTokens":4,"cachedInputTokens":8}\n\n',
      'event: done\ndata: {"content":"Phân số","modelId":"gpt-5.5"}',
    ];
    const fetchImpl = vi.fn(async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
          controller.close();
        },
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    });
    const deltas: string[] = [];

    const result = await new ChatGptAgentProvider(fetchImpl).complete(
      evidenceMessages(),
      AGENT_TOOLS,
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(deltas).toEqual(['Phân ', 'số']);
    expect(result).toMatchObject({
      content: 'Phân số',
      modelId: 'gpt-5.5',
      usage: { inputTokens: 30, outputTokens: 4, cachedInputTokens: 8 },
    });
  });

  it('surfaces post-header errors and forwards AbortSignal to fetch', async () => {
    const failed = new ChatGptAgentProvider(async () =>
      sseResponse('event: error\ndata: {"message":"Model unavailable"}\n\n'),
    );
    await expect(failed.complete(evidenceMessages(), AGENT_TOOLS)).rejects.toThrow(
      'Model unavailable',
    );

    const controller = new AbortController();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    });
    const running = new ChatGptAgentProvider(fetchImpl).complete(
      evidenceMessages(),
      AGENT_TOOLS,
      controller.signal,
    );
    controller.abort(new DOMException('Stopped', 'AbortError'));
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('starts official browser OAuth', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ loginId: 'login-1', authUrl: 'https://auth.openai.com/authorize' }),
    );
    await expect(startChatGptLogin(fetchImpl)).resolves.toEqual({
      loginId: 'login-1',
      authUrl: 'https://auth.openai.com/authorize',
    });
  });
});
