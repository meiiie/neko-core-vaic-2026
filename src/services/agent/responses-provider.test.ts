import { describe, expect, it, vi } from 'vitest';
import { ResponsesAgentProvider } from './responses-provider';

function sse(events: readonly object[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('official Responses API browser adapter', () => {
  it('streams text deltas and returns usage', async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        { type: 'response.output_text.delta', delta: 'Xin ' },
        { type: 'response.output_text.delta', delta: 'chào' },
        {
          type: 'response.completed',
          response: {
            usage: {
              input_tokens: 12,
              output_tokens: 3,
              input_tokens_details: { cached_tokens: 4 },
            },
          },
        },
      ]),
    );
    const deltas: string[] = [];
    const provider = new ResponsesAgentProvider(fetchImpl);

    const result = await provider.complete(
      [{ role: 'user', content: 'Chào' }],
      [],
      undefined,
      (delta) => deltas.push(delta),
    );

    expect(result.content).toBe('Xin chào');
    expect(deltas).toEqual(['Xin ', 'chào']);
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3, cachedInputTokens: 4 });
  });

  it('accumulates split strict function-call arguments with their call id', async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { type: 'function_call', call_id: 'call_1', name: 'fact', arguments: '' },
        },
        {
          type: 'response.function_call_arguments.delta',
          output_index: 0,
          delta: '{"learner":',
        },
        {
          type: 'response.function_call_arguments.delta',
          output_index: 0,
          delta: '"an"}',
        },
        { type: 'response.completed', response: { usage: { input_tokens: 9, output_tokens: 5 } } },
      ]),
    );
    const provider = new ResponsesAgentProvider(fetchImpl);

    const result = await provider.complete([{ role: 'user', content: 'An?' }], []);

    expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'fact', args: { learner: 'an' } }]);
  });
});
