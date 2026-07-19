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
import { HERO_GRAPH, HERO_MISCONCEPTION_IDS } from '../../content';
import { fetchTeacherDashboard } from '../../features/teacher/teacher-api';
import { nvidiaHeaders, nvidiaModel } from './nvidia-key';
import { ASSIGNMENTS_CHANGED_EVENT } from '../assignment-events';
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

const ASSIGNMENT_OPERATION_TTL_MS = 15 * 60_000;
const MAX_PENDING_ASSIGNMENT_OPERATIONS = 100;
const pendingAssignmentOperations = new Map<
  string,
  { readonly id: string; readonly createdAt: number }
>();

function assignmentOperation(key: string): string {
  const now = Date.now();
  for (const [pendingKey, operation] of pendingAssignmentOperations) {
    if (now - operation.createdAt > ASSIGNMENT_OPERATION_TTL_MS) {
      pendingAssignmentOperations.delete(pendingKey);
    }
  }
  const pending = pendingAssignmentOperations.get(key);
  if (pending) return pending.id;
  while (pendingAssignmentOperations.size >= MAX_PENDING_ASSIGNMENT_OPERATIONS) {
    const oldestKey = pendingAssignmentOperations.keys().next().value as string | undefined;
    if (!oldestKey) break;
    pendingAssignmentOperations.delete(oldestKey);
  }
  const id = globalThis.crypto.randomUUID();
  pendingAssignmentOperations.set(key, { id, createdAt: now });
  return id;
}

function finishAssignmentOperation(key: string, id: string): void {
  if (pendingAssignmentOperations.get(key)?.id === id) pendingAssignmentOperations.delete(key);
}

function normalizedLearnerQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function learnerMatchScore(id: string, displayLabel: string, rawQuery: string): number {
  const query = normalizedLearnerQuery(rawQuery);
  const normalizedId = normalizedLearnerQuery(id);
  const normalizedLabel = normalizedLearnerQuery(displayLabel);
  if (!query) return 0;
  if (normalizedId === query) return 100;
  if (normalizedLabel === query) return 90;
  if (normalizedLabel.split(' ').includes(query)) return 80;
  if (normalizedLabel.includes(query)) return 40;
  return 0;
}

const tongQuanLop: AgentTool = {
  name: 'tong_quan_lop',
  description: 'Tổng quan lớp 7A: các nhóm can thiệp, ưu tiên, lỗ hổng toàn lớp.',
  inputSchema: EMPTY_INPUT,
  inputJsonSchema: EMPTY_JSON_SCHEMA,
  ...READ_ONLY_TOOL,
  async run() {
    try {
      const dashboard = await fetchTeacherDashboard();
      const groups = [...dashboard.groups]
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .map((group) => ({
          nhom: GROUP_STATUS_LABELS[group.status] ?? group.status,
          kienThucGoc: group.rootKcId ? kcName(group.rootKcId) : null,
          soHocSinh: group.totalLearnerCount,
          duBangChung: group.sufficientEvidenceCount,
          soCauSaiCanKiemTra: group.wrongQuestions.length,
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
        data: {
          nguon: 'Máy chủ',
          siSo: dashboard.rosterCount,
          daCoBaiLam: dashboard.evaluatedLearnerCount,
          nhom: groups,
          loHongToanLop: gaps,
        },
      };
    } catch {
      const dashboard = buildHeroClassDashboard();
      return {
        ok: true,
        data: {
          nguon: 'Thiết bị',
          siSo: dashboard.learners.length,
          daCoBaiLam: dashboard.learners.length,
          nhom: [...dashboard.groups]
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .map((group) => ({
              nhom: GROUP_STATUS_LABELS[group.status] ?? group.status,
              kienThucGoc: group.rootKcId ? kcName(group.rootKcId) : null,
              soHocSinh: group.totalLearnerCount,
              duBangChung: group.sufficientEvidenceCount,
              diemUuTien: group.priorityScore,
              hanhDong: actionLabel(group.suggestedActionId),
            })),
          loHongToanLop: dashboard.classWideGaps.map((gap) => ({
            kienThuc: kcName(gap.rootKcId),
            tuSo: gap.learnerCount,
            mauSo: gap.classSize,
            nguongPhanTram: Math.round(gap.thresholdRate * 100),
          })),
        },
      };
    }
  },
};

const chanDoanHocSinh: AgentTool = {
  name: 'chan_doan_hoc_sinh',
  description: 'Nhóm hỗ trợ và bằng chứng hiện tại của một học sinh trong dữ liệu máy chủ.',
  inputSchema: z.object({ hoc_sinh: z.string().min(1).max(120) }).strict(),
  inputJsonSchema: {
    type: 'object',
    properties: {
      hoc_sinh: {
        type: 'string',
        minLength: 1,
        maxLength: 120,
        description: 'Tên hoặc ID học sinh trong lớp.',
      },
    },
    required: ['hoc_sinh'],
    additionalProperties: false,
  },
  ...READ_ONLY_TOOL,
  async run(args) {
    const query = String(args.hoc_sinh ?? '').trim();
    if (!query) return { ok: false, error: 'Cần nhập tên hoặc ID học sinh.' };
    try {
      const dashboard = await fetchTeacherDashboard();
      const ranked = dashboard.learners
        .map((learner) => ({
          learner,
          score: learnerMatchScore(learner.id, learner.displayLabel, query),
        }))
        .filter((match) => match.score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.learner.displayLabel.localeCompare(right.learner.displayLabel, 'vi-VN'),
        );
      const best = ranked[0];
      if (!best) return { ok: false, error: 'Không tìm thấy học sinh trong lớp.' };
      if (ranked[1]?.score === best.score) {
        return {
          ok: false,
          error: `Có nhiều học sinh khớp "${query}". Hãy nhập họ tên đầy đủ.`,
        };
      }
      const learner = best.learner;
      const group = dashboard.groups.find((candidate) => candidate.learnerIds.includes(learner.id));
      return {
        ok: true,
        data: {
          hocSinh: learner.displayLabel,
          trangThai: group
            ? (GROUP_STATUS_LABELS[group.status] ?? group.status)
            : 'Chưa có nhóm hỗ trợ',
          kienThucGoc: group?.rootKcId ? kcName(group.rootKcId) : null,
          duongBu: [],
          soBangChung: learner.eventCount,
          soCauTraLoi: learner.eventCount,
          nhom: group ? (GROUP_STATUS_LABELS[group.status] ?? group.status) : null,
          kienThucCanOn: group?.rootKcId ? kcName(group.rootKcId) : null,
          cauSaiGanNhat:
            group?.wrongQuestions
              .filter((question) =>
                question.answers.some((answer) => answer.learnerId === learner.id),
              )
              .map((question) => question.prompt) ?? [],
        },
      };
    } catch {
      const normalizedQuery = normalizedLearnerQuery(query);
      const learnerId = ['an', 'binh', 'chi', 'minh'].find(
        (candidate) =>
          normalizedQuery === candidate ||
          normalizedQuery === normalizedLearnerQuery(`user-student-${candidate}`),
      );
      if (!learnerId || !isHeroLearnerId(learnerId)) {
        return { ok: false, error: 'Không đọc được dữ liệu học sinh từ máy chủ.' };
      }
      const result = diagnoseHero(learnerId, await listEventsByLearner(learnerId));
      return {
        ok: true,
        data: {
          hocSinh: learnerId,
          trangThai: STATUS_LABELS[result.status],
          kienThucGoc: result.rootKcId ? kcName(result.rootKcId) : null,
          duongBu: result.pathKcIds.map((id) => kcName(id)),
          soBangChung: result.evidenceEventIds.length,
          nhom: STATUS_LABELS[result.status],
          kienThucCanOn: result.rootKcId ? kcName(result.rootKcId) : null,
          cauSaiGanNhat: [],
        },
      };
    }
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
    const requestedKc = typeof args.kc === 'string' ? args.kc.toUpperCase() : null;
    try {
      const dashboard = requestedKc
        ? null
        : await fetchTeacherDashboard().catch(() => buildHeroClassDashboard());
      const recommendedKc =
        requestedKc ?? dashboard?.classWideGaps[0]?.rootKcId ?? HERO_TARGET_KC_ID;
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
          reviewState?: string;
        }[];
      };
      const questions = body.questions
        .filter((question) => question.kcId === recommendedKc)
        .slice(0, 5)
        .map((question) => ({
          id: question.id,
          noiDung: question.prompt,
          doKho: question.difficulty,
          trangThaiDuyet: question.reviewState ?? 'UNREVIEWED',
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

/**
 * Output schema for a generated question variant. This is the "đóng khung nghiêm
 * ngặt" required by the product contract: any LLM-proposed variant MUST parse
 * against this schema, and its misconception tags MUST be in the authored
 * vocabulary. Variants are ALWAYS returned as UNREVIEWED drafts — the tool
 * never persists them; the teacher reviews and publishes via the existing
 * question-bank UI.
 */
const VARIANT_MISCONCEPTION_IDS = new Set(HERO_MISCONCEPTION_IDS);

const variantChoiceSchema = z.object({
  id: z.string().min(1).max(20),
  label: z.string().min(1).max(200),
  misconceptionTag: z.string().max(40).optional(),
});

const variantSchema = z.object({
  prompt: z.string().min(8).max(500),
  choices: z.array(variantChoiceSchema).min(2).max(5),
  correctChoiceId: z.string().min(1).max(20),
  explanation: z.string().max(500).default(''),
  reviewState: z.literal('UNREVIEWED'),
});

const variantSetSchema = z.object({
  variants: z.array(variantSchema).min(1).max(3),
});

export interface QuestionVariant {
  readonly prompt: string;
  readonly choices: readonly {
    readonly id: string;
    readonly label: string;
    readonly misconceptionTag?: string;
  }[];
  readonly correctChoiceId: string;
  readonly explanation: string;
  readonly reviewState: 'UNREVIEWED';
}

export type VariantParseResult =
  | { readonly ok: true; readonly variants: readonly QuestionVariant[] }
  | { readonly ok: false; readonly error: string };

/**
 * Pure validation. Rejects variants whose correct choice is not in choices,
 * whose distractor misconception tags are not in the authored vocabulary, or
 * whose choice ids collide. Exported so tests cover the guard directly without
 * an LLM in the loop.
 */
export function parseQuestionVariants(raw: unknown): VariantParseResult {
  const parsed = variantSetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: `Sai cấu trúc: ${parsed.error.issues[0]?.message ?? 'unknown'}.` };
  }
  const cleaned: QuestionVariant[] = [];
  for (const variant of parsed.data.variants) {
    const choiceIds = new Set<string>();
    let hasCollision = false;
    for (const choice of variant.choices) {
      if (choiceIds.has(choice.id)) {
        hasCollision = true;
        break;
      }
      choiceIds.add(choice.id);
    }
    if (hasCollision) return { ok: false, error: 'Có lựa chọn trùng id trong một biến thể.' };
    if (!choiceIds.has(variant.correctChoiceId)) {
      return { ok: false, error: 'correctChoiceId không nằm trong các lựa chọn.' };
    }
    for (const choice of variant.choices) {
      if (
        choice.id !== variant.correctChoiceId &&
        choice.misconceptionTag &&
        !VARIANT_MISCONCEPTION_IDS.has(choice.misconceptionTag)
      ) {
        return {
          ok: false,
          error: `Distractor gán nhãn mẫu sai ngoài danh mục đã biên soạn: ${choice.misconceptionTag}.`,
        };
      }
    }
    const { prompt, choices, correctChoiceId, explanation, reviewState } = variant;
    cleaned.push({ prompt, choices, correctChoiceId, explanation, reviewState });
  }
  return { ok: true, variants: cleaned };
}

const sinhBienTheBaiTap: AgentTool = {
  name: 'sinh_bien_the_bai_tap',
  description:
    'Sinh bản xem trước biến thể bài tập cho một kiến thức, đóng khung bởi schema và danh mục mẫu sai đã biên soạn. Chỉ trả bản nháp UNREVIEWED; không tự lưu. Giáo viên duyệt bằng giao diện ngân hàng câu hỏi.',
  inputSchema: z
    .object({
      kc: z
        .string()
        .regex(/^K(?:0[1-9]|10)$/i)
        .optional(),
      so_luong: z.number().int().min(1).max(3).default(1),
    })
    .strict(),
  inputJsonSchema: {
    type: 'object',
    properties: {
      kc: {
        type: 'string',
        pattern: '^K(?:0[1-9]|10)$',
        description: 'Mã kiến thức cần sinh biến thể; bỏ trống để dùng lỗ hổng ưu tiên của lớp.',
      },
      so_luong: {
        type: 'integer',
        minimum: 1,
        maximum: 3,
        description: 'Số biến thể cần sinh (tối đa 3).',
      },
    },
    required: [],
    additionalProperties: false,
  },
  ...READ_ONLY_TOOL,
  async run(args, context) {
    const requestedKc = typeof args.kc === 'string' ? args.kc.toUpperCase() : null;
    const requestedCount = typeof args.so_luong === 'number' ? args.so_luong : 1;
    if (requestedKc && !HERO_GRAPH.nodes.some((node) => node.id === requestedKc)) {
      return {
        ok: false,
        error: `Kiến thức ${requestedKc ?? ''} không thuộc đồ thị đã biên soạn.`,
      };
    }
    try {
      const dashboard = requestedKc
        ? null
        : await fetchTeacherDashboard().catch(() => buildHeroClassDashboard());
      const targetKc = requestedKc ?? dashboard?.classWideGaps[0]?.rootKcId ?? HERO_TARGET_KC_ID;
      const response = await fetch('/api/ai/variants', {
        method: 'POST',
        credentials: 'include',
        // The teacher's own NVIDIA key (if saved in this browser) lets the
        // server generate through GLM when no other backend is configured.
        headers: { 'content-type': 'application/json', ...nvidiaHeaders() },
        body: JSON.stringify({
          kcId: targetKc,
          count: requestedCount,
          nvidiaModel: nvidiaModel(),
        }),
        signal: context?.signal,
      });
      if (response.status === 404) {
        return {
          ok: false,
          error:
            'Chưa có nguồn sinh biến thể trên máy chủ (cần cấu hình model). Trả về danh sách rỗng thay vì bịa câu hỏi.',
        };
      }
      if (!response.ok) {
        return { ok: false, error: `Máy chủ trả về ${response.status} khi sinh biến thể.` };
      }
      const body = (await response.json()) as unknown;
      const parsed = parseQuestionVariants(body);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      return {
        ok: true,
        data: {
          kienThuc: { ma: targetKc, ten: kcName(targetKc) },
          trangThai: 'UNREVIEWED',
          soBienThe: parsed.variants.length,
          bienThe: parsed.variants,
          ghiChu:
            'Các biến thể luôn là bản nháp UNREVIEWED. Giáo viên duyệt và xuất bản qua ngân hàng câu hỏi trước khi giao.',
        },
      };
    } catch (error) {
      if (context?.signal?.aborted) throw error;
      return { ok: false, error: 'Không sinh được biến thể bài tập.' };
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
    const assignment = {
      title: args.title,
      questionIds: args.question_ids,
      dueAt: args.due_at ?? null,
      allowRetake: args.allow_retake ?? false,
      shuffleAnswers: args.shuffle_answers ?? true,
    };
    const operationKey = JSON.stringify(assignment);
    const operationId = assignmentOperation(operationKey);
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...assignment, operationId }),
        signal: context?.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status < 500 && response.status !== 408 && response.status !== 429) {
          finishAssignmentOperation(operationKey, operationId);
        }
        return {
          ok: false,
          error: `Không giao được bài: ${body?.error ?? `máy chủ trả về ${response.status}`}.`,
        };
      }
      const body = (await response.json()) as { id: string };
      finishAssignmentOperation(operationKey, operationId);
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
  sinhBienTheBaiTap,
  giaoBai,
];

export function toolByName(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.name === name);
}
