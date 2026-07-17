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
    <div className="page-stack">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Lớp 7A • Toán</p>
          <h1>Chào buổi chiều, Cô Hà</h1>
          <p>Những quyết định cần chú ý trước tiết học tiếp theo.</p>
        </div>
        <Link className="button-secondary" to="/teacher/class">
          Mở nhóm can thiệp
        </Link>
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
          <span>Nhóm cần hành động</span>
          <strong>{groups.filter((group) => group.priorityScore > 0).length}</strong>
          <small>xếp theo tác động</small>
        </article>
        <article>
          <span>Cần kiểm tra thêm</span>
          <strong>
            {groups.find((group) => group.status === 'QUICK_CHECK')?.totalLearnerCount ?? 0}
          </strong>
          <small>chưa bị gán nhãn</small>
        </article>
      </section>

      <section className="teacher-focus-grid">
        {gap ? (
          <article className="decision-panel decision-panel--review">
            <div>
              <p className="eyebrow">Khoảng trống toàn lớp</p>
              <h2>{kcName(gap.rootKcId)}</h2>
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
                aria-valuemin={0}
                aria-valuemax={gap.classSize}
                aria-valuenow={gap.learnerCount}
              >
                <span style={{ width: `${Math.round(gap.rate * 100)}%` }} />
              </div>
            </div>
            <Link className="button-primary" to="/teacher/class">
              Chuẩn bị nhóm can thiệp
            </Link>
          </article>
        ) : null}

        {topGroup ? (
          <article className="priority-panel">
            <p className="eyebrow">Ưu tiên số 1</p>
            <h2>
              {topGroup.rootKcId ? kcName(topGroup.rootKcId) : GROUP_STATUS_LABELS[topGroup.status]}
            </h2>
            <p className="priority-formula">
              <strong>{topGroup.priorityScore}</strong>
              <span>
                = {topGroup.sufficientEvidenceCount} học sinh × {topGroup.blockedDescendantCount} kỹ
                năng bị chặn
              </span>
            </p>
            <p>{actionLabel(topGroup.suggestedActionId)}</p>
            <Link className="text-link" to="/teacher/class">
              Xem danh sách và bằng chứng
            </Link>
          </article>
        ) : null}
      </section>

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
