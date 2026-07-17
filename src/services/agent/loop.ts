import { toolByName, type AgentTool } from './tools';

/**
 * Agent loop — a browser-sized mirror of NekoCore's core
 * (`complete → tool-calls → observe`, capped by max steps; see
 * E:\Sach\Sua\NekoCore src/core/ports.ts + agent.ts). One provider port;
 * rule-based, OpenAI-compatible (Ollama/FPT-proxy) and future WebLLM
 * adapters all satisfy it, so swapping the brain is a data edit.
 */

export interface AgentChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Set on assistant messages that requested tools; echoed back for context. */
  toolName?: string;
}

export interface AgentToolCall {
  name: string;
  args: Record<string, string>;
}

export interface AgentCompletion {
  content: string | null;
  toolCalls: AgentToolCall[];
}

/** The one port every "brain" implements (mirror of NekoCore Provider). */
export interface AgentProvider {
  readonly id: string;
  readonly label: string;
  complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
  ): Promise<AgentCompletion>;
}

export type AgentTraceEvent =
  | { kind: 'tool_call'; name: string; args: Record<string, string> }
  | { kind: 'tool_result'; name: string; ok: boolean; summary: string }
  | { kind: 'answer'; text: string }
  | { kind: 'note'; text: string };

const MAX_STEPS = 4;

export const AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý lớp học NekoPath cho GIÁO VIÊN. Chỉ được trả lời dựa trên kết quả công cụ; ' +
  'tuyệt đối không tự bịa số liệu hay chẩn đoán. Nếu không có công cụ phù hợp, nói rõ giới hạn. ' +
  'Trả lời tiếng Việt, ngắn gọn, nêu rõ hành động gợi ý khi có.';

export async function runAgent(
  question: string,
  provider: AgentProvider,
  tools: readonly AgentTool[],
  onTrace: (event: AgentTraceEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const messages: AgentChatMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: question },
  ];
  const seenCalls = new Set<string>();

  for (let step = 1; step <= MAX_STEPS; step++) {
    const completion = await provider.complete(messages, tools, signal);

    if (completion.toolCalls.length === 0) {
      const answer =
        completion.content?.trim() || 'Tôi chưa có đủ dữ kiện từ công cụ để trả lời câu này.';
      onTrace({ kind: 'answer', text: answer });
      return answer;
    }

    // Stuck-loop guard (NekoCore trait): the exact same call twice means the
    // brain is spinning — stop and report the facts gathered so far.
    const keys = completion.toolCalls.map((call) => `${call.name}:${JSON.stringify(call.args)}`);
    if (keys.some((key) => seenCalls.has(key))) {
      const stuck = 'Bộ não lặp lại cùng một lệnh công cụ — dừng để tránh vòng lặp vô ích.';
      onTrace({ kind: 'note', text: stuck });
      return stuck;
    }
    keys.forEach((key) => seenCalls.add(key));

    // Every tool is read-only, so a batch fans out in parallel (NekoCore's
    // read-only tool fan-out).
    completion.toolCalls.forEach((call) => {
      onTrace({ kind: 'tool_call', name: call.name, args: call.args });
    });
    const results = await Promise.all(
      completion.toolCalls.map(async (call) => {
        const tool = toolByName(call.name);
        return tool
          ? await tool.run(call.args)
          : { ok: false as const, error: `Không có công cụ ${call.name}.` };
      }),
    );
    completion.toolCalls.forEach((call, index) => {
      const result = results[index];
      const payload = JSON.stringify(result);
      onTrace({
        kind: 'tool_result',
        name: call.name,
        ok: result.ok,
        summary: result.ok ? payload : (result.error ?? 'lỗi không rõ'),
      });
      messages.push({
        role: 'assistant',
        content: `[gọi công cụ ${call.name}]`,
        toolName: call.name,
      });
      messages.push({ role: 'tool', content: payload, toolName: call.name });
    });
  }

  const fallback =
    'Đã chạm giới hạn số bước của phiên hỏi này. Kết quả công cụ ở trên là dữ kiện đã thu được.';
  onTrace({ kind: 'note', text: fallback });
  return fallback;
}
