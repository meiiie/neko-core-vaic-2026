import { composeAnswer } from './providers';
import { parseCapsule } from './context-manager';
import type { AgentToolCall } from './protocol';
import { executeToolCalls } from './tool-runtime';
import type { AgentTool } from './tools';

export type { AgentToolCall } from './protocol';

export interface AgentChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolName?: string;
  readonly toolCallId?: string;
  readonly toolArgs?: Readonly<Record<string, unknown>>;
}

export interface AgentUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
}

export interface AgentCompletion {
  readonly content: string | null;
  readonly toolCalls: readonly AgentToolCall[];
  readonly finishReason?: string;
  readonly usage?: AgentUsage;
  readonly modelId?: string;
  readonly fallback?: boolean;
}

export type AgentDeltaHook = (text: string) => void;

export interface AgentProvider {
  readonly id: string;
  readonly label: string;
  readonly contextWindow?: number;
  complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: AgentDeltaHook,
  ): Promise<AgentCompletion>;
  dispose?(): Promise<void> | void;
}

export type AgentTraceEvent =
  | { kind: 'tool_call'; name: string; args: Readonly<Record<string, unknown>> }
  | { kind: 'tool_result'; name: string; ok: boolean; summary: string }
  | { kind: 'answer'; text: string }
  | { kind: 'note'; text: string };

export interface AgentTurnResult {
  readonly text: string;
  readonly messages: readonly AgentChatMessage[];
  readonly usage: AgentUsage;
  readonly displayUsage?: AgentUsage;
  readonly modelId?: string;
  readonly fallback: boolean;
}

const MAX_STEPS = 4;

export const AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý lớp học NekoPath cho GIÁO VIÊN. Chỉ được trả lời dựa trên kết quả công cụ; ' +
  'tuyệt đối không tự bịa số liệu hay chẩn đoán. Nếu không có công cụ phù hợp, nói rõ giới hạn. ' +
  'Trả lời tiếng Việt, ngắn gọn, nêu rõ hành động gợi ý khi có.';

function callKey(call: AgentToolCall): string {
  return `${call.name}:${JSON.stringify(
    Object.fromEntries(
      Object.entries(call.args).sort(([left], [right]) => left.localeCompare(right)),
    ),
  )}`;
}

function numericClaims(value: string): Set<string> {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?(?:\s*%)?\b/g) ?? []);
}

function isGrounded(answer: string, question: string, toolPayloads: readonly string[]): boolean {
  if (toolPayloads.length === 0) return true;
  const allowedNumbers = numericClaims(`${question}\n${toolPayloads.join('\n')}`);
  if ([...numericClaims(answer)].some((claim) => !allowedNumbers.has(claim))) return false;

  const anchors = new Set<string>();
  for (const payload of toolPayloads) {
    for (const match of payload.matchAll(/"kienThuc(?:Goc)?":"([^"]+)"/g)) anchors.add(match[1]);
  }
  return anchors.size === 0 || [...anchors].some((anchor) => answer.includes(anchor));
}

function composeCollectedEvidence(toolLog: readonly { name: string; payload: string }[]): string {
  const parts = toolLog.map((entry) => composeAnswer(entry.name, entry.payload));
  return [...new Set(parts)].join('\n');
}

function contextualEvidence(
  question: string,
  history: readonly AgentChatMessage[],
): { name: string; payload: string }[] {
  if (!/^(vì sao|tại sao|giải thích thêm)\??$/i.test(question.trim())) return [];
  const latestTool = [...history].reverse().find((message) => message.role === 'tool');
  if (latestTool) {
    return [{ name: latestTool.toolName ?? '', payload: latestTool.content }];
  }
  const capsule = history.map(parseCapsule).find((value) => value !== null);
  const evidence = capsule?.evidence.at(-1);
  return evidence ? [{ name: evidence.toolName, payload: evidence.payload }] : [];
}

export async function runAgentTurn(
  question: string,
  provider: AgentProvider,
  tools: readonly AgentTool[],
  history: readonly AgentChatMessage[],
  onTrace: (event: AgentTraceEvent) => void = () => undefined,
  signal?: AbortSignal,
  onDelta?: AgentDeltaHook,
): Promise<AgentTurnResult> {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  const messages: AgentChatMessage[] = [...history, { role: 'user', content: question }];
  const seenCalls = new Set<string>();
  const toolLog: { name: string; payload: string }[] = contextualEvidence(question, history);
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let displayUsage: AgentUsage | undefined;
  let modelId: string | undefined;
  let fallback = false;

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    const completion = await provider.complete(messages, tools, signal, onDelta);
    inputTokens += completion.usage?.inputTokens ?? 0;
    outputTokens += completion.usage?.outputTokens ?? 0;
    cachedInputTokens += completion.usage?.cachedInputTokens ?? 0;
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');

    if (completion.toolCalls.length === 0) {
      displayUsage = completion.usage;
      modelId = completion.modelId;
      fallback = completion.fallback ?? false;
      let answer =
        completion.content?.trim() || 'Tôi chưa có đủ dữ kiện từ công cụ để trả lời câu này.';
      if (
        !isGrounded(
          answer,
          question,
          toolLog.map((entry) => entry.payload),
        )
      ) {
        onTrace({
          kind: 'note',
          text: 'Câu trả lời của model lệch dữ kiện công cụ — thay bằng bản tổng hợp deterministic.',
        });
        answer = composeCollectedEvidence(toolLog);
      }
      messages.push({ role: 'assistant', content: answer });
      onTrace({ kind: 'answer', text: answer });
      return {
        text: answer,
        messages,
        usage: { inputTokens, outputTokens, cachedInputTokens },
        displayUsage,
        modelId,
        fallback,
      };
    }

    const keys = completion.toolCalls.map(callKey);
    if (keys.some((key) => seenCalls.has(key))) {
      const stuck = 'Bộ não lặp lại cùng một lệnh công cụ — dừng để tránh vòng lặp vô ích.';
      onTrace({ kind: 'note', text: stuck });
      messages.push({ role: 'assistant', content: stuck });
      return {
        text: stuck,
        messages,
        usage: { inputTokens, outputTokens, cachedInputTokens },
        displayUsage,
        modelId,
        fallback,
      };
    }
    keys.forEach((key) => seenCalls.add(key));

    completion.toolCalls.forEach((call) => {
      onTrace({ kind: 'tool_call', name: call.name, args: call.args });
    });
    const results = await executeToolCalls(completion.toolCalls, tools, signal);
    completion.toolCalls.forEach((call, index) => {
      const result = results[index];
      const payload = JSON.stringify({ ok: result.ok, data: result.data, error: result.error });
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
        toolCallId: call.id,
        toolArgs: call.args,
      });
      messages.push({
        role: 'tool',
        content: payload,
        toolName: call.name,
        toolCallId: call.id,
      });
      toolLog.push({ name: call.name, payload });
    });
  }

  const finalFallback =
    toolLog.length > 0
      ? `${composeCollectedEvidence(toolLog)}\n(Đã chạm giới hạn số bước; đây là bản tổng hợp deterministic.)`
      : 'Đã chạm giới hạn số bước của phiên hỏi này mà chưa thu được dữ kiện.';
  onTrace({ kind: 'note', text: finalFallback });
  messages.push({ role: 'assistant', content: finalFallback });
  return {
    text: finalFallback,
    messages,
    usage: { inputTokens, outputTokens, cachedInputTokens },
    displayUsage,
    modelId,
    fallback: false,
  };
}

/** Backward-compatible one-shot entry point for existing tests and callers. */
export async function runAgent(
  question: string,
  provider: AgentProvider,
  tools: readonly AgentTool[],
  onTrace: (event: AgentTraceEvent) => void,
  signal?: AbortSignal,
  onDelta?: AgentDeltaHook,
): Promise<string> {
  const result = await runAgentTurn(
    question,
    provider,
    tools,
    [{ role: 'system', content: AGENT_SYSTEM_PROMPT }],
    onTrace,
    signal,
    onDelta,
  );
  return result.text;
}
