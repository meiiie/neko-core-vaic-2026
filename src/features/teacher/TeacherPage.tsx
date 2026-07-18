import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildHeroClassDashboard, kcName } from '../../app/adapters/hero-tutor';
import { useSyncStatus } from '../../services/sync';
import { TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';

interface MetricCardProps {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly supportingText: string;
  readonly hint: string;
  readonly emphasis?: 'attention';
}

function MetricCard({ id, label, value, supportingText, hint, emphasis }: MetricCardProps) {
  const tooltipId = `${id}-hint`;
  return (
    <article className={emphasis ? 'metric-card metric-card--attention' : 'metric-card'}>
      <div className="metric-title">
        <span>{label}</span>
        <span className="metric-help-wrap">
          <button
            className="metric-help"
            type="button"
            aria-label={`Giải thích chỉ số ${label}`}
            aria-describedby={tooltipId}
          >
            ?
          </button>
          <span className="metric-tooltip" id={tooltipId} role="tooltip">
            {hint}
          </span>
        </span>
      </div>
      <strong>{value}</strong>
      <small>{supportingText}</small>
    </article>
  );
}

export function TeacherPage() {
  const dashboard = useMemo(() => buildHeroClassDashboard(), []);
  const syncStatus = useSyncStatus();
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const topGroup = groups[0];
  const gap = dashboard.classWideGaps[0];
  const classSize = dashboard.learners.length;
  const evaluatedTotal = groups.reduce((total, group) => total + group.sufficientEvidenceCount, 0);
  const needsMoreQuestions =
    groups.find((group) => group.status === 'QUICK_CHECK')?.totalLearnerCount ?? 0;
  const supportGroups = groups.filter((group) => group.priorityScore > 0);
  const updatedLabel = syncStatus?.lastSyncedAt
    ? `Cập nhật gần nhất lúc ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Dữ liệu mẫu trên thiết bị • cập nhật khi mở trang';

  return (
    <div className="page-stack teacher-page">
      <header className="page-heading page-heading--split teacher-page-heading">
        <div>
          <p className="eyebrow">Lớp 7A • Toán</p>
          <h1>Chào Cô Hà</h1>
          <p>Những việc nên ưu tiên cho tiết học tiếp theo.</p>
        </div>
        <p className="teacher-updated" role="status">
          {updatedLabel}
        </p>
      </header>

      <section className="metric-grid metric-grid--teacher" aria-label="Tình hình lớp học">
        <MetricCard
          id="class-size"
          label="Số học sinh"
          value={classSize}
          supportingText="trong lớp 7A"
          hint="Tổng số hồ sơ học sinh trong lớp mẫu đang được tổng hợp."
        />
        <MetricCard
          id="evaluated"
          label="Đã đánh giá"
          value={`${evaluatedTotal}/${classSize}`}
          supportingText="đã có đủ dữ liệu"
          hint="Số học sinh đã trả lời đủ câu hỏi để hệ thống đưa ra một gợi ý có căn cứ."
        />
        <MetricCard
          id="needs-evaluation"
          label="Cần đánh giá thêm"
          value={needsMoreQuestions}
          supportingText="học sinh cần thêm câu hỏi"
          hint="Những học sinh chưa có đủ dữ liệu; hệ thống chưa xếp các em vào nhóm ôn tập."
          emphasis="attention"
        />
      </section>

      {gap || topGroup ? (
        <section className="teacher-decision-block" aria-labelledby="teacher-decision-heading">
          <header className="teacher-decision-heading">
            <p className="eyebrow">Gợi ý cho tiết học tới</p>
            <h2 id="teacher-decision-heading">
              {gap
                ? kcName(gap.rootKcId)
                : topGroup?.rootKcId
                  ? kcName(topGroup.rootKcId)
                  : topGroup
                    ? TEACHER_GROUP_LABELS[topGroup.status]
                    : ''}
            </h2>
          </header>

          <div className="teacher-decision-grid">
            {gap ? (
              <article className="class-policy-summary">
                <p className="decision-label">Tình hình của cả lớp</p>
                <p>
                  <strong>
                    {gap.learnerCount}/{gap.classSize}
                  </strong>{' '}
                  học sinh đã có đủ dữ liệu và cùng gặp khó khăn ở nội dung này (
                  {Math.round(gap.rate * 100)}%). Mức này đạt điều kiện để cô cân nhắc ôn lại cho cả
                  lớp.
                </p>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${gap.learnerCount} trên ${gap.classSize} học sinh đã có đủ dữ liệu`}
                  aria-valuemin={0}
                  aria-valuemax={gap.classSize}
                  aria-valuenow={gap.learnerCount}
                >
                  <span style={{ width: `${Math.round(gap.rate * 100)}%` }} />
                </div>
              </article>
            ) : null}

            {topGroup ? (
              <article className="teacher-priority-summary">
                <p className="decision-label">Nhóm cần ưu tiên nhất</p>
                <p className="priority-explanation">
                  <strong>{topGroup.sufficientEvidenceCount} học sinh</strong> cùng gặp khó khăn ở{' '}
                  <strong>{topGroup.blockedDescendantCount} kỹ năng</strong> tiếp theo.
                </p>
                <p>{teacherActionLabel(topGroup.suggestedActionId)}</p>
              </article>
            ) : null}
          </div>

          <Link className="button-primary" to={`/teacher/class?group=${topGroup?.id ?? ''}`}>
            Xem nhóm cần hỗ trợ
          </Link>
        </section>
      ) : null}

      <section className="today-panel" aria-labelledby="today-heading">
        <header>
          <p className="eyebrow">Phân bổ thời gian giáo viên</p>
          <h2 id="today-heading">Kế hoạch trong {dashboard.attentionPlan.budgetMinutes} phút</h2>
        </header>
        <div className="today-action-list">
          {dashboard.attentionPlan.selected.map((allocation, index) => {
            const group = groups.find((candidate) => candidate.id === allocation.groupId);
            const destination =
              group?.status === 'QUICK_CHECK'
                ? '/teacher/class?status=QUICK_CHECK'
                : `/teacher/class?group=${encodeURIComponent(allocation.groupId)}`;
            return (
              <Link key={allocation.groupId} to={destination}>
                <span className="today-action-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{teacherActionLabel(allocation.actionId)}</strong>
                  <small>
                    {allocation.minutes} phút • {allocation.attentionValue} điểm hành động
                    {group ? ` • ${group.totalLearnerCount} học sinh` : ''}
                  </small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
        <p className="data-footnote">
          Đã phân bổ {dashboard.attentionPlan.usedMinutes}/{dashboard.attentionPlan.budgetMinutes}{' '}
          phút; còn {dashboard.attentionPlan.remainingMinutes} phút. Điểm hành động là quy tắc minh
          bạch từ số học sinh, mức chặn kiến thức và nhu cầu xác minh — không phải dự báo learning
          gain.
        </p>
      </section>

      <section className="summary-panel">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Các nhóm học sinh</p>
            <h2>{supportGroups.length} nhóm cần cô hỗ trợ</h2>
          </div>
          <Link className="text-link" to="/teacher/class">
            Xem tất cả nhóm
          </Link>
        </header>
        <div className="group-preview-list">
          {groups.slice(0, 3).map((group) => (
            <Link key={group.id} to={`/teacher/class?group=${encodeURIComponent(group.id)}`}>
              <span>
                <strong>
                  {group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status]}
                </strong>
                <small>{TEACHER_GROUP_LABELS[group.status]}</small>
              </span>
              <span className="group-count">{group.totalLearnerCount} học sinh</span>
              <span className="priority-chip">
                {group.priorityScore > 0 ? 'Cần hỗ trợ trước' : 'Theo dõi thêm'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="data-footnote">
        Lớp 7A hiện dùng dữ liệu mẫu để đánh giá luồng sản phẩm; không chứa thông tin cá nhân thật.
      </p>
    </div>
  );
}
