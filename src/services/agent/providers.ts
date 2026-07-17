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

function composeAnswer(toolName: string, payload: string): string {
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
  ): Promise<AgentCompletion> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: messages.map((message) =>
          message.role === 'tool'
            ? { role: 'tool', content: message.content, name: message.toolName }
            : { role: message.role, content: message.content },
        ),
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
      }),
    });
    if (!response.ok) throw new Error(`Provider trả về ${response.status}`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: OpenAiToolCallShape[] } }[];
    };
    const message = body.choices?.[0]?.message;
    const toolCalls: AgentToolCall[] = (message?.tool_calls ?? []).flatMap((call) => {
      const name = call.function?.name;
      if (!name) return [];
      try {
        return [
          { name, args: JSON.parse(call.function?.arguments ?? '{}') as Record<string, string> },
        ];
      } catch {
        return [{ name, args: {} }];
      }
    });
    return { content: message?.content ?? null, toolCalls };
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
