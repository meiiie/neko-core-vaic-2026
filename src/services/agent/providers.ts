import type { AgentChatMessage, AgentCompletion, AgentProvider, AgentToolCall } from './loop';
import type { AgentTool } from './tools';

/**
 * Two brains behind one port:
 * - RuleBasedProvider: deterministic intent router — zero network, zero model,
 *   always available (the offline default; honest about being rule-based).
 * - OpenAiCompatAgentProvider: real tool-calling against ANY OpenAI-compatible
 *   endpoint — local Ollama (e.g. Gemma) today, the FPT proxy or in-browser
 *   WebLLM later (WebLLM exposes the same OpenAI-style API), per NekoCore's
 *   "a new endpoint is a data edit, not a code change".
 */

function lastUser(messages: readonly AgentChatMessage[]): string {
  return [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
}

function lastToolResult(
  messages: readonly AgentChatMessage[],
): { name: string; payload: string } | null {
  const message = [...messages].reverse().find((m) => m.role === 'tool');
  return message ? { name: message.toolName ?? '', payload: message.content } : null;
}

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export class RuleBasedProvider implements AgentProvider {
  readonly id = 'rule';
  readonly label = 'Bộ điều phối cục bộ (không cần model)';

  async complete(
    messages: readonly AgentChatMessage[],
    _tools: readonly AgentTool[],
  ): Promise<AgentCompletion> {
    const asked = stripDiacritics(lastUser(messages));
    const observed = lastToolResult(messages);

    // Second pass: a tool already ran — compose the answer from its payload.
    if (observed) {
      return { content: composeAnswer(observed.name, observed.payload), toolCalls: [] };
    }

    // First pass: route the question to exactly one tool.
    const calls: AgentToolCall[] = [];
    const learner = ['an', 'binh', 'chi', 'minh'].find((id) =>
      new RegExp(`\\b(ban\\s+)?${id}\\b`).test(asked),
    );
    const kcMatch = asked.match(/\bk(0?[1-9]|10)\b/);
    if (learner && /chan doan|hoc sinh|dang o dau|the nao|tinh hinh/.test(asked)) {
      calls.push({ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: learner } });
    } else if (kcMatch) {
      const number = kcMatch[1].padStart(2, '0');
      calls.push({ name: 'giai_thich_kien_thuc', args: { kc: `K${number}` } });
    } else if (/bai (duoc )?giao|bai tap|da nop|tien do/.test(asked)) {
      calls.push({ name: 'bai_duoc_giao', args: {} });
    } else if (/lop|tong quan|nhom|uu tien|lo hong|day lai/.test(asked)) {
      calls.push({ name: 'tong_quan_lop', args: {} });
    } else if (learner) {
      calls.push({ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: learner } });
    }

    if (calls.length === 0) {
      return {
        content:
          'Tôi trả lời được các câu về: tổng quan lớp / chẩn đoán của An, Bình, Chi, Minh / ' +
          'vị trí một kiến thức (K01–K10) / bài đã giao. Ví dụ: "Chẩn đoán của bạn An?".',
        toolCalls: [],
      };
    }
    return { content: null, toolCalls: calls };
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

/**
 * Fallback for models WITHOUT native tool-calling (e.g. Gemma builds on
 * Ollama): the system prompt asks for a bare JSON envelope; if the reply
 * content parses as {"tool": ..., "args": {...}}, treat it as a tool call.
 */
export function parseJsonToolEnvelope(content: string | null): AgentToolCall | null {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { tool?: unknown; args?: unknown };
    if (typeof parsed.tool !== 'string') return null;
    const args =
      typeof parsed.args === 'object' && parsed.args !== null
        ? Object.fromEntries(
            Object.entries(parsed.args as Record<string, unknown>).map(([key, value]) => [
              key,
              String(value),
            ]),
          )
        : {};
    return { name: parsed.tool, args };
  } catch {
    return null;
  }
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
      .map((tool) => `- ${tool.name}: ${tool.description} args: ${JSON.stringify(tool.parameters)}`)
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
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(tool.parameters).map(([key, description]) => [
                key,
                { type: 'string', description },
              ]),
            ),
          },
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
          { name, args: JSON.parse(call.function?.arguments || '{}') as Record<string, string> },
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
export const AGENT_PROVIDERS: readonly AgentProvider[] = [
  new RuleBasedProvider(),
  new OpenAiCompatAgentProvider(
    'local',
    'Model cục bộ (Ollama — ví dụ Gemma)',
    'http://localhost:11434/v1',
    'gemma3:4b',
  ),
];
