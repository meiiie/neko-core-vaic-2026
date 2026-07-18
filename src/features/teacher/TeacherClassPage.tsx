import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH } from '../../content';
import { priorityBand, TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';
import { useTeacherDashboard } from './useTeacherDashboard';

export function TeacherClassPage() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId');
  const { dashboard, loading, error, refresh } = useTeacherDashboard(classId ?? undefined);
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
        <h1>Bài học có học sinh cần ôn</h1>
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
          <h2 id="teacher-workflow-heading">Biết bài nào cần ôn và những em nào đang gặp khó</h2>
          <p>
            Hệ thống đọc bài làm đã lưu trên máy chủ, gom các em có dấu hiệu sai gần giống nhau theo
            từng bài học và đề xuất một bài ôn để cô kiểm tra.
          </p>
        </div>
        <ol>
          <li>
            <strong>1. Hệ thống phát hiện</strong>
            <span>Mỗi thẻ là một bài học có học sinh cần xem lại.</span>
          </li>
          <li>
            <strong>2. Cô kiểm tra</strong>
            <span>Mở bài học để xem đúng học sinh và lỗi thường gặp.</span>
          </li>
          <li>
            <strong>3. Xác nhận bài ôn</strong>
            <span>Xem gói câu hỏi hệ thống chọn sẵn, chỉnh nếu cần rồi giao.</span>
          </li>
        </ol>
      </section>

      {dashboard.answerEventCount === 0 ? (
        <section className="empty-state teacher-no-evidence" role="status">
          <p className="eyebrow">Chưa có bài làm trên máy chủ</p>
          <h2>Chưa thể xác định bài học cần ôn</h2>
          <p>
            Khi học sinh hoàn thành bài kiểm tra, hệ thống sẽ dùng câu trả lời thật để tạo nhóm.
          </p>
          <Link
            className="button-primary"
            to={`/teacher/assignments${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`}
          >
            Giao bài kiểm tra nhanh
          </Link>
        </section>
      ) : null}

      {dashboard.answerEventCount > 0 ? (
        <section className="teacher-filter-bar" aria-label="Lọc bài học cần ôn">
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
          <p role="status">Có {filteredGroups.length} bài học</p>
        </section>
      ) : null}

      {dashboard.answerEventCount > 0 ? (
        <section className="group-table" aria-label="Danh sách bài học cần ôn">
          {filteredGroups.map((group, index) => {
            const groupName = group.rootKcId
              ? kcName(group.rootKcId)
              : TEACHER_GROUP_LABELS[group.status];
            return (
              <article className="intervention-row" key={group.id}>
                <Link
                  className="intervention-summary"
                  to={`/teacher/class/${encodeURIComponent(group.id)}${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`}
                  aria-label={`Xem học sinh và gợi ý ôn bài ${groupName}`}
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
                      <strong>Phương án đề xuất:</strong>{' '}
                      {teacherActionLabel(group.suggestedActionId)}
                    </span>
                    {group.wrongQuestions[0] ? (
                      <span className="intervention-common-error">
                        <strong>Lỗi thường gặp:</strong> {group.wrongQuestions[0].prompt}
                      </span>
                    ) : null}
                  </span>
                  <span className="intervention-metrics">
                    <span>
                      <small>Học sinh cần ôn</small>
                      <strong>{group.totalLearnerCount}</strong>
                    </span>
                    <span>
                      <small>Tỷ lệ trong số đã làm</small>
                      <strong>{Math.round(group.reviewLearnerRate * 100)}%</strong>
                    </span>
                    <span>
                      <small>Câu trả lời sai</small>
                      <strong>
                        {group.wrongAnswerCount}/{group.evidenceAnswerCount}
                      </strong>
                    </span>
                  </span>
                  <span className="intervention-disclosure-label">Xem học sinh và gợi ý</span>
                </Link>
              </article>
            );
          })}
        </section>
      ) : null}

      {dashboard.answerEventCount > 0 && filteredGroups.length === 0 ? (
        <section className="empty-state" role="status">
          <h2>Không có bài học phù hợp</h2>
          <p>Thử chọn bài học khác hoặc xem tất cả nhóm.</p>
        </section>
      ) : null}
    </div>
  );
}
