import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  actionLabel,
  buildHeroClassDashboard,
  GROUP_STATUS_LABELS,
  kcName,
} from '../../app/adapters/hero-tutor';

export function TeacherPage() {
  const dashboard = useMemo(() => buildHeroClassDashboard(), []);
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const topGroup = groups[0];
  const gap = dashboard.classWideGaps[0];
  const classSize = dashboard.learners.length;
  const sufficientTotal = groups.reduce((total, group) => total + group.sufficientEvidenceCount, 0);

  return (
    <div className="page-stack teacher-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Lớp 7A • Toán</p>
          <h1>Chào Cô Hà</h1>
          <p>Ưu tiên cho tiết học tiếp theo.</p>
        </div>
      </header>

      <section className="metric-grid" aria-label="Tổng quan lớp học">
        <article>
          <span>Quy mô lớp</span>
          <strong>{classSize}</strong>
          <small>học sinh</small>
        </article>
        <article>
          <span>Đủ bằng chứng</span>
          <strong>{sufficientTotal}</strong>
          <small>trên {classSize} hồ sơ</small>
        </article>
        <article>
          <span>Nhóm hành động</span>
          <strong>{groups.filter((group) => group.priorityScore > 0).length}</strong>
          <small>xếp theo tác động</small>
        </article>
        <article>
          <span>Cần kiểm tra</span>
          <strong>
            {groups.find((group) => group.status === 'QUICK_CHECK')?.totalLearnerCount ?? 0}
          </strong>
          <small>chưa bị gán nhãn</small>
        </article>
      </section>

      {gap || topGroup ? (
        <section className="teacher-decision-block" aria-labelledby="teacher-decision-heading">
          <header className="teacher-decision-heading">
            <p className="eyebrow">Quyết định trước tiết học</p>
            <h2 id="teacher-decision-heading">
              {gap
                ? kcName(gap.rootKcId)
                : topGroup?.rootKcId
                  ? kcName(topGroup.rootKcId)
                  : topGroup
                    ? GROUP_STATUS_LABELS[topGroup.status]
                    : ''}
            </h2>
          </header>

          <div className="teacher-decision-grid">
            {gap ? (
              <article className="class-policy-summary">
                <p className="decision-label">Tín hiệu chính sách toàn lớp</p>
                <p>
                  <strong>
                    {gap.learnerCount}/{gap.classSize}
                  </strong>{' '}
                  học sinh có đủ bằng chứng ({Math.round(gap.rate * 100)}%). Điều kiện dạy lại toàn
                  lớp đã được đáp ứng.
                </p>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${gap.learnerCount} trên ${gap.classSize} học sinh có đủ bằng chứng`}
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
                <p className="decision-label">Cùng tín hiệu • Ưu tiên số 1</p>
                <p className="priority-formula">
                  <strong>{topGroup.priorityScore}</strong>
                  <span>
                    = {topGroup.sufficientEvidenceCount} học sinh ×{' '}
                    {topGroup.blockedDescendantCount} kỹ năng bị chặn
                  </span>
                </p>
                <p>{actionLabel(topGroup.suggestedActionId)}</p>
              </article>
            ) : null}
          </div>

          <Link className="button-primary" to="/teacher/class">
            Chuẩn bị nhóm can thiệp
          </Link>
        </section>
      ) : null}

      <section className="summary-panel">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Bản đồ nhu cầu</p>
            <h2>Các nhóm đang hình thành trong lớp</h2>
          </div>
          <Link className="text-link" to="/teacher/class">
            Xem tất cả
          </Link>
        </header>
        <div className="group-preview-list">
          {groups.slice(0, 3).map((group) => (
            <div key={group.id}>
              <span>
                <strong>
                  {group.rootKcId ? kcName(group.rootKcId) : GROUP_STATUS_LABELS[group.status]}
                </strong>
                <small>{GROUP_STATUS_LABELS[group.status]}</small>
              </span>
              <span className="group-count">{group.totalLearnerCount} học sinh</span>
              <span className="priority-chip">Ưu tiên {group.priorityScore}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="data-footnote">
        Lớp 7A hiện dùng dữ liệu mẫu để đánh giá luồng sản phẩm; không chứa thông tin cá nhân thật.
      </p>
    </div>
  );
}
