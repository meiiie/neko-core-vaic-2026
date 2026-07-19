import { executeToolCalls } from './tool-runtime';
import { AGENT_TOOLS, type AgentTool, type AgentToolJsonSchema } from './tools';

interface WebMcpToolDefinition {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: AgentToolJsonSchema;
  readonly annotations?: {
    readonly readOnlyHint?: boolean;
    readonly untrustedContentHint?: boolean;
  };
  readonly execute: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
}

interface WebModelContext {
  registerTool(
    tool: WebMcpToolDefinition,
    options?: { readonly signal?: AbortSignal },
  ): Promise<void> | void;
}

declare global {
  interface Document {
    readonly modelContext?: WebModelContext;
  }
}

const TOOL_TITLES: Readonly<Record<string, string>> = {
  tong_quan_lop: 'Xem tổng quan lớp 7A',
  chan_doan_hoc_sinh: 'Xem chẩn đoán học sinh',
  giai_thich_kien_thuc: 'Xem bản đồ kiến thức',
  bai_duoc_giao: 'Xem bài đã giao',
  de_xuat_bai_tap: 'Đề xuất bài tập',
  sinh_bien_the_bai_tap: 'Sinh biến thể câu hỏi (bản nháp)',
  giao_bai: 'Giao bài cho lớp 7A',
};

const UNTRUSTED_OUTPUT_TOOLS = new Set([
  'bai_duoc_giao',
  'de_xuat_bai_tap',
  'sinh_bien_the_bai_tap',
]);

function mutationConfirmation(tool: AgentTool, args: Readonly<Record<string, unknown>>): boolean {
  const title = typeof args.title === 'string' ? args.title : (TOOL_TITLES[tool.name] ?? tool.name);
  const count = Array.isArray(args.question_ids) ? args.question_ids.length : 0;
  return window.confirm(
    `Xác nhận giao “${title}” gồm ${count} câu cho lớp 7A?\n\nThao tác này sẽ tạo bài tập thật và học sinh có thể nhìn thấy ngay.`,
  );
}

/**
 * Expose the same strictly validated NekoPath tools to browser agents through
 * the current WebMCP imperative API. Unsupported browsers simply keep the
 * existing human UI and embedded Neko agent.
 */
export function registerNekoPathWebMcpTools(): () => void {
  const modelContext = document.modelContext;
  if (!modelContext) return () => undefined;
  const lifecycle = new AbortController();

  for (const tool of AGENT_TOOLS) {
    const registration = modelContext.registerTool(
      {
        name: tool.name,
        title: TOOL_TITLES[tool.name] ?? tool.name,
        description: tool.description,
        inputSchema: tool.inputJsonSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          untrustedContentHint: UNTRUSTED_OUTPUT_TOOLS.has(tool.name),
        },
        execute: async (input) => {
          const [result] = await executeToolCalls(
            [{ name: tool.name, args: input }],
            [tool],
            lifecycle.signal,
            (candidate, args) => mutationConfirmation(candidate, args),
          );
          const payload = { ok: result.ok, data: result.data, error: result.error };
          return {
            content: [{ type: 'text', text: JSON.stringify(payload) }],
            structuredContent: payload,
            isError: !result.ok,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    if (registration && typeof registration.then === 'function') {
      void registration.catch(() => undefined);
    }
  }

  return () => lifecycle.abort();
}
