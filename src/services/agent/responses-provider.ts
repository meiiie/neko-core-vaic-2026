import type { AgentChatMessage, AgentCompletion, AgentProvider, AgentUsage } from './loop';
import type { AgentToolCall } from './protocol';
import type { AgentTool } from './tools';

type ResponsesInput =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'function_call_output'; call_id: string; output: string };

function toInput(messages: readonly AgentChatMessage[]): ResponsesInput[] {
  return messages.flatMap((message): ResponsesInput[] => {
    if (message.role === 'tool' && message.toolCallId) {
      return [
        { type: 'function_call_output', call_id: message.toolCallId, output: message.content },
      ];
    }
    if (message.role === 'assistant' && message.toolName && message.toolCallId) {
      return [
        {
          type: 'function_call',
          call_id: message.toolCallId,
          name: message.toolName,
          arguments: JSON.stringify(message.toolArgs ?? {}),
        },
      ];
    }
    if (message.role === 'tool') {
      return [
        {
          role: 'user',
          content: `[Kết quả công cụ ${message.toolName ?? 'không rõ'}]: ${message.content}`,
        },
      ];
    }
    return [{ role: message.role, content: message.content }];
  });
}

async function* sseData(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const records = buffer.split(/\r?\n\r?\n/);
    buffer = records.pop() ?? '';
    for (const record of records) {
      const data = record
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data && data !== '[DONE]') yield data;
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const data = buffer
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data && data !== '[DONE]') yield data;
  }
}

interface ResponsesEvent {
  readonly type?: string;
  readonly delta?: string;
  readonly output_index?: number;
  readonly item?: {
    readonly type?: string;
    readonly call_id?: string;
    readonly name?: string;
    readonly arguments?: string;
  };
  readonly response?: {
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly input_tokens_details?: { readonly cached_tokens?: number };
    };
  };
}

export class ResponsesAgentProvider implements AgentProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI Responses (máy chủ)';
  readonly contextWindow = 128_000;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<AgentCompletion> {
    const response = await this.fetchImpl('/api/ai/responses', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        input: toInput(messages),
        tools: tools.map((tool) => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputJsonSchema,
          strict: true,
        })),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Responses provider trả về ${response.status}`);
    }

    let content = '';
    let usage: AgentUsage | undefined;
    const calls = new Map<number, { id: string; name: string; arguments: string }>();
    for await (const data of sseData(response)) {
      let event: ResponsesEvent;
      try {
        event = JSON.parse(data) as ResponsesEvent;
      } catch {
        continue;
      }
      if (event.type === 'response.output_text.delta' && event.delta) {
        content += event.delta;
        onDelta?.(event.delta);
      }
      if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
        const index = event.output_index ?? calls.size;
        calls.set(index, {
          id: event.item.call_id ?? `call_${index}`,
          name: event.item.name ?? '',
          arguments: event.item.arguments ?? '',
        });
      }
      if (event.type === 'response.function_call_arguments.delta' && event.delta) {
        const index = event.output_index ?? 0;
        const call = calls.get(index) ?? { id: `call_${index}`, name: '', arguments: '' };
        call.arguments += event.delta;
        calls.set(index, call);
      }
      if (event.type === 'response.completed') {
        const raw = event.response?.usage;
        if (raw) {
          usage = {
            inputTokens: raw.input_tokens ?? 0,
            outputTokens: raw.output_tokens ?? 0,
            cachedInputTokens: raw.input_tokens_details?.cached_tokens ?? 0,
          };
        }
      }
      if (event.type === 'response.failed' || event.type === 'error') {
        throw new Error('Responses generation failed.');
      }
    }

    const toolCalls: AgentToolCall[] = [...calls.values()].flatMap((call) => {
      if (!call.name) return [];
      try {
        return [{ id: call.id, name: call.name, args: JSON.parse(call.arguments || '{}') }];
      } catch {
        return [{ id: call.id, name: call.name, args: {} }];
      }
    });
    return {
      content: content || null,
      toolCalls,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      usage,
    };
  }
}
