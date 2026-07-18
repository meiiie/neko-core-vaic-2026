import type { AgentToolCall } from './protocol';
import type { AgentTool, AgentToolResult } from './tools';

export type ToolRuntimeErrorCode =
  | 'TOOL_NOT_ALLOWED'
  | 'INVALID_TOOL_ARGS'
  | 'TOOL_APPROVAL_REQUIRED'
  | 'TOOL_DENIED'
  | 'TOOL_ABORTED'
  | 'TOOL_TIMEOUT'
  | 'TOOL_ERROR';

export type ToolApprovalGate = (
  tool: AgentTool,
  args: Readonly<Record<string, unknown>>,
) => boolean | Promise<boolean>;

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
  approve?: ToolApprovalGate,
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
  const parsedArgs = parsed.data as Readonly<Record<string, unknown>>;
  if (!tool.readOnly) {
    if (!approve) {
      return fail('Thao tác thay đổi dữ liệu cần giáo viên xác nhận.', 'TOOL_APPROVAL_REQUIRED');
    }
    let approved: boolean;
    try {
      approved = await approve(tool, parsedArgs);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Không thể xác nhận thao tác.',
        'TOOL_ERROR',
      );
    }
    if (signal?.aborted) return fail('Lệnh công cụ đã bị hủy.', 'TOOL_ABORTED');
    if (!approved) return fail('Giáo viên đã hủy thao tác giao bài.', 'TOOL_DENIED');
  }

  const timeout = new AbortController();
  const timeoutId = globalThis.setTimeout(() => timeout.abort('tool timeout'), tool.timeoutMs);
  const abortFromParent = () => timeout.abort(signal?.reason ?? 'aborted');
  signal?.addEventListener('abort', abortFromParent, { once: true });
  try {
    const result = await tool.run(parsedArgs, {
      signal: timeout.signal,
    });
    return {
      ...result,
      name: call.name,
      args: parsedArgs,
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
  approve?: ToolApprovalGate,
): Promise<ToolExecutionResult[]> {
  const allowed = new Map(tools.map((tool) => [tool.name, tool]));
  const canRunInParallel = calls.every((call) => {
    const tool = allowed.get(call.name);
    return tool?.readOnly === true && tool.parallelSafe === true;
  });

  if (canRunInParallel) {
    return Promise.all(
      calls.map((call) => executeOne(call, allowed.get(call.name), signal, approve)),
    );
  }

  const results: ToolExecutionResult[] = [];
  for (const call of calls) {
    results.push(await executeOne(call, allowed.get(call.name), signal, approve));
  }
  return results;
}
