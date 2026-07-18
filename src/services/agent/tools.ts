import {
  actionLabel,
  GROUP_STATUS_LABELS,
  HERO_TARGET_KC_ID,
  kcName,
} from '../../app/adapters/hero-tutor';
import { HERO_GRAPH } from '../../content';
import { fetchTeacherDashboard } from '../../features/teacher/teacher-api';

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

export interface AgentTool {
  readonly name: string;
  readonly description: string;
  /** Flat string params keep schemas tiny for small local models. */
  readonly parameters: Readonly<Record<string, string>>;
  run(args: Readonly<Record<string, string>>): Promise<AgentToolResult>;
}

const tongQuanLop: AgentTool = {
  name: 'tong_quan_lop',
  description: 'Tổng quan lớp 7A: các nhóm can thiệp, ưu tiên, lỗ hổng toàn lớp.',
  parameters: {},
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
      return { ok: false, error: 'Không đọc được dữ liệu lớp từ máy chủ.' };
    }
  },
};

const chanDoanHocSinh: AgentTool = {
  name: 'chan_doan_hoc_sinh',
  description: 'Nhóm hỗ trợ và bằng chứng hiện tại của một học sinh trong dữ liệu máy chủ.',
  parameters: { hoc_sinh: 'Tên hoặc ID học sinh trong lớp' },
  async run(args) {
    const query = (args.hoc_sinh ?? '').toLocaleLowerCase('vi-VN').trim();
    if (!query) return { ok: false, error: 'Cần nhập tên hoặc ID học sinh.' };
    try {
      const dashboard = await fetchTeacherDashboard();
      const learner = dashboard.learners.find(
        (candidate) =>
          candidate.id.toLocaleLowerCase('vi-VN') === query ||
          candidate.displayLabel.toLocaleLowerCase('vi-VN').includes(query),
      );
      if (!learner) return { ok: false, error: 'Không tìm thấy học sinh trong lớp.' };
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
      return { ok: false, error: 'Không đọc được dữ liệu học sinh từ máy chủ.' };
    }
  },
};

const giaiThichKienThuc: AgentTool = {
  name: 'giai_thich_kien_thuc',
  description: 'Vị trí một kiến thức (K01..K10) trong đồ thị: cần gì trước, mở khóa gì sau.',
  parameters: { kc: 'Mã kiến thức, ví dụ K02' },
  async run(args) {
    const kcId = (args.kc ?? '').toUpperCase().trim();
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
  parameters: {},
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

export const AGENT_TOOLS: readonly AgentTool[] = [
  tongQuanLop,
  chanDoanHocSinh,
  giaiThichKienThuc,
  baiDuocGiao,
];

export function toolByName(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((tool) => tool.name === name);
}
