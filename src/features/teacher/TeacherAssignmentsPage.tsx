import { useCallback, useEffect, useState } from 'react';

interface ApiQuestionSummary {
  id: string;
  kcId: string;
  prompt: string;
}

interface ApiAssignment {
  id: string;
  title: string;
  createdAt: string;
  questionCount: number;
  submittedLearnerCount: number;
  rosterCount: number;
}

/** Teacher assignment flow: pick real bank questions, hand them to class 7A. */
export function TeacherAssignmentsPage() {
  const [questions, setQuestions] = useState<ApiQuestionSummary[]>([]);
  const [assignments, setAssignments] = useState<ApiAssignment[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [questionsRes, assignmentsRes] = await Promise.all([
        fetch('/api/questions', { credentials: 'include' }),
        fetch('/api/assignments', { credentials: 'include' }),
      ]);
      if (!questionsRes.ok || !assignmentsRes.ok) throw new Error('load');
      const questionsBody = (await questionsRes.json()) as { questions: ApiQuestionSummary[] };
      const assignmentsBody = (await assignmentsRes.json()) as { assignments: ApiAssignment[] };
      setQuestions(questionsBody.questions);
      setAssignments(assignmentsBody.assignments);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state set only after await
    void reload();
  }, [reload]);

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (selected.size === 0) return;
    setState('saving');
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, questionIds: [...selected] }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setTitle('');
      setSelected(new Set());
      setState('saved');
      await reload();
    } catch {
      setState('error');
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Giao bài</p>
        <h1>Giao bài trắc nghiệm cho lớp 7A</h1>
        <p>
          Chọn câu hỏi từ ngân hàng, đặt tên bài và giao — học sinh thấy ngay ở mục Bài được giao.
        </p>
      </header>

      {loadError ? (
        <p role="alert" className="error-message">
          Không tải được dữ liệu từ máy chủ.
        </p>
      ) : null}

      <section className="summary-panel">
        <h2>Tạo bài giao mới</h2>
        <form className="question-form" onSubmit={(event) => void submit(event)}>
          <label>
            Tên bài
            <input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Luyện tỉ số bằng nhau — tuần 3"
            />
          </label>
          <fieldset className="assign-picker">
            <legend>Chọn câu hỏi ({selected.size} đã chọn)</legend>
            {questions.map((question) => (
              <label key={question.id} className="assign-option">
                <input
                  type="checkbox"
                  checked={selected.has(question.id)}
                  onChange={() => toggle(question.id)}
                />
                <span>
                  <strong>{question.kcId}</strong> — {question.prompt}
                </span>
              </label>
            ))}
          </fieldset>
          <button
            className="button-primary"
            type="submit"
            disabled={state === 'saving' || selected.size === 0}
          >
            {state === 'saving' ? 'Đang giao…' : 'Giao cho lớp 7A'}
          </button>
          {state === 'saved' ? <p role="status">Đã giao bài cho lớp.</p> : null}
          {state === 'error' ? (
            <p role="alert" className="error-message">
              Không giao được bài — thử lại.
            </p>
          ) : null}
        </form>
      </section>

      <section className="summary-panel">
        <h2>Bài đã giao {assignments ? `(${assignments.length})` : ''}</h2>
        {assignments === null && !loadError ? <p>Đang tải…</p> : null}
        <ul className="question-bank-list">
          {(assignments ?? []).map((assignment) => (
            <li key={assignment.id}>
              <strong>{assignment.title}</strong>
              <span>
                {assignment.questionCount} câu • {assignment.submittedLearnerCount}/
                {assignment.rosterCount} học sinh đã nộp bài làm
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
