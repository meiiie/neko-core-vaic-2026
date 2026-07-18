import { useState } from 'react';
import { Link } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH } from '../../content';
import { priorityBand, TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';
import { useTeacherDashboard } from './useTeacherDashboard';

export function TeacherClassPage() {
  const { dashboard } = useTeacherDashboard();
  const [topic, setTopic] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const filteredGroups = groups.filter((group) => {
    if (topic !== 'ALL' && group.rootKcId !== topic) return false;
    if (priority !== 'ALL' && priorityBand(group.priorityScore) !== priority) return false;
    return true;
  });

  return (
    <div className="page-stack teacher-class-page">
      <header className="page-heading">
        <h1>Nhóm học sinh cần hỗ trợ</h1>
        <p className="page-meta">
          Lớp 7A · {dashboard.learners.length} học sinh · Chọn một nhóm để xem học sinh đang vướng ở
          đâu và giao bài phù hợp.
        </p>
      </header>

      <section className="teacher-filter-bar" aria-label="Lọc nhóm học sinh">
        <label>
          Bài học
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="ALL">Tất cả bài học</option>
            {HERO_GRAPH.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mức cần hỗ trợ
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="ALL">Tất cả nhóm</option>
            <option value="SUPPORT_FIRST">Cần hỗ trợ trước</option>
            <option value="MONITOR">Có thể xem sau</option>
          </select>
        </label>
        <p role="status">Có {filteredGroups.length} nhóm</p>
      </section>

      <section className="group-table" aria-label="Danh sách nhóm cần hỗ trợ">
        {filteredGroups.map((group, index) => {
          const groupName = group.rootKcId
            ? kcName(group.rootKcId)
            : TEACHER_GROUP_LABELS[group.status];
          return (
            <article className="intervention-row" key={group.id}>
              <Link
                className="intervention-summary"
                to={`/teacher/class/${encodeURIComponent(group.id)}`}
                aria-label={`Xem chi tiết nhóm ${groupName}`}
              >
                <span className="rank-cell" aria-label={`Thứ tự ${index + 1}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="intervention-copy">
                  <span className="eyebrow">
                    {TEACHER_GROUP_LABELS[group.status] ?? group.status}
                  </span>
                  <span className="intervention-title" role="heading" aria-level={2}>
                    <strong>{group.rootKcId ? 'Bài:' : 'Nhóm:'}</strong> {groupName}
                  </span>
                  <span className="intervention-guidance">
                    <strong>Gợi ý:</strong> {teacherActionLabel(group.suggestedActionId)}
                  </span>
                </span>
                <span className="intervention-metrics">
                  <span>
                    <small>Học sinh</small>
                    <strong>{group.totalLearnerCount}</strong>
                  </span>
                  <span>
                    <small>Đã có đủ dữ liệu</small>
                    <strong>
                      {group.sufficientEvidenceCount}/{group.totalLearnerCount}
                    </strong>
                  </span>
                  <span>
                    <small>Cần làm trước?</small>
                    <strong>{group.priorityScore > 0 ? 'Có' : 'Chưa'}</strong>
                  </span>
                </span>
                <span className="intervention-disclosure-label">Xem chi tiết</span>
              </Link>
            </article>
          );
        })}
      </section>

      {filteredGroups.length === 0 ? (
        <section className="empty-state" role="status">
          <h2>Không có nhóm phù hợp</h2>
          <p>Thử chọn bài học khác hoặc xem tất cả nhóm.</p>
        </section>
      ) : null}
    </div>
  );
}
