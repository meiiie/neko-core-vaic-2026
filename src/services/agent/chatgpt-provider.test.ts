import { describe, expect, it, vi } from 'vitest';
import { ChatGptAgentProvider } from './chatgpt-provider';
import { AGENT_TOOLS } from './tools';

describe('managed ChatGPT provider', () => {
  it('uses the deterministic router for the tool-selection step', async () => {
    const fetchImpl = vi.fn();
    const provider = new ChatGptAgentProvider(fetchImpl);

    const result = await provider.complete(
      [{ role: 'user', content: 'Chẩn đoán An thế nào?' }],
      AGENT_TOOLS,
    );

    expect(result.toolCalls).toEqual([{ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } }]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks Codex App Server to synthesize only after deterministic evidence exists', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ content: 'An cần củng cố Phân số bằng nhau.' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const provider = new ChatGptAgentProvider(fetchImpl);

    const result = await provider.complete(
      [
        { role: 'system', content: 'contract' },
        { role: 'user', content: 'Chẩn đoán An thế nào?' },
        {
          role: 'tool',
          toolName: 'chan_doan_hoc_sinh',
          content: '{"ok":true,"data":{"kienThucGoc":"Phân số bằng nhau"}}',
        },
      ],
      AGENT_TOOLS,
    );

    expect(result.content).toContain('Phân số bằng nhau');
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as { prompt: string };
    expect(body.prompt).toContain('Phân số bằng nhau');
    expect(body.prompt).toContain('Chỉ diễn giải');
  });

  it('uses evidence retained in a compacted capsule for a contextual follow-up', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ content: 'Vì bằng chứng cho thấy khoảng trống Phân số bằng nhau.' }),
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
});
