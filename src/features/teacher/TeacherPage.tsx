import { useMemo } from 'react';
import {
  actionLabel,
  buildHeroClassDashboard,
  GROUP_STATUS_LABELS,
  kcName,
  UNREVIEWED_LABEL,
} from '../../app/adapters/hero-tutor';

/**
 * Teacher dashboard over the synthetic 40-learner class. Every number below
 * comes from groupForTeacher()/detectClassWideGaps() — this component never
 * invents counts, priorities or urgency.
 */
export function TeacherPage() {
  const dashboard = useMemo(() => buildHeroClassDashboard(), []);
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);

  return (
    <>
      <section className="card">
        <h2>Bảng điều khiển giáo viên — lớp mô phỏng {dashboard.learners.length} học sinh</h2>
        <p className="placeholder-note">
          Toàn bộ học sinh là dữ liệu tổng hợp, không có thông tin cá nhân thật. {UNREVIEWED_LABEL}.
        </p>
      </section>

      <section className="card">
        <h2>Lỗ hổng toàn lớp</h2>
        {dashboard.classWideGaps.length > 0 ? (
          <ul>
            {dashboard.classWideGaps.map((gap) => (
              <li key={gap.rootKcId}>
                <strong>{kcName(gap.rootKcId)}</strong> ({gap.rootKcId}): {gap.learnerCount}/
                {gap.classSize} học sinh có đủ bằng chứng ({Math.round(gap.rate * 100)}%) — vượt
                ngưỡng chính sách {Math.round(gap.thresholdRate * 100)}% và tối thiểu{' '}
                {gap.thresholdCount} học sinh. Đề xuất: dạy lại chủ đề này cho cả lớp.
              </li>
            ))}
          </ul>
        ) : (
          <p className="placeholder-note">
            Không có gốc nào vượt ngưỡng chính sách toàn lớp hiện tại.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Nhóm theo nhu cầu (xếp theo ưu tiên minh bạch)</h2>
        <p>
          Điểm ưu tiên = số học sinh đủ bằng chứng × số kỹ năng phía sau bị chặn. Không dùng yếu tố
          nhân khẩu học hay điểm số mờ.
        </p>
        {groups.map((group) => (
          <article className="card" key={group.id}>
            <h3>
              {GROUP_STATUS_LABELS[group.status] ?? group.status}
              {group.rootKcId ? ` — ${kcName(group.rootKcId)} (${group.rootKcId})` : ''}
            </h3>
            <ul>
              <li>Số học sinh: {group.totalLearnerCount}</li>
              <li>Đủ bằng chứng trực tiếp: {group.sufficientEvidenceCount}</li>
              <li>Số kỹ năng phía sau bị chặn: {group.blockedDescendantCount}</li>
              <li>Điểm ưu tiên: {group.priorityScore}</li>
              <li>Hành động đề xuất: {actionLabel(group.suggestedActionId)}</li>
            </ul>
            <details>
              <summary>Danh sách học sinh ({group.learnerIds.length})</summary>
              <p>{group.learnerIds.join(', ')}</p>
            </details>
            {group.representativeEventIds.length > 0 ? (
              <details>
                <summary>Bằng chứng đại diện</summary>
                <ul>
                  {group.representativeEventIds.map((id) => (
                    <li key={id}>
                      <code>{id}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
