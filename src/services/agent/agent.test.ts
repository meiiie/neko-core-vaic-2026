import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { runAgent, type AgentProvider, type AgentTraceEvent } from './loop';
import { OpenAiCompatAgentProvider, RuleBasedProvider } from './providers';
import { AGENT_TOOLS, toolByName } from './tools';

function collect(): { events: AgentTraceEvent[]; onTrace: (e: AgentTraceEvent) => void } {
  const events: AgentTraceEvent[] = [];
  return { events, onTrace: (e) => events.push(e) };
}

describe('agent tools (deterministic facts)', () => {
  it('class overview exposes groups, priority and the K02 class-wide gap', async () => {
    const result = await toolByName('tong_quan_lop')!.run({});
    expect(result.ok).toBe(true);
    const data = result.data as { siSo: number; loHongToanLop: { kienThuc: string }[] };
    expect(data.siSo).toBe(40);
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

  it('caps a runaway provider at the step budget', async () => {
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
    expect(answer).toContain('giới hạn số bước');
    expect(events.filter((e) => e.kind === 'tool_call')).toHaveLength(4);
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
