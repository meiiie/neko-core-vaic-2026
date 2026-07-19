import { composeAnswer } from './providers';
import { parseCapsule } from './context-manager';
import type { AgentToolCall } from './protocol';
import { executeToolCalls, type ToolApprovalGate, type ToolExecutionResult } from './tool-runtime';
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
  /** The deterministic router did not recognize the question; the content is its generic help text. */
  readonly unrouted?: boolean;
}

export type AgentDeltaHook = (text: string) => void;

export interface AgentProviderRuntime {
  readonly executeTool: (call: AgentToolCall) => Promise<ToolExecutionResult>;
}

export interface AgentProvider {
  readonly id: string;
  readonly label: string;
  readonly contextWindow?: number;
  complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: AgentDeltaHook,
    runtime?: AgentProviderRuntime,
  ): Promise<AgentCompletion>;
  dispose?(): Promise<void> | void;
}

export type AgentTraceEvent =
  | { kind: 'step'; index: number; max: number }
  | {
      kind: 'tool_call';
      name: string;
      args: Readonly<Record<string, unknown>>;
      step: number;
    }
  | {
      kind: 'tool_result';
      name: string;
      ok: boolean;
      summary: string;
      durationMs: number;
      errorCode?: string;
      step: number;
    }
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
const MAX_NATIVE_TOOL_CALLS = 8;

export const AGENT_SYSTEM_PROMPT =
  'Bạn là Neko, trợ lý lớp học dành cho giáo viên trong NekoPath. Kết quả công cụ là nguồn sự thật duy nhất: ' +
  'không tự sửa quan hệ chương trình, đáp án, mức thành thạo, nhóm, độ ưu tiên hoặc nhãn đánh giá. ' +
  'Không bịa số liệu hay chẩn đoán; bằng chứng thiếu hoặc mâu thuẫn thì nói rõ chưa đủ dữ kiện. ' +
  'Không trình bày chuỗi suy luận nội bộ. Trả lời tiếng Việt tự nhiên, ngắn gọn, nêu nguồn và hành động gợi ý khi có.';

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

function normalizedIntent(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi-VN');
}

function requiresToolEvidence(question: string): boolean {
  return /\b(chan doan|hoc sinh|lop|nhom|uu tien|lo hong|tien do|bai (?:duoc )?giao|giao bai|kien thuc goc|quan he kien thuc|k(?:0?[1-9]|10))\b/.test(
    normalizedIntent(question),
  );
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

interface ToolLogEntry {
  readonly name: string;
  readonly payload: string;
  readonly ok: boolean;
}

function toolPayloadSucceeded(payload: string): boolean {
  try {
    return (JSON.parse(payload) as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}

function composeCollectedEvidence(toolLog: readonly ToolLogEntry[]): string {
  const parts = toolLog.map((entry) => composeAnswer(entry.name, entry.payload));
  return [...new Set(parts)].join('\n');
}

function contextualEvidence(
  question: string,
  history: readonly AgentChatMessage[],
): ToolLogEntry[] {
  if (!/^(vì sao|tại sao|giải thích thêm)\??$/i.test(question.trim())) return [];
  const latestTool = [...history].reverse().find((message) => message.role === 'tool');
  if (latestTool) {
    return [
      {
        name: latestTool.toolName ?? '',
        payload: latestTool.content,
        ok: toolPayloadSucceeded(latestTool.content),
      },
    ];
  }
  const capsule = history.map(parseCapsule).find((value) => value !== null);
  const evidence = capsule?.evidence.at(-1);
  return evidence
    ? [
        {
          name: evidence.toolName,
          payload: evidence.payload,
          ok: toolPayloadSucceeded(evidence.payload),
        },
      ]
    : [];
}

export async function runAgentTurn(
  question: string,
  provider: AgentProvider,
  tools: readonly AgentTool[],
  history: readonly AgentChatMessage[],
  onTrace: (event: AgentTraceEvent) => void = () => undefined,
  signal?: AbortSignal,
  onDelta?: AgentDeltaHook,
  approveTool?: ToolApprovalGate,
): Promise<AgentTurnResult> {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  const messages: AgentChatMessage[] = [...history, { role: 'user', content: question }];
  const seenCalls = new Set<string>();
  const toolLog: ToolLogEntry[] = contextualEvidence(question, history);
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let displayUsage: AgentUsage | undefined;
  let modelId: string | undefined;
  let fallback = false;
  let nativeToolCallCount = 0;

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    onTrace({ kind: 'step', index: step, max: MAX_STEPS });
    const nativeResults: { call: AgentToolCall; result: ToolExecutionResult }[] = [];
    const completion = await provider.complete(messages, tools, signal, onDelta, {
      executeTool: async (call) => {
        const key = callKey(call);
        if (seenCalls.has(key)) {
          return {
            name: call.name,
            args: call.args,
            ok: false,
            error: 'Bộ não lặp lại cùng một lệnh công cụ.',
            errorCode: 'TOOL_ERROR',
            durationMs: 0,
          };
        }
        if (nativeToolCallCount >= MAX_NATIVE_TOOL_CALLS) {
          return {
            name: call.name,
            args: call.args,
            ok: false,
            error: 'Đã chạm giới hạn số lệnh công cụ trong một lượt.',
            errorCode: 'TOOL_ERROR',
            durationMs: 0,
          };
        }
        seenCalls.add(key);
        nativeToolCallCount += 1;
        onTrace({ kind: 'tool_call', name: call.name, args: call.args, step });
        const [result] = await executeToolCalls([call], tools, signal, approveTool);
        onTrace({
          kind: 'tool_result',
          name: call.name,
          ok: result.ok,
          summary: result.ok
            ? JSON.stringify({ ok: true, data: result.data })
            : (result.error ?? 'lỗi không rõ'),
          durationMs: result.durationMs,
          errorCode: result.errorCode,
          step,
        });
        nativeResults.push({ call, result });
        return result;
      },
    });
    inputTokens += completion.usage?.inputTokens ?? 0;
    outputTokens += completion.usage?.outputTokens ?? 0;
    cachedInputTokens += completion.usage?.cachedInputTokens ?? 0;
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');

    for (const { call, result } of nativeResults) {
      const payload = JSON.stringify({ ok: result.ok, data: result.data, error: result.error });
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
      toolLog.push({ name: call.name, payload, ok: result.ok });
    }

    if (completion.toolCalls.length === 0) {
      displayUsage = completion.usage;
      modelId = completion.modelId;
      fallback = completion.fallback ?? false;
      let answer =
        completion.content?.trim() || 'Tôi chưa có đủ dữ kiện từ công cụ để trả lời câu này.';
      const hasSuccessfulEvidence = toolLog.some((entry) => entry.ok);
      if (toolLog.length > 0 && !hasSuccessfulEvidence) {
        onTrace({
          kind: 'note',
          text: 'Không có công cụ nào trả về bằng chứng hợp lệ — dùng kết quả từ chối deterministic.',
        });
        answer = composeCollectedEvidence(toolLog);
      } else if (requiresToolEvidence(question) && !hasSuccessfulEvidence) {
        onTrace({
          kind: 'note',
          text: 'Câu hỏi cần dữ kiện nhưng model không gọi công cụ — từ chối thay vì suy đoán.',
        });
        answer = 'Tôi chưa có đủ dữ kiện từ công cụ NekoPath để trả lời câu này.';
      } else if (
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
      onTrace({ kind: 'tool_call', name: call.name, args: call.args, step });
    });
    const results = await executeToolCalls(completion.toolCalls, tools, signal, approveTool);
    completion.toolCalls.forEach((call, index) => {
      const result = results[index];
      const payload = JSON.stringify({ ok: result.ok, data: result.data, error: result.error });
      onTrace({
        kind: 'tool_result',
        name: call.name,
        ok: result.ok,
        summary: result.ok ? payload : (result.error ?? 'lỗi không rõ'),
        durationMs: result.durationMs,
        errorCode: result.errorCode,
        step,
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
      toolLog.push({ name: call.name, payload, ok: result.ok });
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
  approveTool?: ToolApprovalGate,
): Promise<string> {
  const result = await runAgentTurn(
    question,
    provider,
    tools,
    [{ role: 'system', content: AGENT_SYSTEM_PROMPT }],
    onTrace,
    signal,
    onDelta,
    approveTool,
  );
  return result.text;
}
