import type { AgentChatMessage, AgentCompletion, AgentProvider, AgentToolCall } from './loop';
import { parseCapsule } from './context-manager';
import { parseJsonToolEnvelope } from './protocol';
import type { AgentTool } from './tools';
import { routeRuleQuestion } from './rule-router';

export { parseJsonToolEnvelope } from './protocol';

/**
 * Two brains behind one port:
 * - RuleBasedProvider: deterministic intent router — zero network, zero model,
 *   always available (the offline default; honest about being rule-based).
 * - OpenAiCompatAgentProvider: real tool-calling against ANY OpenAI-compatible
 *   endpoint — local Ollama (e.g. Gemma) today, the FPT proxy or in-browser
 *   WebLLM later (WebLLM exposes the same OpenAI-style API), per NekoCore's
 *   "a new endpoint is a data edit, not a code change".
 */

function lastToolResult(
  messages: readonly AgentChatMessage[],
): { name: string; payload: string } | null {
  const lastUser = messages.findLastIndex((message) => message.role === 'user');
  const message = [...messages.slice(lastUser + 1)].reverse().find((m) => m.role === 'tool');
  return message ? { name: message.toolName ?? '', payload: message.content } : null;
}

function previousToolResult(
  messages: readonly AgentChatMessage[],
): { name: string; payload: string } | null {
  const lastUser = messages.findLastIndex((message) => message.role === 'user');
  const message = [...messages.slice(0, lastUser)].reverse().find((item) => item.role === 'tool');
  if (message) return { name: message.toolName ?? '', payload: message.content };
  const capsule = messages.map(parseCapsule).find((value) => value !== null);
  const evidence = capsule?.evidence.at(-1);
  return evidence ? { name: evidence.toolName, payload: evidence.payload } : null;
}

export class RuleBasedProvider implements AgentProvider {
  readonly id = 'rule';
  readonly label = 'Bộ điều phối cục bộ (không cần model)';

  async complete(
    messages: readonly AgentChatMessage[],
    _tools: readonly AgentTool[],
  ): Promise<AgentCompletion> {
    const observed = lastToolResult(messages);

    // Second pass: a tool already ran — compose the answer from its payload.
    if (observed) {
      return { content: composeAnswer(observed.name, observed.payload), toolCalls: [] };
    }

    const latestQuestion = [...messages]
      .reverse()
      .find((message) => message.role === 'user')?.content;
    if (latestQuestion && /^(vì sao|tại sao|giải thích thêm)\??$/i.test(latestQuestion.trim())) {
      const previous = previousToolResult(messages);
      if (previous)
        return { content: composeAnswer(previous.name, previous.payload), toolCalls: [] };
    }

    return routeRuleQuestion(messages);
  }
}

export function composeAnswer(toolName: string, payload: string): string {
  try {
    const result = JSON.parse(payload) as { ok: boolean; data?: unknown; error?: string };
    if (!result.ok) return `Không lấy được dữ kiện: ${result.error}`;
    switch (toolName) {
      case 'chan_doan_hoc_sinh': {
        const d = result.data as {
          hocSinh: string;
          trangThai: string;
          kienThucGoc: string | null;
          duongBu: string[];
          soBangChung: number;
        };
        const root = d.kienThucGoc ? ` Lỗ hổng gốc theo bằng chứng: ${d.kienThucGoc}.` : '';
        const path = d.duongBu.length > 0 ? ` Đường bù: ${d.duongBu.join(' → ')}.` : '';
        return `Trạng thái của ${d.hocSinh}: ${d.trangThai} (${d.soBangChung} bằng chứng).${root}${path}`;
      }
      case 'tong_quan_lop': {
        const d = result.data as {
          siSo: number;
          nhom: { nhom: string; kienThucGoc: string | null; soHocSinh: number; hanhDong: string }[];
          loHongToanLop: { kienThuc: string; tuSo: number; mauSo: number }[];
        };
        const top = d.nhom[0];
        const gap = d.loHongToanLop[0];
        const gapText = gap
          ? ` Lỗ hổng toàn lớp: ${gap.kienThuc} (${gap.tuSo}/${gap.mauSo} học sinh).`
          : '';
        return `Lớp ${d.siSo} học sinh, ${d.nhom.length} nhóm.${gapText} Ưu tiên trước: ${top.nhom}${top.kienThucGoc ? ` — ${top.kienThucGoc}` : ''} (${top.soHocSinh} em) → ${top.hanhDong}`;
      }
      case 'giai_thich_kien_thuc': {
        const d = result.data as {
          ma: string;
          ten: string;
          canTruoc: string[];
          moKhoa: string[];
          laMucTieuLop: boolean;
        };
        return `${d.ma} — ${d.ten}.${d.canTruoc.length ? ` Cần vững trước: ${d.canTruoc.join(', ')}.` : ' Là kiến thức nền (không cần gì trước).'}${d.moKhoa.length ? ` Mở khóa: ${d.moKhoa.join(', ')}.` : ''}${d.laMucTieuLop ? ' Đây là mục tiêu hiện tại của lớp.' : ''}`;
      }
      case 'bai_duoc_giao': {
        const d = result.data as { ten: string; soCau: number; daNop: string }[];
        if (d.length === 0) return 'Chưa có bài nào được giao cho lớp.';
        return `Có ${d.length} bài đã giao: ${d.map((a) => `"${a.ten}" (${a.soCau} câu, đã nộp ${a.daNop})`).join('; ')}.`;
      }
      default:
        return payload;
    }
  } catch {
    return 'Kết quả công cụ không đọc được.';
  }
}

interface OpenAiToolCallShape {
  function?: { name?: string; arguments?: string };
}

const JSON_TOOL_INSTRUCTION =
  'Khi cần dữ kiện, trả lời DUY NHẤT một JSON theo mẫu {"tool":"<tên>","args":{...}} với một trong các tool sau. ' +
  'Khi đã đủ dữ kiện từ kết quả tool, trả lời người dùng bằng văn bản thường (không JSON).';

/** NekoCore-style SSE reader: yields each `data:` payload until [DONE]. */
async function* sseData(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const rawLine = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!rawLine.startsWith('data:')) continue;
      const data = rawLine.slice(5).trim();
      if (data === '[DONE]') return;
      yield data;
    }
  }
}

export class OpenAiCompatAgentProvider implements AgentProvider {
  constructor(
    readonly id: string,
    readonly label: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<AgentCompletion> {
    const stream = Boolean(onDelta);
    const toolMenu = tools
      .map(
        (tool) =>
          `- ${tool.name}: ${tool.description} args: ${JSON.stringify(tool.inputJsonSchema)}`,
      )
      .join('\n');
    const executedTools = new Set(
      messages.filter((message) => message.role === 'tool').map((message) => message.toolName),
    );
    const payload: Record<string, unknown> = {
      model: this.model,
      temperature: 0,
      stream,
      messages: [
        // JSON envelope instruction covers models without native tools.
        { role: 'system', content: `${JSON_TOOL_INSTRUCTION}\n${toolMenu}` },
        ...messages.map((message) =>
          message.role === 'tool'
            ? { role: 'tool' as const, content: message.content, name: message.toolName }
            : { role: message.role, content: message.content },
        ),
        // Small local models tend to re-emit the envelope after observing a
        // result; steer them to the synthesis phase explicitly.
        ...(executedTools.size > 0
          ? [
              {
                role: 'system' as const,
                content:
                  'Kết quả công cụ đã có ở trên. KHÔNG xuất JSON nữa — hãy trả lời người dùng bằng văn bản thường, dựa đúng trên các con số trong kết quả.',
              },
            ]
          : []),
      ],
      tools: tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputJsonSchema,
        },
      })),
    };
    const request = (body: Record<string, unknown>) =>
      this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal,
        body: JSON.stringify(body),
      });
    let response = await request(payload);
    if (response.status === 400 && payload.tools) {
      // Model without native tool support (Ollama returns 400 "does not
      // support tools" for e.g. gemma3). Retry once relying on the JSON
      // envelope instruction alone.
      const { tools: _tools, ...withoutTools } = payload;
      response = await request(withoutTools);
    }
    if (!response.ok) throw new Error(`Provider trả về ${response.status}`);

    let content: string | null;
    let rawCalls: OpenAiToolCallShape[];

    if (stream) {
      // NekoCore parseStream, miniaturised: accumulate content deltas and
      // index-keyed tool-call argument fragments.
      const acc = new Map<number, { name: string; argString: string }>();
      let text = '';
      for await (const data of sseData(response)) {
        let chunk: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: ({ index?: number } & OpenAiToolCallShape)[];
            };
          }[];
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          text += delta.content;
          onDelta?.(delta.content);
        }
        for (const call of delta?.tool_calls ?? []) {
          const index = call.index ?? 0;
          const entry = acc.get(index) ?? { name: '', argString: '' };
          if (call.function?.name) entry.name = call.function.name;
          if (call.function?.arguments) entry.argString += call.function.arguments;
          acc.set(index, entry);
        }
      }
      content = text || null;
      rawCalls = [...acc.values()].map((entry) => ({
        function: { name: entry.name, arguments: entry.argString },
      }));
    } else {
      const body = (await response.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: OpenAiToolCallShape[] } }[];
      };
      const message = body.choices?.[0]?.message;
      content = message?.content ?? null;
      rawCalls = message?.tool_calls ?? [];
    }

    const toolCalls: AgentToolCall[] = rawCalls.flatMap((call) => {
      const name = call.function?.name;
      if (!name) return [];
      try {
        return [
          { name, args: JSON.parse(call.function?.arguments || '{}') as Record<string, unknown> },
        ];
      } catch {
        return [{ name, args: {} }];
      }
    });

    // Gemma-style fallback: no native calls, but the content IS a tool envelope.
    if (toolCalls.length === 0) {
      const envelope = parseJsonToolEnvelope(content);
      if (envelope && !executedTools.has(envelope.name)) {
        return { content: null, toolCalls: [envelope] };
      }
      if (envelope && content) {
        // Already-executed tool re-emitted: strip the JSON block and keep any
        // surrounding prose as the answer.
        const stripped = content
          .replace(/```json[\s\S]*?```/g, '')
          .replace(/\{[\s\S]*\}/, '')
          .trim();
        return { content: stripped || null, toolCalls: [] };
      }
    }
    return { content, toolCalls };
  }
}

/** Provider profiles — data, not code. */
import { WebLlmAgentProvider } from './webllm-provider';
import { ResponsesAgentProvider } from './responses-provider';
import { ChatGptAgentProvider } from './chatgpt-provider';

export const AGENT_PROVIDERS: readonly AgentProvider[] = [
  new RuleBasedProvider(),
  new OpenAiCompatAgentProvider(
    'local',
    'Model cục bộ (Ollama — ví dụ Gemma)',
    'http://localhost:11434/v1',
    'gemma3:4b',
  ),
  new WebLlmAgentProvider(),
  new ResponsesAgentProvider(),
  new ChatGptAgentProvider(),
];
