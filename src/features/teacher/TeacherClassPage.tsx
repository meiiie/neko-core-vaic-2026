import { useState } from 'react';
import { Link } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH } from '../../content';
import { priorityBand, TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';
import { useTeacherDashboard } from './useTeacherDashboard';

export function TeacherClassPage() {
  const { dashboard, loading, error, refresh } = useTeacherDashboard();
  const [topic, setTopic] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const filteredGroups = groups.filter((group) => {
    if (topic !== 'ALL' && group.rootKcId !== topic) return false;
    if (priority !== 'ALL' && priorityBand(group.priorityScore) !== priority) return false;
    return true;
  });

  if (loading) {
    return (
      <section className="empty-state" role="status">
        <h1>Đang lấy dữ liệu lớp</h1>
        <p>Hệ thống đang đọc bài làm mới nhất từ máy chủ.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state" role="alert">
        <h1>Chưa tải được dữ liệu lớp</h1>
        <p>{error} Dữ liệu mô phỏng sẽ không được dùng thay thế.</p>
        <button className="button-secondary" type="button" onClick={() => void refresh()}>
          Thử tải lại
        </button>
      </section>
    );
  }

  return (
    <div className="page-stack teacher-class-page">
      <header className="page-heading">
        <h1>Nhóm học sinh cần hỗ trợ</h1>
        <p className="page-meta">
          {dashboard.className} · {dashboard.rosterCount} học sinh · Dữ liệu từ máy chủ
          {dashboard.latestAnswerAt
            ? ` · Bài làm mới nhất ${new Date(dashboard.latestAnswerAt).toLocaleString('vi-VN')}`
            : ''}
        </p>
      </header>

      <section className="teacher-workflow-intro" aria-labelledby="teacher-workflow-heading">
        <div>
          <p className="eyebrow">Mục đích của trang</p>
          <h2 id="teacher-workflow-heading">Tìm nhóm học sinh đang cùng vướng một nội dung</h2>
          <p>
            Hệ thống chỉ tạo nhóm từ các câu trả lời đã lưu trên máy chủ. Cô kiểm tra bằng chứng
            trước, rồi chọn cách hỗ trợ phù hợp.
          </p>
        </div>
        <ol>
          <li>
            <strong>1. Chọn nhóm</strong>
            <span>Xem bài học mà nhiều em đang gặp khó khăn.</span>
          </li>
          <li>
            <strong>2. Xem câu trả lời</strong>
            <span>Kiểm tra từng em đã chọn gì và đáp án đúng.</span>
          </li>
          <li>
            <strong>3. Hỗ trợ</strong>
            <span>Giao bài ôn hoặc điều chỉnh gợi ý của hệ thống.</span>
          </li>
        </ol>
      </section>

      {dashboard.answerEventCount === 0 ? (
        <section className="empty-state teacher-no-evidence" role="status">
          <p className="eyebrow">Chưa có bài làm trên máy chủ</p>
          <h2>Chưa thể tạo nhóm cần hỗ trợ</h2>
          <p>
            Khi học sinh hoàn thành bài kiểm tra, hệ thống sẽ dùng câu trả lời thật để tạo nhóm.
          </p>
          <Link className="button-primary" to="/teacher/assignments">
            Giao bài kiểm tra nhanh
          </Link>
        </section>
      ) : null}

      {dashboard.answerEventCount > 0 ? (
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
      ) : null}

      {dashboard.answerEventCount > 0 ? (
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
                  aria-label={`Xem chi tiết và hỗ trợ nhóm ${groupName}`}
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
                  <span className="intervention-disclosure-label">Xem chi tiết và hỗ trợ</span>
                </Link>
              </article>
            );
          })}
        </section>
      ) : null}

      {dashboard.answerEventCount > 0 && filteredGroups.length === 0 ? (
        <section className="empty-state" role="status">
          <h2>Không có nhóm phù hợp</h2>
          <p>Thử chọn bài học khác hoặc xem tất cả nhóm.</p>
        </section>
      ) : null}
    </div>
  );
}
