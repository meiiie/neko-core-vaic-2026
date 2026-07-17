import { useCallback, useEffect, useState } from 'react';
import { HERO_GRAPH } from '../../content';

interface ApiChoice {
  id: string;
  label: string;
  noteVi?: string;
}

interface ApiQuestion {
  id: string;
  kcId: string;
  prompt: string;
  choices: ApiChoice[];
  reviewState: string;
}

const EMPTY_FORM = {
  kcId: 'K02',
  prompt: '',
  choiceA: '',
  choiceB: '',
  choiceC: '',
  correct: 'a',
  explanation: '',
};

/** Teacher question authoring — real rows in the server question bank. */
export function TeacherQuestionsPage() {
  const [questions, setQuestions] = useState<ApiQuestion[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/questions', { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { questions: ApiQuestion[] };
      setQuestions(body.questions);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state set only after await
    void reload();
  }, [reload]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaveState('saving');
    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kcId: form.kcId,
          prompt: form.prompt,
          choices: [
            { id: 'a', label: form.choiceA },
            { id: 'b', label: form.choiceB },
            { id: 'c', label: form.choiceC },
          ].filter((choice) => choice.label.trim().length > 0),
          correctChoiceId: form.correct,
          hints: [],
          explanation: form.explanation,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setForm(EMPTY_FORM);
      setSaveState('saved');
      await reload();
    } catch {
      setSaveState('error');
    }
  }

  function kcLabel(kcId: string): string {
    return HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Ngân hàng câu hỏi</p>
        <h1>Tạo và quản lý câu trắc nghiệm</h1>
        <p>
          Câu hỏi mới được lưu trên máy chủ với trạng thái «chưa duyệt» và có thể giao ngay cho lớp.
        </p>
      </header>

      <section className="summary-panel">
        <h2>Tạo câu hỏi mới</h2>
        <form className="question-form" onSubmit={(event) => void submit(event)}>
          <label>
            Kiến thức (KC)
            <select
              value={form.kcId}
              onChange={(event) => setForm({ ...form, kcId: event.target.value })}
            >
              {HERO_GRAPH.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.id} — {node.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Đề bài
            <textarea
              required
              minLength={8}
              maxLength={500}
              value={form.prompt}
              onChange={(event) => setForm({ ...form, prompt: event.target.value })}
              placeholder="Ví dụ: Tìm x biết x/8 = 3/4."
            />
          </label>
          <div className="choice-grid">
            {(['A', 'B', 'C'] as const).map((key) => (
              <label key={key}>
                Phương án {key}
                <input
                  required={key !== 'C'}
                  maxLength={200}
                  value={form[`choice${key}`]}
                  onChange={(event) => setForm({ ...form, [`choice${key}`]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <label>
            Đáp án đúng
            <select
              value={form.correct}
              onChange={(event) => setForm({ ...form, correct: event.target.value })}
            >
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="c">C</option>
            </select>
          </label>
          <label>
            Giải thích (hiện sau khi trả lời đúng)
            <textarea
              maxLength={500}
              value={form.explanation}
              onChange={(event) => setForm({ ...form, explanation: event.target.value })}
            />
          </label>
          <button className="button-primary" type="submit" disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu vào ngân hàng'}
          </button>
          {saveState === 'saved' ? <p role="status">Đã lưu câu hỏi lên máy chủ.</p> : null}
          {saveState === 'error' ? (
            <p role="alert" className="error-message">
              Không lưu được — kiểm tra nội dung và kết nối máy chủ.
            </p>
          ) : null}
        </form>
      </section>

      <section className="summary-panel">
        <h2>Câu hỏi hiện có {questions ? `(${questions.length})` : ''}</h2>
        {loadError ? (
          <p role="alert" className="error-message">
            Không tải được danh sách từ máy chủ.
          </p>
        ) : null}
        {questions === null && !loadError ? <p>Đang tải…</p> : null}
        <ul className="question-bank-list">
          {(questions ?? []).map((question) => (
            <li key={question.id}>
              <strong>{question.prompt}</strong>
              <span>
                {question.kcId} — {kcLabel(question.kcId)} • {question.choices.length} phương án •{' '}
                {question.reviewState === 'UNREVIEWED' ? 'chưa duyệt' : question.reviewState}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
