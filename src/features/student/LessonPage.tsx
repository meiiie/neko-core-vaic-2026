import { Link, useParams } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { lessonForKc } from '../../content';

/**
 * EXPLAIN step of the learning loop (Explain → Practice → Post-check),
 * adapted from LMS_hohulili's lesson sections. The summary ships inside the
 * content pack, so it opens fully offline. Content is team-authored and
 * UNREVIEWED — the draft label is mandatory on this surface.
 */
export function LessonPage() {
  const { kcId = '' } = useParams();
  const lesson = lessonForKc(kcId);

  if (!lesson) {
    return (
      <section className="empty-state">
        <h1>Chưa có tóm tắt cho phần này</h1>
        <p>Bài học này chưa được biên soạn. Em có thể quay lại lộ trình để chọn bước khác.</p>
        <Link className="button-primary" to="/student/path">
          Về lộ trình học
        </Link>
      </section>
    );
  }

  return (
    <div className="page-stack lesson-page">
      <header className="page-heading">
        <p className="eyebrow">Tóm tắt kiến thức · {kcName(lesson.kcId)}</p>
        <h1>{lesson.titleVi}</h1>
        <p className="page-meta">
          Đọc trong khoảng 2 phút · Lưu sẵn trên thiết bị, mở được khi mất mạng
        </p>
      </header>

      <section className="summary-panel lesson-panel" aria-labelledby="lesson-key-points">
        <h2 id="lesson-key-points">Ý chính cần nhớ</h2>
        <ul className="lesson-points">
          {lesson.keyPointsVi.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="summary-panel lesson-panel" aria-labelledby="lesson-example">
        <h2 id="lesson-example">Ví dụ có lời giải</h2>
        <p className="lesson-problem">{lesson.workedExampleVi.problem}</p>
        <ol className="lesson-steps">
          {lesson.workedExampleVi.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section
        className="summary-panel lesson-panel lesson-panel--mistake"
        aria-labelledby="lesson-mistake"
      >
        <h2 id="lesson-mistake">Lỗi thường gặp</h2>
        <p>{lesson.commonMistakeVi}</p>
      </section>

      <div className="lesson-actions">
        <Link className="button-primary" to="/student/practice">
          Bắt đầu luyện tập
        </Link>
        <Link className="button-secondary" to="/student/path">
          Về lộ trình học
        </Link>
      </div>

      <p className="data-footnote">
        Bản nháp do đội biên soạn theo định hướng GDPT 2018 — chưa được giáo viên duyệt.
      </p>
    </div>
  );
}
