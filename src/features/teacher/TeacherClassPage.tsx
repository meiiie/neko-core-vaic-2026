import { useMemo } from 'react';
import {
  actionLabel,
  buildHeroClassDashboard,
  GROUP_STATUS_LABELS,
  kcName,
} from '../../app/adapters/hero-tutor';

export function TeacherClassPage() {
  const dashboard = useMemo(() => buildHeroClassDashboard(), []);
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <div className="page-stack">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Lớp 7A • 40 học sinh</p>
          <h1>Nhóm can thiệp</h1>
          <p>Xếp theo số học sinh đủ bằng chứng và số kỹ năng phía sau đang bị chặn.</p>
        </div>
        <span className="status-label status-label--neutral">Cập nhật trên thiết bị</span>
      </header>

      <section className="group-table" aria-label="Danh sách nhóm can thiệp">
        {groups.map((group, index) => (
          <article className="intervention-row" key={group.id}>
            <div className="rank-cell">
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="intervention-main">
              <p className="eyebrow">{GROUP_STATUS_LABELS[group.status] ?? group.status}</p>
              <h2>{group.rootKcId ? kcName(group.rootKcId) : GROUP_STATUS_LABELS[group.status]}</h2>
              <p>{actionLabel(group.suggestedActionId)}</p>
              <details>
                <summary>Xem {group.learnerIds.length} học sinh và bằng chứng</summary>
                <div className="learner-chip-list">
                  {group.learnerIds.map((id) => (
                    <span key={id}>{id.toUpperCase()}</span>
                  ))}
                </div>
                {group.representativeEventIds.length > 0 ? (
                  <p className="muted">
                    {group.representativeEventIds.length} sự kiện đại diện đã được kiểm tra theo thứ
                    tự thời gian.
                  </p>
                ) : null}
              </details>
            </div>
            <dl className="intervention-metrics">
              <div>
                <dt>Học sinh</dt>
                <dd>{group.totalLearnerCount}</dd>
              </div>
              <div>
                <dt>Đủ bằng chứng</dt>
                <dd>
                  {group.sufficientEvidenceCount}/{group.totalLearnerCount}
                </dd>
              </div>
              <div>
                <dt>Ưu tiên</dt>
                <dd>{group.priorityScore}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
