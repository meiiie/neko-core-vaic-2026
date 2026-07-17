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
  parameters: { hoc_sinh: 'ID học sinh: an | binh | chi | minh' },
  async run(args) {
    const learnerId = (args.hoc_sinh ?? '').toLowerCase().trim();
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
