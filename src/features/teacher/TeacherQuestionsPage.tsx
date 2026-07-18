import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CopySimpleIcon } from '@phosphor-icons/react/CopySimple';
import { PencilSimpleIcon } from '@phosphor-icons/react/PencilSimple';
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

const PAGE_SIZE = 10;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type SortOrder = 'NEWEST' | 'ALPHABETICAL';

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
  const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ApiQuestion | null>(null);
  const createPanelRef = useRef<HTMLDetailsElement>(null);
  const questionPromptRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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
    const filtered = (questions ?? []).filter((question) => {
      if (topic !== 'ALL' && question.kcId !== topic) return false;
      if (difficulty !== 'ALL' && question.difficulty !== difficulty) return false;
      if (!normalized) return true;
      return (
        question.prompt.toLocaleLowerCase('vi').includes(normalized) ||
        question.choices.some((choice) => choice.label.toLocaleLowerCase('vi').includes(normalized))
      );
    });

    if (sortOrder === 'ALPHABETICAL') {
      return [...filtered].sort((left, right) => left.prompt.localeCompare(right.prompt, 'vi'));
    }

    return filtered;
  }, [difficulty, questions, search, sortOrder, topic]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedQuestions = filteredQuestions.slice(pageStart, pageStart + PAGE_SIZE);
  const selectedFilteredCount = filteredQuestions.filter((question) =>
    selected.has(question.id),
  ).length;
  const selectedPageCount = paginatedQuestions.filter((question) =>
    selected.has(question.id),
  ).length;
  const allPageSelected =
    paginatedQuestions.length > 0 && selectedPageCount === paginatedQuestions.length;
  const paginationPages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const visible = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]
      .filter((value) => value >= 1 && value <= totalPages)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((left, right) => left - right);

    return visible.flatMap((value, index) => {
      const previous = visible[index - 1];
      return previous && value - previous > 1 ? [`ellipsis-${value}`, value] : [value];
    });
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedPageCount > 0 && selectedPageCount < paginatedQuestions.length;
  }, [paginatedQuestions.length, selectedPageCount]);

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

  function toggleAllPage() {
    const pageIds = paginatedQuestions.map((question) => question.id);
    const everySelected = pageIds.every((id) => selected.has(id));
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of pageIds) {
        if (everySelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function openQuestionForm() {
    if (createPanelRef.current) createPanelRef.current.open = true;
    window.requestAnimationFrame(() => questionPromptRef.current?.focus());
  }

  function resetFilters() {
    setSearch('');
    setTopic('ALL');
    setDifficulty('ALL');
    setSortOrder('NEWEST');
    setPage(1);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function reviewStateLabel(reviewState: string): string {
    const labels: Record<string, string> = {
      UNREVIEWED: 'Bản nháp',
      ACCEPTED: 'Đã duyệt',
      REVISE: 'Cần chỉnh sửa',
      REJECTED: 'Không sử dụng',
    };
    return labels[reviewState] ?? 'Chưa xác định';
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
        <div className="page-heading-actions">
          <span className="status-label status-label--review">Nội dung mẫu</span>
          <button className="button-secondary" type="button" onClick={openQuestionForm}>
            Tạo câu hỏi
          </button>
        </div>
      </header>

      <details ref={createPanelRef} className="summary-panel question-create-panel">
        <summary className="question-create-summary">
          <span>
            <small>Soạn nội dung</small>
            <strong>Tạo câu hỏi mới</strong>
          </span>
          <span className="text-link">Đóng phần tạo</span>
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
              ref={questionPromptRef}
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
          {questions && filteredQuestions.length !== questions.length ? (
            <span className="status-label status-label--neutral">
              {filteredQuestions.length} đang hiển thị
            </span>
          ) : null}
        </header>

        <div className="question-filter-bar" aria-label="Tìm và lọc câu hỏi">
          <label className="question-search">
            Tìm kiếm
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Nhập nội dung câu hỏi hoặc đáp án"
            />
          </label>
          <label>
            Chủ đề
            <select
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setPage(1);
              }}
            >
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
            <select
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả độ khó</option>
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sắp xếp
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as SortOrder);
                setPage(1);
              }}
            >
              <option value="NEWEST">Mới tạo</option>
              <option value="ALPHABETICAL">Câu hỏi A–Z</option>
            </select>
          </label>
        </div>

        <div className="question-selection-bar">
          <label>
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allPageSelected}
              disabled={paginatedQuestions.length === 0}
              onChange={toggleAllPage}
            />
            Chọn tất cả {paginatedQuestions.length} câu trên trang
          </label>
          <span role="status">
            Đã chọn {selected.size} câu
            {selected.size > selectedFilteredCount
              ? ` • ${selected.size - selectedFilteredCount} ngoài bộ lọc`
              : selected.size > selectedPageCount
                ? ` • ${selected.size - selectedPageCount} ở trang khác`
                : ''}
          </span>
        </div>

        {selected.size > 0 ? (
          <div className="question-selection-actions" aria-label="Hành động với câu đã chọn">
            <strong>Đã chọn {selected.size} câu</strong>
            <div className="inline-actions">
              <button
                className="button-primary"
                type="button"
                onClick={() =>
                  navigate('/teacher/assignments', { state: { questionIds: [...selected] } })
                }
              >
                Tạo bài tập với {selected.size} câu
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setSelected(new Set())}
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        ) : null}

        {loadError ? (
          <p role="alert" className="error-message">
            Không tải được danh sách từ máy chủ.
          </p>
        ) : null}
        {questions === null && !loadError ? <p>Đang tải…</p> : null}
        {actionMessage ? <p role="status">{actionMessage}</p> : null}

        <ul className="question-bank-list question-bank-list--managed">
          {paginatedQuestions.map((question) => (
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
                    <div className="question-item-copy">
                      <strong className="question-prompt">{question.prompt}</strong>
                      <div className="question-metadata">
                        <span>{kcLabel(question.kcId)}</span>
                        {question.difficulty !== 'UNSPECIFIED' ? (
                          <span className="status-label status-label--neutral">
                            {DIFFICULTY_LABELS[question.difficulty] ?? 'Chưa phân loại'}
                          </span>
                        ) : null}
                        <span className="status-label status-label--review">
                          {reviewStateLabel(question.reviewState)}
                        </span>
                      </div>
                    </div>
                    <div className="question-row-actions" aria-label="Thao tác câu hỏi">
                      <button
                        className="question-icon-action"
                        type="button"
                        aria-label={`Chỉnh sửa nhanh: ${question.prompt}`}
                        title="Chỉnh sửa nhanh"
                        onClick={() => setEditing(question)}
                      >
                        <PencilSimpleIcon aria-hidden="true" size={20} weight="regular" />
                      </button>
                      <button
                        className="question-icon-action"
                        type="button"
                        aria-label={`Nhân bản: ${question.prompt}`}
                        title="Nhân bản"
                        onClick={() => void duplicate(question)}
                      >
                        <CopySimpleIcon aria-hidden="true" size={20} weight="regular" />
                      </button>
                    </div>
                  </div>
                  <details className="question-preview">
                    <summary>Xem trước</summary>
                    <div className="question-preview-content">
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
                    </div>
                  </details>
                </>
              )}
            </li>
          ))}
        </ul>

        {filteredQuestions.length > PAGE_SIZE ? (
          <nav className="question-pagination" aria-label="Phân trang danh sách câu hỏi">
            <p className="question-pagination-summary">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredQuestions.length)} /{' '}
              {filteredQuestions.length} câu
            </p>
            <div className="question-pagination-controls">
              <button
                className="question-page-button question-page-button--wide"
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              {paginationPages.map((item) =>
                typeof item === 'string' ? (
                  <span key={item} className="question-page-ellipsis" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    className="question-page-button"
                    type="button"
                    aria-label={`Trang ${item}`}
                    aria-current={item === currentPage ? 'page' : undefined}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                className="question-page-button question-page-button--wide"
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </div>
          </nav>
        ) : null}

        {questions !== null && filteredQuestions.length === 0 ? (
          <div className="empty-state" role="status">
            <h3>Không tìm thấy câu hỏi</h3>
            <p>Thử thay từ khóa hoặc bỏ bớt bộ lọc.</p>
            <div className="inline-actions">
              <button className="button-primary" type="button" onClick={resetFilters}>
                Xóa bộ lọc
              </button>
              <button className="button-secondary" type="button" onClick={openQuestionForm}>
                Tạo câu hỏi
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
