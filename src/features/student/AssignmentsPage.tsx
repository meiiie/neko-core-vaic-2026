import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buildConfirmedAssignmentRecord,
  buildConfirmedReviewScheduleRecord,
  type ConfirmedAssignmentEvent,
  type ConfirmedReviewScheduleEvent,
} from '../../app/adapters/hero-tutor';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { useSession } from '../../app/session';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import { recordConfirmedAnswerWithReview } from '../../services/sync';

interface ApiAssignment {
  id: string;
  title: string;
  teacherMessage: string;
  questionCount: number;
  myAnswerCount: number;
}

interface ApiChoice {
  id: string;
  label: string;
}

interface ApiAssignmentDetail {
  id: string;
  title: string;
  teacherMessage: string;
  questions: { id: string; kcId: string; prompt: string; choices: ApiChoice[] }[];
}

interface GradeResult {
  correct: boolean;
  correctChoiceId: string;
  explanation: string;
  note: string | null;
  hints: string[];
  event: ConfirmedAssignmentEvent;
  reviewEvent: ConfirmedReviewScheduleEvent;
}

/** Student view: assignments handed out by the teacher, fetched live. */
export function AssignmentsPage() {
  const [assignments, setAssignments] = useState<ApiAssignment[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/assignments', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { assignments: ApiAssignment[] };
        if (!cancelled) setAssignments(body.assignments);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Bài được giao</p>
        <h1>Bài tập từ giáo viên</h1>
        <p>Danh sách lấy trực tiếp từ máy chủ lớp học.</p>
      </header>
      {error ? (
        <p role="alert" className="error-message">
          Không tải được bài được giao — cần kết nối mạng cho mục này. Phần Luyện tập vẫn hoạt động
          ngoại tuyến.
        </p>
      ) : null}
      {assignments === null && !error ? <p>Đang tải…</p> : null}
      <ul className="question-bank-list">
        {(assignments ?? []).map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.title}</strong>
            <span>
              {assignment.questionCount} câu · em đã trả lời {assignment.myAnswerCount} lần
            </span>
            {assignment.teacherMessage ? (
              <div className="student-assignment-message">
                <strong>Lời nhắn của giáo viên</strong>
                <p>{assignment.teacherMessage}</p>
              </div>
            ) : null}
            <Link className="button-primary" to={`/student/assignments/${assignment.id}`}>
              {assignment.myAnswerCount > 0 ? 'Làm tiếp' : 'Bắt đầu làm'}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Take one assignment: server grades each answer and returns real feedback. */
export function AssignmentTakePage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [detail, setDetail] = useState<ApiAssignmentDetail | null>(null);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [evidenceSaveError, setEvidenceSaveError] = useState(false);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    void fetch(`/api/assignments/${assignmentId}`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as ApiAssignmentDetail;
        if (!cancelled) {
          setDetail(body);
          void fetch(`/api/assignments/${assignmentId}/open`, {
            method: 'POST',
            credentials: 'include',
          }).catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  if (migrationError) {
    return <StudentDataFailure onRetry={retryMigration} />;
  }

  if (error) {
    return (
      <div className="page-stack">
        <p role="alert" className="error-message">
          Không tải được bài — kiểm tra kết nối rồi thử lại.
        </p>
        <Link className="button-secondary" to="/student/assignments">
          Về danh sách bài
        </Link>
      </div>
    );
  }
  if (!detail || !learnerContext || localRecords === undefined) {
    return <div className="page-loading" aria-label="Đang tải bài được giao" />;
  }

  const activeLearnerContext = learnerContext;
  const activeLocalRecords = localRecords;

  const question = detail.questions[index];
  const finished = index >= detail.questions.length;

  async function submit() {
    if (!question || !choiceId || busy) return;
    setBusy(true);
    setEvidenceSaveError(false);
    try {
      const response = await fetch(`/api/assignments/${detail?.id}/answers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, choiceId }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as GradeResult;
      try {
        const record = buildConfirmedAssignmentRecord(
          activeLearnerContext,
          result.event,
          activeLocalRecords.length,
        );
        const reviewRecord = buildConfirmedReviewScheduleRecord(
          activeLearnerContext,
          result.reviewEvent,
          activeLocalRecords.length + 1,
        );
        if (!record || !reviewRecord) throw new Error('EVENT_ACCOUNT_MISMATCH');
        await recordConfirmedAnswerWithReview(record, reviewRecord);
      } catch {
        // The server already accepted the answer. Keep its feedback visible,
        // but never pretend the local diagnosis evidence was saved.
        setEvidenceSaveError(true);
      }
      setGrade(result);
    } catch {
      setGrade(null);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setGrade(null);
    setChoiceId(null);
    setIndex((current) => current + 1);
  }

  return (
    <div className="assessment-page">
      <header className="assessment-header">
        <div>
          <p className="eyebrow">Bài được giao</p>
          <h1>{detail.title}</h1>
          <p>Máy chủ chấm từng câu và lưu bài làm của em cho giáo viên.</p>
        </div>
        <span className="status-label status-label--neutral">
          Câu {Math.min(index + 1, detail.questions.length)}/{detail.questions.length}
        </span>
      </header>

      {detail.teacherMessage ? (
        <aside className="student-assignment-message student-assignment-message--detail">
          <strong>Lời nhắn của giáo viên</strong>
          <p>{detail.teacherMessage}</p>
        </aside>
      ) : null}

      {finished ? (
        <section className="completion-panel">
          <span className="completion-mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">Đã nộp toàn bộ</p>
          <h2>Em đã hoàn thành «{detail.title}»</h2>
          <p>Kết quả đã được ghi nhận trên máy chủ — giáo viên nhìn thấy tiến độ của em.</p>
          <Link className="button-primary" to="/student/assignments">
            Về danh sách bài
          </Link>
        </section>
      ) : (
        <section className="question-panel" aria-labelledby="assignment-question">
          <header>
            <span className="question-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="eyebrow">Chọn một đáp án rồi bấm Nộp</p>
              <h2 id="assignment-question">{question.prompt}</h2>
            </div>
          </header>

          <div className="answer-list" role="radiogroup" aria-labelledby="assignment-question">
            {question.choices.map((choice, choiceIndex) => {
              const stateClass = grade
                ? choice.id === grade.correctChoiceId
                  ? 'is-correct'
                  : choice.id === choiceId
                    ? 'is-wrong'
                    : ''
                : '';
              return (
                <button
                  key={choice.id}
                  className={`answer-choice ${stateClass}`}
                  data-selected={choiceId === choice.id || undefined}
                  type="button"
                  role="radio"
                  aria-checked={choiceId === choice.id}
                  disabled={grade !== null}
                  onClick={() => setChoiceId(choice.id)}
                >
                  <span className="choice-key" aria-hidden="true">
                    {String.fromCharCode(65 + choiceIndex)}
                  </span>
                  <span>{choice.label}</span>
                </button>
              );
            })}
          </div>

          {grade === null ? (
            <footer className="question-actions">
              <Link className="button-secondary" to="/student/assignments">
                Lưu và thoát
              </Link>
              <button
                className="button-primary"
                type="button"
                disabled={!choiceId || busy}
                onClick={() => void submit()}
              >
                {busy ? 'Đang nộp…' : 'Nộp câu trả lời'}
              </button>
            </footer>
          ) : (
            <section
              className={grade.correct ? 'feedback-panel is-correct' : 'feedback-panel is-wrong'}
              role="status"
            >
              <h3>{grade.correct ? 'Chính xác!' : 'Chưa đúng'}</h3>
              {grade.correct && grade.explanation ? <p>{grade.explanation}</p> : null}
              {!grade.correct && grade.note ? <p>{grade.note}</p> : null}
              {!grade.correct && grade.hints.length > 0 ? (
                <div className="hint-ladder">
                  <p className="eyebrow">Gợi ý</p>
                  <p>{grade.hints[0]}</p>
                </div>
              ) : null}
              {evidenceSaveError ? (
                <p className="error-message" role="alert">
                  Kết quả đã được nộp cho giáo viên, nhưng thiết bị chưa lưu được bằng chứng để cập
                  nhật lộ trình cá nhân.
                </p>
              ) : null}
              <button className="button-primary" type="button" onClick={next}>
                {index + 1 < detail.questions.length ? 'Câu tiếp theo' : 'Hoàn tất'}
              </button>
            </section>
          )}
        </section>
      )}
    </div>
  );
}
