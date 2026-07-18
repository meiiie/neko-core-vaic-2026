import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildResourceViewedRecord, gradeBandVi } from '../../app/adapters/student-learning-plan';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { useSession } from '../../app/session';
import { curriculumCatalogDraft } from '../../content';
import { refreshLessons, useLesson } from '../../services/lessons';
import { appendEvent } from '../../storage/event-repository';
import { LessonResources } from './LessonResources';

/**
 * EXPLAIN step of the learning loop (Explain → Practice → Post-check). The
 * material is a real server-owned row the teacher can edit; this page reads
 * the device mirror, so once refreshed it opens fully offline. Team-seeded
 * drafts carry the mandatory not-yet-reviewed label; a teacher edit replaces
 * it with their name.
 */
export function LessonPage() {
  const { kcId = '' } = useParams();
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const { records } = useStudentEvents(learnerContext);
  const state = useLesson(kcId);
  const [retrying, setRetrying] = useState(false);
  const lesson = state?.lesson;
  const curriculumNode = curriculumCatalogDraft.find((node) => node.id === kcId);
  const targetNode = curriculumCatalogDraft.find((node) => node.id === 'K10');
  const grades = [...new Set(curriculumNode?.anchors.map((anchor) => anchor.grade) ?? [])];

  useEffect(() => {
    if (!lesson || !learnerContext || !records) return;
    const viewed = buildResourceViewedRecord(learnerContext.learnerId, kcId, records);
    if (records.some((record) => record.id === viewed.id)) return;
    void appendEvent(viewed).catch(() => undefined);
  }, [kcId, learnerContext, lesson, records]);

  if (state === undefined) {
    return <div className="page-loading" aria-label="Đang mở tài liệu" />;
  }

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
        <p className="eyebrow">
          {gradeBandVi(grades)} · phục vụ {targetNode?.titleVi ?? 'mục tiêu'} lớp 7
        </p>
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

      <LessonResources kcId={lesson.kcId} />

      <div className="lesson-actions">
        <Link className="button-primary" to={`/student/practice?phase=guided&kc=${lesson.kcId}`}>
          Luyện có gợi ý
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
