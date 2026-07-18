import type { AgentChatMessage, AgentCompletion } from './loop';
import type { AgentToolCall } from './protocol';

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function routeRuleQuestion(messages: readonly AgentChatMessage[]): AgentCompletion {
  const raw = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const asked = stripDiacritics(raw);
  const calls: AgentToolCall[] = [];
  const learner = ['an', 'binh', 'chi', 'minh'].find((id) =>
    new RegExp(`\\b(ban\\s+)?${id}\\b`).test(asked),
  );
  const kcMatch = asked.match(/\bk(0?[1-9]|10)\b/);
  if (learner && /chan doan|hoc sinh|dang o dau|the nao|tinh hinh/.test(asked)) {
    calls.push({ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: learner } });
  } else if (kcMatch) {
    calls.push({ name: 'giai_thich_kien_thuc', args: { kc: `K${kcMatch[1].padStart(2, '0')}` } });
  } else if (/bai (duoc )?giao|bai tap|da nop|tien do/.test(asked)) {
    calls.push({ name: 'bai_duoc_giao', args: {} });
  } else if (/lop|tong quan|nhom|uu tien|lo hong|day lai/.test(asked)) {
    calls.push({ name: 'tong_quan_lop', args: {} });
  } else if (learner) {
    calls.push({ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: learner } });
  }

  if (calls.length > 0) return { content: null, toolCalls: calls };
  return {
    content:
      'Tôi trả lời được các câu về: tổng quan lớp / chẩn đoán của An, Bình, Chi, Minh / ' +
      'vị trí một kiến thức (K01–K10) / bài đã giao. Ví dụ: "Chẩn đoán của bạn An?".',
    toolCalls: [],
  };
}
