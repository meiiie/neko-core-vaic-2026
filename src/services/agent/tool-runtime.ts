import type { AgentToolCall } from './protocol';
import type { AgentTool, AgentToolResult } from './tools';

export type ToolRuntimeErrorCode =
  'TOOL_NOT_ALLOWED' | 'INVALID_TOOL_ARGS' | 'TOOL_ABORTED' | 'TOOL_TIMEOUT' | 'TOOL_ERROR';

export interface ToolExecutionResult extends AgentToolResult {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly durationMs: number;
  readonly errorCode?: ToolRuntimeErrorCode;
}

async function executeOne(
  call: AgentToolCall,
  tool: AgentTool | undefined,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  const startedAt = performance.now();
  const fail = (error: string, errorCode: ToolRuntimeErrorCode): ToolExecutionResult => ({
    name: call.name,
    args: call.args,
    ok: false,
    error,
    errorCode,
    durationMs: performance.now() - startedAt,
  });

  if (!tool)
    return fail(`Công cụ ${call.name} không nằm trong allowlist của phiên.`, 'TOOL_NOT_ALLOWED');
  const parsed = tool.inputSchema.safeParse(call.args);
  if (!parsed.success) return fail('Tham số công cụ không đúng schema.', 'INVALID_TOOL_ARGS');
  if (signal?.aborted) return fail('Lệnh công cụ đã bị hủy.', 'TOOL_ABORTED');

  const timeout = new AbortController();
  const timeoutId = globalThis.setTimeout(() => timeout.abort('tool timeout'), tool.timeoutMs);
  const abortFromParent = () => timeout.abort(signal?.reason ?? 'aborted');
  signal?.addEventListener('abort', abortFromParent, { once: true });
  try {
    const result = await tool.run(parsed.data as Readonly<Record<string, unknown>>, {
      signal: timeout.signal,
    });
    return {
      ...result,
      name: call.name,
      args: parsed.data as Readonly<Record<string, unknown>>,
      durationMs: performance.now() - startedAt,
    };
  } catch (error) {
    if (timeout.signal.aborted) {
      return fail(
        signal?.aborted ? 'Lệnh công cụ đã bị hủy.' : 'Công cụ vượt quá thời gian cho phép.',
        signal?.aborted ? 'TOOL_ABORTED' : 'TOOL_TIMEOUT',
      );
    }
    return fail(error instanceof Error ? error.message : 'Công cụ gặp lỗi.', 'TOOL_ERROR');
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromParent);
  }
}

export async function executeToolCalls(
  calls: readonly AgentToolCall[],
  tools: readonly AgentTool[],
  signal?: AbortSignal,
): Promise<ToolExecutionResult[]> {
  const allowed = new Map(tools.map((tool) => [tool.name, tool]));
  const canRunInParallel = calls.every((call) => {
    const tool = allowed.get(call.name);
    return tool?.readOnly === true && tool.parallelSafe === true;
  });

  if (canRunInParallel) {
    return Promise.all(calls.map((call) => executeOne(call, allowed.get(call.name), signal)));
  }

  const results: ToolExecutionResult[] = [];
  for (const call of calls) {
    results.push(await executeOne(call, allowed.get(call.name), signal));
  }
  return results;
}
