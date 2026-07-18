import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchStudentDetail,
  type TeacherClassDto,
  type TeacherStudentDetailDto,
} from './teacher-api';

const STATUS_LABELS = {
  NOT_ASSIGNED: 'Chưa giao bài',
  NOT_STARTED: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Đã hoàn thành',
  NEEDS_SUPPORT: 'Cần ôn lại',
} as const;

export function TeacherStudentDetailPage() {
  const { studentId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';
  const [data, setData] = useState<{
    class: TeacherClassDto;
    student: TeacherStudentDetailDto;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    if (!classId || !studentId) {
      return () => controller.abort();
    }
    void fetchStudentDetail(classId, studentId, controller.signal)
      .then((next) => setData(next))
      .catch(() => {
        if (!controller.signal.aborted) setError('Không tải được tiến độ học sinh từ máy chủ.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [classId, studentId]);

  if (!classId || !studentId)
    return (
      <section className="empty-state" role="alert">
        <h1>Chưa xem được học sinh này</h1>
        <p>Thiếu thông tin lớp hoặc học sinh.</p>
        <Link className="button-secondary" to="/teacher/students">
          Quay lại quản lý học sinh
        </Link>
      </section>
    );
  if (loading)
    return (
      <section className="empty-state" role="status">
        <h1>Đang tải tiến độ học sinh</h1>
      </section>
    );
  if (error || !data)
    return (
      <section className="empty-state" role="alert">
        <h1>Chưa xem được học sinh này</h1>
        <p>{error}</p>
        <Link className="button-secondary" to="/teacher/students">
          Quay lại quản lý học sinh
        </Link>
      </section>
    );

  const { student, class: classroom } = data;
  const assignedLessons = student.lessonProgress.filter((lesson) => lesson.assignedCount > 0);
  const answeredTotal = student.lessonProgress.reduce(
    (total, lesson) => total + lesson.answeredCount,
    0,
  );
  const correctTotal = student.lessonProgress.reduce(
    (total, lesson) => total + lesson.correctCount,
    0,
  );
  const topRecommendation = student.recommendedLessons[0];

  return (
    <div className="page-stack student-detail-page">
      <Link className="back-link" to={`/teacher/students?classId=${encodeURIComponent(classId)}`}>
        ← Quay lại {classroom.name}
      </Link>
      <header className="page-heading">
        <p className="eyebrow">Tiến độ học tập · {classroom.name}</p>
        <h1>{student.name}</h1>
        <p>{student.email}</p>
      </header>

      <section className="metric-grid student-detail-metrics" aria-label="Tóm tắt tiến độ">
        <article className="metric-card">
          <span>Bài đã được giao</span>
          <strong>{assignedLessons.length}</strong>
          <small>nội dung học tập</small>
        </article>
        <article className="metric-card">
          <span>Câu đã trả lời</span>
          <strong>{answeredTotal}</strong>
          <small>dữ liệu thật từ bài làm</small>
        </article>
        <article className="metric-card">
          <span>Tỉ lệ trả lời đúng</span>
          <strong>
            {answeredTotal ? `${Math.round((correctTotal / answeredTotal) * 100)}%` : '—'}
          </strong>
          <small>
            {correctTotal}/{answeredTotal} câu
          </small>
        </article>
      </section>

      {topRecommendation ? (
        <section
          className="student-recommendation"
          aria-labelledby="student-recommendation-heading"
        >
          <p className="eyebrow">Gợi ý từ bài làm gần nhất</p>
          <h2 id="student-recommendation-heading">Nên ôn lại: {topRecommendation.lessonName}</h2>
          <p>
            Hệ thống gợi ý vì học sinh chỉ trả lời đúng {topRecommendation.reason}. Cô có thể xem bộ
            câu hỏi đã chọn trước khi giao.
          </p>
          <Link
            className="button-primary"
            to={`/teacher/assignments?classId=${encodeURIComponent(classId)}&learner=${encodeURIComponent(student.id)}&kc=${encodeURIComponent(topRecommendation.kcId)}`}
            state={{ questionIds: topRecommendation.recommendedQuestionIds }}
          >
            Xem bài ôn được gợi ý
          </Link>
        </section>
      ) : (
        <section className="summary-panel compact-empty" role="status">
          <h2>Chưa có dấu hiệu cần giao thêm bài ôn</h2>
          <p>Gợi ý chỉ xuất hiện khi có ít nhất 2 câu trả lời và tỉ lệ đúng dưới 60%.</p>
        </section>
      )}

      <section className="summary-panel">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Theo từng bài học</p>
            <h2>Tiến độ và kết quả</h2>
          </div>
        </header>
        <div className="lesson-progress-list">
          {student.lessonProgress.map((lesson) => (
            <article
              key={lesson.kcId}
              data-attention={lesson.status === 'NEEDS_SUPPORT' || undefined}
            >
              <div>
                <strong>Bài: {lesson.lessonName}</strong>
                <small>
                  {lesson.answeredCount}/{lesson.assignedCount} câu đã làm
                  {lesson.correctRate === null
                    ? ''
                    : ` · ${Math.round(lesson.correctRate * 100)}% đúng`}
                </small>
              </div>
              <div className="progress-track">
                <span style={{ width: `${lesson.progressPercent}%` }} />
              </div>
              <span
                className={
                  lesson.status === 'NEEDS_SUPPORT'
                    ? 'status-pill status-pill--attention'
                    : 'status-pill'
                }
              >
                {STATUS_LABELS[lesson.status]}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="summary-panel">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Bài từ giáo viên</p>
            <h2>Bài đã giao và lời nhắn</h2>
          </div>
        </header>
        {student.assignedWork.length === 0 ? (
          <div className="compact-empty">
            <p>Chưa có bài nào được giao riêng hoặc giao cho cả lớp.</p>
          </div>
        ) : (
          <div className="assigned-work-list">
            {student.assignedWork.map((assignment) => (
              <article key={assignment.id}>
                <div>
                  <strong>{assignment.title}</strong>
                  <small>
                    {assignment.answeredCount}/{assignment.questionCount} câu đã làm ·{' '}
                    {STATUS_LABELS[assignment.status]}
                  </small>
                </div>
                {assignment.teacherMessage ? (
                  <blockquote>“{assignment.teacherMessage}”</blockquote>
                ) : (
                  <p>Không có lời nhắn.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
