import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { refreshLessons, saveLesson, useLessonList } from '../../services/lessons';
import { TeacherResourcePanel } from './TeacherResourcePanel';
import type { LessonRecord } from '../../storage/db';

/**
 * Teacher-owned lesson materials. Rows live on the server; saving publishes
 * the lesson under the teacher's name and every student device mirrors it on
 * the next refresh. Team-seeded drafts are the starting point, not the
 * product: this page exists so real teachers replace them.
 *
 * The selected skill lives in the URL (/teacher/lessons/K02) so a teacher can
 * bookmark or share exactly the material they are working on — the
 * LMS_hohulili course-editor routing pattern.
 */

interface FormState {
  title: string;
  keyPoints: string;
  exampleProblem: string;
  exampleSteps: string;
  commonMistake: string;
}

function toForm(lesson: LessonRecord): FormState {
  return {
    title: lesson.title,
    keyPoints: lesson.keyPoints.join('\n'),
    exampleProblem: lesson.exampleProblem,
    exampleSteps: lesson.exampleSteps.join('\n'),
    commonMistake: lesson.commonMistake,
  };
}

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function LessonForm({ lesson }: { readonly lesson: LessonRecord }) {
  const [form, setForm] = useState<FormState>(() => toForm(lesson));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveState === 'saving') return;
    setSaveState('saving');
    const result = await saveLesson(lesson.kcId, {
      title: form.title.trim(),
      keyPoints: lines(form.keyPoints),
      exampleProblem: form.exampleProblem.trim(),
      exampleSteps: lines(form.exampleSteps),
      commonMistake: form.commonMistake.trim(),
    });
    setSaveState(result === 'SAVED' ? 'saved' : 'error');
  }

  return (
    <form className="summary-panel question-form" onSubmit={(event) => void save(event)}>
      <div>
        <p className="eyebrow">Kỹ năng {lesson.kcId} · Toán 7</p>
        <h2>Soạn tài liệu tóm tắt</h2>
      </div>
      <label>
        Tiêu đề
        <input
          required
          minLength={4}
          maxLength={120}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label>
        Ý chính cần nhớ (mỗi dòng một ý)
        <textarea
          required
          rows={4}
          value={form.keyPoints}
          onChange={(event) => setForm({ ...form, keyPoints: event.target.value })}
        />
      </label>
      <label>
        Bài toán ví dụ
        <textarea
          required
          rows={2}
          value={form.exampleProblem}
          onChange={(event) => setForm({ ...form, exampleProblem: event.target.value })}
        />
      </label>
      <label>
        Các bước giải (mỗi dòng một bước)
        <textarea
          required
          rows={4}
          value={form.exampleSteps}
          onChange={(event) => setForm({ ...form, exampleSteps: event.target.value })}
        />
      </label>
      <label>
        Lỗi thường gặp cần nhắc học sinh
        <textarea
          required
          rows={2}
          value={form.commonMistake}
          onChange={(event) => setForm({ ...form, commonMistake: event.target.value })}
        />
      </label>
      <div className="inline-actions">
        <button className="button-primary" type="submit" disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'Đang lưu…' : 'Lưu và phát cho lớp'}
        </button>
        {saveState === 'saved' ? (
          <span role="status">Đã lưu — học sinh nhận bản mới ở lần đồng bộ tới.</span>
        ) : null}
        {saveState === 'error' ? (
          <span role="alert">Không lưu được. Kiểm tra mạng rồi thử lại.</span>
        ) : null}
      </div>
    </form>
  );
}

export function TeacherLessonsPage() {
  const lessons = useLessonList();
  const { kcId: selectedKcId } = useParams<{ kcId: string }>();
  const navigate = useNavigate();

  const selected =
    lessons && lessons.length > 0
      ? (lessons.find((lesson) => lesson.kcId === selectedKcId) ?? lessons[0])
      : null;

  if (lessons === undefined) {
    return <div className="page-loading" aria-label="Đang tải học liệu" />;
  }

  return (
    <div className="page-stack teacher-lessons-page">
      <header className="page-heading">
        <h1>Học liệu theo kỹ năng</h1>
        <p className="page-meta">
          Tài liệu cô lưu ở đây được phát tới thiết bị của học sinh và mở được khi các em mất mạng.
          Bản nháp do đội biên soạn — cô sửa và lưu để thay bằng nội dung của mình.
        </p>
      </header>

      {lessons.length === 0 ? (
        <section className="empty-state">
          <h2>Chưa tải được danh sách học liệu</h2>
          <p>Cần kết nối mạng cho lần tải đầu tiên.</p>
          <button className="button-primary" type="button" onClick={() => void refreshLessons()}>
            Tải lại
          </button>
        </section>
      ) : (
        <section className="lesson-admin-grid" aria-label="Soạn học liệu">
          <nav className="summary-panel lesson-admin-list" aria-label="Danh sách kỹ năng">
            {lessons.map((lesson) => (
              <button
                key={lesson.kcId}
                type="button"
                data-selected={lesson.kcId === selected?.kcId || undefined}
                onClick={() => void navigate(`/teacher/lessons/${lesson.kcId}`, { replace: true })}
              >
                <span>
                  <strong>{lesson.title}</strong>
                  <small>Kỹ năng {lesson.kcId}</small>
                </span>
                <span
                  className={`status-label ${
                    lesson.status === 'PUBLISHED'
                      ? 'status-label--evidence'
                      : 'status-label--review'
                  }`}
                >
                  {lesson.status === 'PUBLISHED' ? 'Đã cập nhật' : 'Nháp đội soạn'}
                </span>
              </button>
            ))}
          </nav>

          {selected ? (
            <div className="lesson-admin-detail">
              <LessonForm key={`${selected.kcId}:${selected.updatedAt}`} lesson={selected} />
              {/* Keyed remount resets the whole upload flow — a half-filled form
                  must never upload under a different kcId than is on screen. */}
              <TeacherResourcePanel key={selected.kcId} kcId={selected.kcId} />
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
