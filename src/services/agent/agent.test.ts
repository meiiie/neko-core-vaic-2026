import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installApiStub } from '../../test/api-stub';
import {
  AGENT_SYSTEM_PROMPT,
  runAgent,
  runAgentTurn,
  type AgentProvider,
  type AgentToolCall,
  type AgentTraceEvent,
} from './loop';
import {
  AGENT_PROVIDERS,
  DeterministicFirstProvider,
  OpenAiCompatAgentProvider,
  RuleBasedProvider,
} from './providers';
import { AGENT_TOOLS, toolByName } from './tools';

function collect(): { events: AgentTraceEvent[]; onTrace: (e: AgentTraceEvent) => void } {
  const events: AgentTraceEvent[] = [];
  return { events, onTrace: (e) => events.push(e) };
}

beforeEach(() => {
  installApiStub('co.ha@nekopath.edu.vn');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('agent tools (deterministic facts)', () => {
  it('class overview exposes groups, priority and the K02 class-wide gap', async () => {
    const result = await toolByName('tong_quan_lop')!.run({});
    expect(result.ok).toBe(true);
    const data = result.data as { siSo: number; loHongToanLop: { kienThuc: string }[] };
    expect(data.siSo).toBe(2);
    expect(data.loHongToanLop.map((gap) => gap.kienThuc)).toContain('Phân số bằng nhau');
  });

  it('learner diagnosis routes through the real domain core', async () => {
    const result = await toolByName('chan_doan_hoc_sinh')!.run({ hoc_sinh: 'an' });
    expect(result.ok).toBe(true);
    expect((result.data as { kienThucGoc: string }).kienThucGoc).toBe('Phân số bằng nhau');
  });

  it('rejects unknown learners and unknown KCs honestly', async () => {
    expect((await toolByName('chan_doan_hoc_sinh')!.run({ hoc_sinh: 'x' })).ok).toBe(false);
    expect((await toolByName('giai_thich_kien_thuc')!.run({ kc: 'K99' })).ok).toBe(false);
  });
});

describe('agent loop with the rule-based brain', () => {
  it('answers a natural question via tool_call → observe → answer', async () => {
    const { events, onTrace } = collect();
    const answer = await runAgent(
      'Chẩn đoán của bạn An thế nào?',
      new RuleBasedProvider(),
      AGENT_TOOLS,
      onTrace,
    );
    expect(events.some((e) => e.kind === 'tool_call' && e.name === 'chan_doan_hoc_sinh')).toBe(
      true,
    );
    expect(answer).toContain('Phân số bằng nhau');
  });

  it('says what it can do when no tool matches', async () => {
    const { onTrace } = collect();
    const answer = await runAgent(
      'kể chuyện cười đi',
      new RuleBasedProvider(),
      AGENT_TOOLS,
      onTrace,
    );
    expect(answer).toContain('tổng quan lớp');
  });

  it('proposes from the real question bank, asks approval, then creates an assignment', async () => {
    const baseFetch = globalThis.fetch;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/questions')) {
        return Response.json({
          questions: [
            {
              id: 'q-k02-1',
              kcId: 'K02',
              prompt: 'Phân số nào bằng 1/2?',
              difficulty: 'EASY',
              reviewState: 'REVIEWED',
            },
            {
              id: 'q-k02-2',
              kcId: 'K02',
              prompt: 'Chọn hai phân số bằng nhau.',
              difficulty: 'MEDIUM',
              reviewState: 'REVIEWED',
            },
          ],
        });
      }
      if (url.endsWith('/api/assignments') && init?.method === 'POST') {
        return Response.json({ id: 'assignment-created' }, { status: 201 });
      }
      return baseFetch(input, init);
    });
    vi.stubGlobal('fetch', fetchImpl);
    const approve = vi.fn(async () => true);
    const { events, onTrace } = collect();

    const answer = await runAgent(
      'Giao bài tập cho lớp đi',
      new RuleBasedProvider(),
      AGENT_TOOLS,
      onTrace,
      undefined,
      undefined,
      approve,
    );

    expect(answer).toContain('Đã giao');
    expect(approve).toHaveBeenCalledTimes(1);
    expect(events.flatMap((event) => (event.kind === 'tool_call' ? [event.name] : []))).toEqual([
      'de_xuat_bai_tap',
      'giao_bai',
    ]);
    const post = fetchImpl.mock.calls.find(
      ([input, init]) => String(input).endsWith('/api/assignments') && init?.method === 'POST',
    );
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      title: 'Luyện tập Phân số bằng nhau',
      questionIds: ['q-k02-1', 'q-k02-2'],
    });
  });

  it('stops a spinning provider that repeats the same tool call (stuck guard)', async () => {
    const looping: AgentProvider = {
      id: 'loop',
      label: 'loop',
      complete: async () => ({
        content: null,
        toolCalls: [{ name: 'tong_quan_lop', args: {} }],
      }),
    };
    const { events, onTrace } = collect();
    const answer = await runAgent('vòng lặp', looping, AGENT_TOOLS, onTrace);
    expect(answer).toContain('lặp lại cùng một lệnh');
    expect(events.filter((e) => e.kind === 'tool_call')).toHaveLength(1);
  });

  it('caps distinct-call chatter at the step budget and fans out batches in parallel', async () => {
    let step = 0;
    const chatty: AgentProvider = {
      id: 'chatty',
      label: 'chatty',
      complete: async () => {
        step += 1;
        const toolCalls: AgentToolCall[] = [
          { name: 'giai_thich_kien_thuc', args: { kc: `K0${step}` } },
          {
            name: 'chan_doan_hoc_sinh',
            args: { hoc_sinh: ['an', 'binh', 'chi', 'minh'][step - 1] ?? 'an' },
          },
        ];
        return { content: null, toolCalls };
      },
    };
    const { events, onTrace } = collect();
    const answer = await runAgent('nói nhiều', chatty, AGENT_TOOLS, onTrace);
    expect(answer).toContain('giới hạn số bước');
    expect(events.filter((e) => e.kind === 'tool_call')).toHaveLength(8); // 4 bước × 2 tool song song
  });
});

describe('deterministic-first model routing', () => {
  it('exposes exactly the three supported model routes', () => {
    expect(AGENT_PROVIDERS.map(({ id }) => id)).toEqual(['local', 'web', 'chatgpt']);
  });

  it('routes evidence deterministically before asking the selected model to synthesize', async () => {
    const complete = vi.fn<AgentProvider['complete']>(async (messages) => ({
      content: messages.some((message) => message.role === 'tool')
        ? 'An cần củng cố Phân số bằng nhau.'
        : 'không được gọi',
      toolCalls: [],
      usage: { inputTokens: 20, outputTokens: 6 },
    }));
    const provider = new DeterministicFirstProvider({ id: 'model', label: 'Model', complete });

    const result = await runAgentTurn('Chẩn đoán của bạn An thế nào?', provider, AGENT_TOOLS, [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
    ]);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.text).toContain('Phân số bằng nhau');
    expect(result.displayUsage).toEqual({ inputTokens: 20, outputTokens: 6 });
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 6, cachedInputTokens: 0 });
    expect(result.fallback).toBe(false);
  });

  it('falls back only after evidence and never converts abort into fallback', async () => {
    const failing: AgentProvider = {
      id: 'model',
      label: 'Model',
      complete: async () => {
        throw new Error('offline');
      },
    };
    const fallback = await runAgentTurn(
      'Chẩn đoán của bạn An thế nào?',
      new DeterministicFirstProvider(failing),
      AGENT_TOOLS,
      [{ role: 'system', content: AGENT_SYSTEM_PROMPT }],
    );
    expect(fallback.fallback).toBe(true);
    expect(fallback.text).toContain('Phân số bằng nhau');

    const controller = new AbortController();
    const aborted: AgentProvider = {
      id: 'model',
      label: 'Model',
      complete: async () => {
        controller.abort();
        throw new DOMException('Aborted', 'AbortError');
      },
    };
    await expect(
      runAgentTurn(
        'Chẩn đoán của bạn An thế nào?',
        new DeterministicFirstProvider(aborted),
        AGENT_TOOLS,
        [{ role: 'system', content: AGENT_SYSTEM_PROMPT }],
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('grounding guard on model answers', () => {
  it('replaces a fact-drifting answer with the deterministic composition', async () => {
    let step = 0;
    const drifting: AgentProvider = {
      id: 'drift',
      label: 'drift',
      complete: async () => {
        step += 1;
        if (step === 1) {
          return {
            content: null,
            toolCalls: [{ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } }],
          };
        }
        // Hallucinated synthesis: wrong topic, wrong numbers (real Gemma-4B failure mode).
        return {
          content: 'Lớp nên dạy lại "Phân tích dữ liệu" vì có 15 em chưa đạt.',
          toolCalls: [],
        };
      },
    };
    const { events, onTrace } = collect();
    const answer = await runAgent('An cần gì?', drifting, AGENT_TOOLS, onTrace);
    expect(answer).toContain('Phân số bằng nhau');
    expect(events.some((e) => e.kind === 'note' && e.text.includes('lệch dữ kiện'))).toBe(true);
  });

  it('keeps a well-grounded model answer untouched', async () => {
    let step = 0;
    const grounded: AgentProvider = {
      id: 'ok',
      label: 'ok',
      complete: async () => {
        step += 1;
        if (step === 1) {
          return {
            content: null,
            toolCalls: [{ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } }],
          };
        }
        return {
          content: 'An cần củng cố Phân số bằng nhau trước khi quay lại mục tiêu.',
          toolCalls: [],
        };
      },
    };
    const { events, onTrace } = collect();
    const answer = await runAgent('An cần gì?', grounded, AGENT_TOOLS, onTrace);
    expect(answer).toBe('An cần củng cố Phân số bằng nhau trước khi quay lại mục tiêu.');
    expect(events.some((e) => e.kind === 'note')).toBe(false);
  });
});

describe('JSON tool envelope fallback (models without native tools, e.g. Gemma)', () => {
  it('parses a bare JSON envelope from content', async () => {
    const { parseJsonToolEnvelope } = await import('./providers');
    expect(parseJsonToolEnvelope('{"tool":"chan_doan_hoc_sinh","args":{"hoc_sinh":"an"}}')).toEqual(
      { name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } },
    );
    expect(
      parseJsonToolEnvelope('Đây là JSON:\n{"tool":"tong_quan_lop","args":{}}\nxong.'),
    ).toEqual({ name: 'tong_quan_lop', args: {} });
    expect(parseJsonToolEnvelope('Câu trả lời thường, không JSON.')).toBeNull();
  });

  it('provider converts an envelope reply into a tool call', async () => {
    const body = {
      choices: [{ message: { content: '{"tool":"tong_quan_lop","args":{}}', tool_calls: [] } }],
    };
    const provider = new OpenAiCompatAgentProvider(
      'test',
      'test',
      'http://example.invalid/v1',
      'gemma-test',
      async () => new Response(JSON.stringify(body), { status: 200 }),
    );
    const completion = await provider.complete(
      [{ role: 'user', content: 'lớp thế nào?' }],
      AGENT_TOOLS,
    );
    expect(completion.toolCalls).toEqual([{ name: 'tong_quan_lop', args: {} }]);
  });
});

describe('SSE streaming (NekoCore parseStream, miniaturised)', () => {
  it('hides pre-evidence content while accumulating split tool-call arguments', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Xin "}}]}',
      'data: {"choices":[{"delta":{"content":"chào"}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"chan_doan_hoc_sinh","arguments":"{\\"hoc_"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"sinh\\":\\"an\\"}"}}]}}]}',
      'data: [DONE]',
      '',
    ].join('\n');
    const provider = new OpenAiCompatAgentProvider(
      'test',
      'test',
      'http://example.invalid/v1',
      'gemma-test',
      async () =>
        new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const deltas: string[] = [];
    const completion = await provider.complete(
      [{ role: 'user', content: 'chào' }],
      AGENT_TOOLS,
      undefined,
      (delta) => deltas.push(delta),
    );
    expect(deltas.join('')).toBe('');
    expect(completion.toolCalls).toEqual([
      { name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } },
    ]);
  });
});

describe('OpenAI-compatible agent provider', () => {
  it('parses tool_calls from a chat/completions reply', async () => {
    const body = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { function: { name: 'chan_doan_hoc_sinh', arguments: '{"hoc_sinh":"an"}' } },
            ],
          },
        },
      ],
    };
    const provider = new OpenAiCompatAgentProvider(
      'test',
      'test',
      'http://example.invalid/v1',
      'gemma-test',
      async () => new Response(JSON.stringify(body), { status: 200 }),
    );
    const completion = await provider.complete(
      [{ role: 'user', content: 'Chẩn đoán An' }],
      AGENT_TOOLS,
    );
    expect(completion.toolCalls).toEqual([
      { name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } },
    ]);
  });
});
