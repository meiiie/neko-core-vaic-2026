import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HERO_GRAPH } from '../../content';
import { DIFFICULTY_LABELS } from './teacher-presentation';

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
  correctChoiceId: string;
  explanation: string;
  hints: string[];
  difficulty: string;
  reviewState: string;
}

const EMPTY_FORM = {
  kcId: 'K02',
  difficulty: 'UNSPECIFIED',
  prompt: '',
  choiceA: '',
  choiceB: '',
  choiceC: '',
  correct: 'a',
  explanation: '',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function questionPayload(question: ApiQuestion) {
  return {
    kcId: question.kcId,
    difficulty: question.difficulty,
    prompt: question.prompt,
    choices: question.choices,
    correctChoiceId: question.correctChoiceId,
    hints: question.hints,
    explanation: question.explanation,
  };
}

/** Teacher question authoring — real rows in the server question bank. */
export function TeacherQuestionsPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<ApiQuestion[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('ALL');
  const [difficulty, setDifficulty] = useState('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ApiQuestion | null>(null);

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

  const filteredQuestions = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi');
    return (questions ?? []).filter((question) => {
      if (topic !== 'ALL' && question.kcId !== topic) return false;
      if (difficulty !== 'ALL' && question.difficulty !== difficulty) return false;
      if (!normalized) return true;
      return (
        question.prompt.toLocaleLowerCase('vi').includes(normalized) ||
        question.choices.some((choice) => choice.label.toLocaleLowerCase('vi').includes(normalized))
      );
    });
  }, [difficulty, questions, search, topic]);

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
          difficulty: form.difficulty,
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

  async function duplicate(question: ApiQuestion) {
    try {
      setActionMessage('Đang nhân bản câu hỏi…');
      const response = await fetch('/api/questions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...questionPayload(question),
          prompt: `${question.prompt.slice(0, 489)} (bản sao)`,
        }),
      });
      if (!response.ok) {
        setActionMessage('Không nhân bản được câu hỏi.');
        return;
      }
      setActionMessage('Đã tạo một bản sao trong ngân hàng.');
      await reload();
    } catch {
      setActionMessage('Mất kết nối. Hãy thử nhân bản lại.');
    }
  }

  async function saveQuickEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      setActionMessage('Đang lưu thay đổi…');
      const response = await fetch(`/api/questions/${editing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(questionPayload(editing)),
      });
      if (!response.ok) {
        setActionMessage('Không lưu được thay đổi.');
        return;
      }
      setEditing(null);
      setActionMessage('Đã lưu thay đổi. Câu hỏi vẫn ở trạng thái bản nháp.');
      await reload();
    } catch {
      setActionMessage('Mất kết nối. Hãy thử lưu lại.');
    }
  }

  function toggleSelected(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    const filteredIds = filteredQuestions.map((question) => question.id);
    const everySelected = filteredIds.every((id) => selected.has(id));
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of filteredIds) {
        if (everySelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function kcLabel(kcId: string): string {
    return HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;
  }

  return (
    <div className="page-stack teacher-question-page">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Ngân hàng câu hỏi</p>
          <h1>Soạn và chọn câu hỏi</h1>
          <p>Tìm câu phù hợp, xem trước rồi chọn nhiều câu để tạo bài tập cho lớp.</p>
        </div>
        <span className="status-label status-label--review">Nội dung mẫu · Bản nháp</span>
      </header>

      <details className="summary-panel question-create-panel">
        <summary className="question-create-summary">
          <span>
            <small>Tạo nội dung</small>
            <strong>Tạo câu hỏi mới</strong>
          </span>
          <span className="text-link">Mở biểu mẫu</span>
        </summary>
        <form className="question-form" onSubmit={(event) => void submit(event)}>
          <div className="form-row">
            <label>
              Chủ đề
              <select
                value={form.kcId}
                onChange={(event) => setForm({ ...form, kcId: event.target.value })}
              >
                {HERO_GRAPH.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Độ khó
              <select
                value={form.difficulty}
                onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
              >
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Câu hỏi
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
            Giải thích đáp án
            <textarea
              maxLength={500}
              value={form.explanation}
              onChange={(event) => setForm({ ...form, explanation: event.target.value })}
            />
          </label>
          <button className="button-primary" type="submit" disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Đang lưu…' : 'Lưu bản nháp'}
          </button>
          {saveState === 'saved' ? <p role="status">Đã lưu câu hỏi dưới dạng bản nháp.</p> : null}
          {saveState === 'error' ? (
            <p role="alert" className="error-message">
              Không lưu được — kiểm tra nội dung và kết nối máy chủ.
            </p>
          ) : null}
        </form>
      </details>

      <section className="summary-panel question-library-panel">
        <header className="panel-heading question-library-heading">
          <div>
            <p className="eyebrow">Danh sách câu hỏi</p>
            <h2>{questions ? `${questions.length} câu trong ngân hàng` : 'Đang tải ngân hàng'}</h2>
          </div>
          <button
            className="button-primary"
            type="button"
            disabled={selected.size === 0}
            onClick={() =>
              navigate('/teacher/assignments', { state: { questionIds: [...selected] } })
            }
          >
            Giao {selected.size || ''} câu đã chọn
          </button>
        </header>

        <div className="question-filter-bar" aria-label="Tìm và lọc câu hỏi">
          <label className="question-search">
            Tìm kiếm
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhập nội dung câu hỏi hoặc đáp án"
            />
          </label>
          <label>
            Chủ đề
            <select value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option value="ALL">Tất cả chủ đề</option>
              {HERO_GRAPH.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Độ khó
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="ALL">Tất cả độ khó</option>
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="question-selection-bar">
          <label>
            <input
              type="checkbox"
              checked={
                filteredQuestions.length > 0 &&
                filteredQuestions.every((question) => selected.has(question.id))
              }
              onChange={toggleAllFiltered}
            />
            Chọn tất cả {filteredQuestions.length} kết quả
          </label>
          <span role="status">Đã chọn {selected.size} câu</span>
        </div>

        {loadError ? (
          <p role="alert" className="error-message">
            Không tải được danh sách từ máy chủ.
          </p>
        ) : null}
        {questions === null && !loadError ? <p>Đang tải…</p> : null}
        {actionMessage ? <p role="status">{actionMessage}</p> : null}

        <ul className="question-bank-list question-bank-list--managed">
          {filteredQuestions.map((question) => (
            <li key={question.id}>
              {editing?.id === question.id ? (
                <form className="quick-edit-form" onSubmit={(event) => void saveQuickEdit(event)}>
                  <label>
                    Câu hỏi
                    <textarea
                      required
                      minLength={8}
                      value={editing.prompt}
                      onChange={(event) => setEditing({ ...editing, prompt: event.target.value })}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Chủ đề
                      <select
                        value={editing.kcId}
                        onChange={(event) => setEditing({ ...editing, kcId: event.target.value })}
                      >
                        {HERO_GRAPH.nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Độ khó
                      <select
                        value={editing.difficulty}
                        onChange={(event) =>
                          setEditing({ ...editing, difficulty: event.target.value })
                        }
                      >
                        {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button className="button-primary" type="submit">
                      Lưu thay đổi
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setEditing(null)}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="question-list-main">
                    <label className="question-select">
                      <input
                        type="checkbox"
                        checked={selected.has(question.id)}
                        onChange={() => toggleSelected(question.id)}
                      />
                      <span className="visually-hidden">Chọn câu hỏi: {question.prompt}</span>
                    </label>
                    <div>
                      <strong>{question.prompt}</strong>
                      <span>
                        {kcLabel(question.kcId)} · {DIFFICULTY_LABELS[question.difficulty]} •{' '}
                        {question.choices.length} phương án •{' '}
                        {question.reviewState === 'UNREVIEWED' ? 'Bản nháp' : question.reviewState}
                      </span>
                    </div>
                  </div>
                  <details className="question-preview">
                    <summary>Xem trước câu hỏi</summary>
                    <ol type="A">
                      {question.choices.map((choice) => (
                        <li
                          key={choice.id}
                          data-correct={choice.id === question.correctChoiceId || undefined}
                        >
                          {choice.label}
                          {choice.id === question.correctChoiceId ? ' — đáp án đúng' : ''}
                        </li>
                      ))}
                    </ol>
                    {question.explanation ? (
                      <p>
                        <strong>Giải thích đáp án:</strong> {question.explanation}
                      </p>
                    ) : null}
                  </details>
                  <div className="inline-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setEditing(question)}
                    >
                      Chỉnh sửa nhanh
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => void duplicate(question)}
                    >
                      Nhân bản
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {questions !== null && filteredQuestions.length === 0 ? (
          <div className="empty-state" role="status">
            <h3>Không tìm thấy câu hỏi</h3>
            <p>Thử thay từ khóa hoặc bỏ bớt bộ lọc.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
