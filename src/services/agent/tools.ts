import {
  actionLabel,
  buildHeroClassDashboard,
  diagnoseHero,
  GROUP_STATUS_LABELS,
  HERO_TARGET_KC_ID,
  isHeroLearnerId,
  kcName,
  STATUS_LABELS,
} from '../../app/adapters/hero-tutor';
import { HERO_GRAPH } from '../../content';
import { listEventsByLearner } from '../../storage/event-repository';
import { z, type ZodType } from 'zod';

/**
 * Agent tools — the ONLY way the console agent may know anything.
 * Every tool wraps a deterministic domain function or a real API call and
 * returns structured facts. The model composes wording; it cannot invent
 * numbers because every number in an answer traces to a tool result
 * (AGENTS.md product invariant, mirrored from NekoCore's tool registry).
 */

export interface AgentToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export const ASSIGNMENTS_CHANGED_EVENT = 'nekopath:assignments-changed';

export interface AgentToolContext {
  readonly signal?: AbortSignal;
}

export interface AgentToolJsonSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties: false;
}

export interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType;
  readonly inputJsonSchema: AgentToolJsonSchema;
  readonly readOnly: boolean;
  readonly parallelSafe: boolean;
  readonly timeoutMs: number;
  run(
    args: Readonly<Record<string, unknown>>,
    context?: AgentToolContext,
  ): Promise<AgentToolResult>;
}

const EMPTY_INPUT = z.object({}).strict();
const EMPTY_JSON_SCHEMA: AgentToolJsonSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
};

const READ_ONLY_TOOL = {
  readOnly: true,
  parallelSafe: true,
  timeoutMs: 8_000,
} as const;

const tongQuanLop: AgentTool = {
  name: 'tong_quan_lop',
  description: 'Tổng quan lớp 7A: các nhóm can thiệp, ưu tiên, lỗ hổng toàn lớp.',
  inputSchema: EMPTY_INPUT,
  inputJsonSchema: EMPTY_JSON_SCHEMA,
  ...READ_ONLY_TOOL,
  async run() {
    const dashboard = buildHeroClassDashboard();
    const groups = [...dashboard.groups]
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((group) => ({
        nhom: GROUP_STATUS_LABELS[group.status] ?? group.status,
        kienThucGoc: group.rootKcId ? kcName(group.rootKcId) : null,
        soHocSinh: group.totalLearnerCount,
        duBangChung: group.sufficientEvidenceCount,
        diemUuTien: group.priorityScore,
        hanhDong: actionLabel(group.suggestedActionId),
      }));
    const gaps = dashboard.classWideGaps.map((gap) => ({
      kienThuc: kcName(gap.rootKcId),
      tuSo: gap.learnerCount,
      mauSo: gap.classSize,
      nguongPhanTram: Math.round(gap.thresholdRate * 100),
    }));
    return {
      ok: true,
      data: { siSo: dashboard.learners.length, nhom: groups, loHongToanLop: gaps },
    };
  },
};

const chanDoanHocSinh: AgentTool = {
  name: 'chan_doan_hoc_sinh',
  description: 'Chẩn đoán hiện tại của một học sinh hero (an, binh, chi, minh).',
  inputSchema: z.object({ hoc_sinh: z.enum(['an', 'binh', 'chi', 'minh']) }).strict(),
  inputJsonSchema: {
    type: 'object',
    properties: {
      hoc_sinh: {
        type: 'string',
        enum: ['an', 'binh', 'chi', 'minh'],
        description: 'ID học sinh demo.',
      },
    },
    required: ['hoc_sinh'],
    additionalProperties: false,
  },
  ...READ_ONLY_TOOL,
  async run(args) {
    const learnerId = String(args.hoc_sinh ?? '')
      .toLowerCase()
      .trim();
    if (!isHeroLearnerId(learnerId)) {
      return { ok: false, error: 'Chỉ có bốn hồ sơ demo: an, binh, chi, minh.' };
    }
    const localRecords = await listEventsByLearner(learnerId);
    const result = diagnoseHero(learnerId, localRecords);
    return {
      ok: true,
      data: {
        hocSinh: learnerId,
        trangThai: STATUS_LABELS[result.status],
        kienThucGoc: result.rootKcId ? kcName(result.rootKcId) : null,
        giaThuyetCanhTranh: result.competingKcIds.map((id) => kcName(id)),
        duongBu: result.pathKcIds.map((id) => kcName(id)),
        soBangChung: result.evidenceEventIds.length,
        cauHoiTiepTheo: result.nextItemId ?? null,
      },
    };
  },
};

const giaiThichKienThuc: AgentTool = {
  name: 'giai_thich_kien_thuc',
  description: 'Vị trí một kiến thức (K01..K10) trong đồ thị: cần gì trước, mở khóa gì sau.',
  inputSchema: z.object({ kc: z.string().regex(/^K(?:0[1-9]|10)$/i) }).strict(),
  inputJsonSchema: {
    type: 'object',
    properties: {
      kc: { type: 'string', pattern: '^K(?:0[1-9]|10)$', description: 'Mã K01 đến K10.' },
    },
    required: ['kc'],
    additionalProperties: false,
  },
  ...READ_ONLY_TOOL,
  async run(args) {
    const kcId = String(args.kc ?? '')
      .toUpperCase()
      .trim();
    const node = HERO_GRAPH.nodes.find((candidate) => candidate.id === kcId);
    if (!node) {
      return {
        ok: false,
        error: `Không có ${kcId || '(trống)'} trong đồ thị demo (${HERO_GRAPH.nodes.map((n) => n.id).join(', ')}).`,
      };
    }
    return {
      ok: true,
      data: {
        ma: node.id,
        ten: node.name,
        canTruoc: HERO_GRAPH.edges.filter((e) => e.to === kcId).map((e) => kcName(e.from)),
        moKhoa: HERO_GRAPH.edges.filter((e) => e.from === kcId).map((e) => kcName(e.to)),
        laMucTieuLop: kcId === HERO_TARGET_KC_ID,
      },
    };
  },
};

const baiDuocGiao: AgentTool = {
  name: 'bai_duoc_giao',
  description: 'Danh sách bài đã giao cho lớp và tiến độ nộp (cần kết nối máy chủ).',
  inputSchema: EMPTY_INPUT,
  inputJsonSchema: EMPTY_JSON_SCHEMA,
  ...READ_ONLY_TOOL,
  async run() {
    try {
      const response = await fetch('/api/assignments', { credentials: 'include' });
      if (!response.ok) return { ok: false, error: `Máy chủ trả về ${response.status}.` };
      const body = (await response.json()) as {
        assignments: {
          title: string;
          questionCount: number;
          submittedLearnerCount: number;
          rosterCount: number;
        }[];
      };
      return {
        ok: true,
        data: body.assignments.map((a) => ({
          ten: a.title,
          soCau: a.questionCount,
          daNop: `${a.submittedLearnerCount}/${a.rosterCount}`,
        })),
      };
    } catch {
      return { ok: false, error: 'Không kết nối được máy chủ — công cụ này cần mạng.' };
    }
  },
};

const deXuatBaiTap: AgentTool = {
  name: 'de_xuat_bai_tap',
  description:
    'Đọc ngân hàng câu hỏi thật và đề xuất một bài luyện phù hợp cho lớp 7A. Công cụ này chỉ tạo bản xem trước, chưa giao bài.',
  inputSchema: z
    .object({
      kc: z
        .string()
        .regex(/^K(?:0[1-9]|10)$/i)
        .optional(),
    })
    .strict(),
  inputJsonSchema: {
    type: 'object',
    properties: {
      kc: {
        type: 'string',
        pattern: '^K(?:0[1-9]|10)$',
        description: 'Mã kiến thức cần luyện; bỏ trống để dùng lỗ hổng ưu tiên của lớp.',
      },
    },
    required: [],
    additionalProperties: false,
  },
  ...READ_ONLY_TOOL,
  async run(args, context) {
    const dashboard = buildHeroClassDashboard();
    const requestedKc = typeof args.kc === 'string' ? args.kc.toUpperCase() : null;
    const recommendedKc = requestedKc ?? dashboard.classWideGaps[0]?.rootKcId ?? HERO_TARGET_KC_ID;
    try {
      const response = await fetch('/api/questions', {
        credentials: 'include',
        signal: context?.signal,
      });
      if (!response.ok) return { ok: false, error: `Máy chủ trả về ${response.status}.` };
      const body = (await response.json()) as {
        questions: {
          id: string;
          kcId: string;
          prompt: string;
          difficulty: string;
          reviewState: string;
        }[];
      };
      const questions = body.questions
        .filter((question) => question.kcId === recommendedKc)
        .slice(0, 5)
        .map((question) => ({
          id: question.id,
          noiDung: question.prompt,
          doKho: question.difficulty,
          trangThaiDuyet: question.reviewState,
        }));
      if (questions.length === 0) {
        return {
          ok: false,
          error: `Ngân hàng chưa có câu hỏi cho ${recommendedKc} — ${kcName(recommendedKc)}.`,
        };
      }
      return {
        ok: true,
        data: {
          lop: '7A',
          kienThuc: { ma: recommendedKc, ten: kcName(recommendedKc) },
          lyDo: requestedKc
            ? 'Chủ đề do giáo viên yêu cầu.'
            : 'Lỗ hổng toàn lớp có mức ưu tiên cao nhất trong dữ liệu hiện tại.',
          tenBai: `Luyện tập ${kcName(recommendedKc)}`,
          thoiLuongDuKienPhut: questions.length * 3,
          cauHoi: questions,
          questionIds: questions.map((question) => question.id),
        },
      };
    } catch (error) {
      if (context?.signal?.aborted) throw error;
      return { ok: false, error: 'Không kết nối được ngân hàng câu hỏi.' };
    }
  },
};

const giaoBai: AgentTool = {
  name: 'giao_bai',
  description:
    'Tạo ngay một bài tập thật cho lớp 7A từ các ID câu hỏi đã kiểm tra. Đây là thao tác ghi dữ liệu và luôn cần giáo viên xác nhận.',
  inputSchema: z
    .object({
      title: z.string().min(3).max(120),
      question_ids: z.array(z.string().min(1)).min(1).max(20),
      due_at: z.union([z.string().datetime(), z.null()]).optional(),
      allow_retake: z.boolean().default(false),
      shuffle_answers: z.boolean().default(true),
    })
    .strict(),
  inputJsonSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 120, description: 'Tên bài tập.' },
      question_ids: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: { type: 'string' },
        description: 'ID câu hỏi lấy từ công cụ de_xuat_bai_tap.',
      },
      due_at: {
        type: ['string', 'null'],
        format: 'date-time',
        description: 'Hạn nộp ISO 8601 hoặc null nếu không đặt hạn.',
      },
      allow_retake: { type: 'boolean', description: 'Cho phép làm lại từng câu.' },
      shuffle_answers: { type: 'boolean', description: 'Trộn thứ tự đáp án.' },
    },
    required: ['title', 'question_ids'],
    additionalProperties: false,
  },
  readOnly: false,
  parallelSafe: false,
  timeoutMs: 10_000,
  async run(args, context) {
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: args.title,
          questionIds: args.question_ids,
          dueAt: args.due_at ?? null,
          allowRetake: args.allow_retake ?? false,
          shuffleAnswers: args.shuffle_answers ?? true,
        }),
        signal: context?.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return {
          ok: false,
          error: `Không giao được bài: ${body?.error ?? `máy chủ trả về ${response.status}`}.`,
        };
      }
      const body = (await response.json()) as { id: string };
      window.dispatchEvent(new CustomEvent(ASSIGNMENTS_CHANGED_EVENT));
      return {
        ok: true,
        data: {
          id: body.id,
          lop: '7A',
          tenBai: args.title,
          soCau: Array.isArray(args.question_ids) ? args.question_ids.length : 0,
          hanNop: args.due_at ?? null,
        },
      };
    } catch (error) {
      if (context?.signal?.aborted) throw error;
      return { ok: false, error: 'Không kết nối được máy chủ để giao bài.' };
    }
  },
};

export const AGENT_TOOLS: readonly AgentTool[] = [
  tongQuanLop,
  chanDoanHocSinh,
  giaiThichKienThuc,
  baiDuocGiao,
  deXuatBaiTap,
  giaoBai,
];

export function toolByName(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.name === name);
}
