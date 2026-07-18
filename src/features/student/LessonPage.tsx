import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { refreshLessons, useLesson } from '../../services/lessons';

/**
 * EXPLAIN step of the learning loop (Explain → Practice → Post-check). The
 * material is a real server-owned row the teacher can edit; this page reads
 * the device mirror, so once refreshed it opens fully offline. Team-seeded
 * drafts carry the mandatory not-yet-reviewed label; a teacher edit replaces
 * it with their name.
 */
export function LessonPage() {
  const { kcId = '' } = useParams();
  const state = useLesson(kcId);
  const [retrying, setRetrying] = useState(false);

  if (state === undefined) {
    return <div className="page-loading" aria-label="Đang mở tài liệu" />;
  }

  const lesson = state.lesson;
  if (!lesson) {
    return (
      <section className="empty-state">
        <h1>Tài liệu chưa có trên thiết bị này</h1>
        <p>Lần tải đầu tiên cần có mạng; sau đó tài liệu mở được cả khi ngoại tuyến.</p>
        <button
          className="button-primary"
          type="button"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            void refreshLessons().finally(() => setRetrying(false));
          }}
        >
          {retrying ? 'Đang tải…' : 'Tải tài liệu'}
        </button>{' '}
        <Link className="button-secondary" to="/student/path">
          Về lộ trình học
        </Link>
      </section>
    );
  }

  return (
    <div className="page-stack lesson-page">
      <header className="page-heading">
        <p className="eyebrow">Tóm tắt kiến thức · Toán 7</p>
        <h1>{lesson.title}</h1>
        <p className="page-meta">
          Đọc trong khoảng 2 phút · Lưu sẵn trên thiết bị, mở được khi mất mạng
        </p>
      </header>

      <section className="summary-panel lesson-panel" aria-labelledby="lesson-key-points">
        <h2 id="lesson-key-points">Ý chính cần nhớ</h2>
        <ul className="lesson-points">
          {lesson.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="summary-panel lesson-panel" aria-labelledby="lesson-example">
        <h2 id="lesson-example">Ví dụ có lời giải</h2>
        <p className="lesson-problem">{lesson.exampleProblem}</p>
        <ol className="lesson-steps">
          {lesson.exampleSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section
        className="summary-panel lesson-panel lesson-panel--mistake"
        aria-labelledby="lesson-mistake"
      >
        <h2 id="lesson-mistake">Lỗi thường gặp</h2>
        <p>{lesson.commonMistake}</p>
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
        {lesson.status === 'PUBLISHED'
          ? `Tài liệu do ${lesson.updatedByName ?? 'giáo viên'} cập nhật.`
          : 'Bản nháp do đội biên soạn theo định hướng GDPT 2018 — chưa được giáo viên duyệt.'}
      </p>
    </div>
  );
}
