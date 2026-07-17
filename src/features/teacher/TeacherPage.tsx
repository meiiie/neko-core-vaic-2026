import { useMemo } from 'react';
import {
  actionLabel,
  buildHeroClassDashboard,
  GROUP_STATUS_LABELS,
  kcName,
  UNREVIEWED_LABEL,
} from '../../app/adapters/hero-tutor';

/**
 * Decision cockpit (§4): first viewport = class facts, the class-wide gap
 * and "help this group first". Groups below as comparable ranked rows.
 * Every number comes from groupForTeacher()/detectClassWideGaps().
 */
export function TeacherPage() {
  const dashboard = useMemo(() => buildHeroClassDashboard(), []);
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const topGroup = groups[0];
  const classSize = dashboard.learners.length;
  const sufficientTotal = dashboard.groups.reduce(
    (total, group) => total + group.sufficientEvidenceCount,
    0,
  );

  return (
    <>
      <section className="section">
        <h1>Bảng can thiệp lớp học</h1>
        <p>
          Lớp mô phỏng <strong>{classSize} học sinh</strong> — {sufficientTotal}/{classSize} hồ sơ
          có đủ bằng chứng trực tiếp để xếp nhóm.
        </p>
        <p className="evidence-note">
          Toàn bộ học sinh là dữ liệu tổng hợp, không có thông tin cá nhân thật. {UNREVIEWED_LABEL}.
        </p>
      </section>

      {dashboard.classWideGaps.map((gap) => (
        <section className="action-panel action-panel--review" key={gap.rootKcId}>
          <h2>Lỗ hổng toàn lớp: {kcName(gap.rootKcId)}</h2>
          <p style={{ fontSize: 'var(--text-lg)' }}>
            <strong>
              {gap.learnerCount}/{gap.classSize}
            </strong>{' '}
            học sinh có đủ bằng chứng ({Math.round(gap.rate * 100)}%) — vượt ngưỡng chính sách{' '}
            {Math.round(gap.thresholdRate * 100)}% và tối thiểu {gap.thresholdCount} học sinh.
          </p>
          <div
            className="proportion"
            role="img"
            aria-label={`${gap.learnerCount} trên ${gap.classSize} học sinh`}
          >
            <span style={{ width: `${Math.round(gap.rate * 100)}%` }} />
          </div>
          <p className="group-action">Đề xuất: dạy lại chủ đề này cho cả lớp.</p>
        </section>
      ))}

      {topGroup ? (
        <section className="action-panel">
          <h2>Ưu tiên trước</h2>
          <p style={{ fontSize: 'var(--text-lg)' }}>
            <strong>
              {GROUP_STATUS_LABELS[topGroup.status] ?? topGroup.status}
              {topGroup.rootKcId ? ` — ${kcName(topGroup.rootKcId)}` : ''}
            </strong>{' '}
            ({topGroup.totalLearnerCount} học sinh)
          </p>
          <p>
            Điểm ưu tiên {topGroup.priorityScore} = {topGroup.sufficientEvidenceCount} học sinh đủ
            bằng chứng × {topGroup.blockedDescendantCount} kỹ năng phía sau bị chặn.
          </p>
          <p className="group-action">{actionLabel(topGroup.suggestedActionId)}</p>
        </section>
      ) : null}

      <section className="section">
        <h2>Các nhóm theo nhu cầu (xếp theo ưu tiên minh bạch)</h2>
        <ol className="group-rows">
          {groups.map((group) => (
            <li className="group-row" key={group.id}>
              <header>
                <h3>
                  {GROUP_STATUS_LABELS[group.status] ?? group.status}
                  {group.rootKcId ? ` — ${kcName(group.rootKcId)}` : ''}
                </h3>
                <span className="status-label status-label--neutral">
                  Ưu tiên: {group.priorityScore}
                </span>
              </header>
              <ul className="group-facts">
                <li>
                  <strong>{group.totalLearnerCount}</strong> học sinh
                </li>
                <li>
                  <strong>
                    {group.sufficientEvidenceCount}/{group.totalLearnerCount}
                  </strong>{' '}
                  đủ bằng chứng
                </li>
                <li>
                  <strong>{group.blockedDescendantCount}</strong> kỹ năng bị chặn phía sau
                </li>
              </ul>
              <div
                className="proportion"
                role="img"
                aria-label={`${group.sufficientEvidenceCount} trên ${group.totalLearnerCount} học sinh đủ bằng chứng`}
              >
                <span
                  style={{
                    width: `${
                      group.totalLearnerCount > 0
                        ? Math.round(
                            (group.sufficientEvidenceCount / group.totalLearnerCount) * 100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="group-action">{actionLabel(group.suggestedActionId)}</p>
              <details className="tech-details">
                <summary>Danh sách học sinh ({group.learnerIds.length})</summary>
                <p>{group.learnerIds.join(', ')}</p>
              </details>
              {group.representativeEventIds.length > 0 ? (
                <details className="tech-details">
                  <summary>Bằng chứng đại diện ({group.representativeEventIds.length})</summary>
                  <ul>
                    {group.representativeEventIds.map((id) => (
                      <li key={id}>
                        <code>{id}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
