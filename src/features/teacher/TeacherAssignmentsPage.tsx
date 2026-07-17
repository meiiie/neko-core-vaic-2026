import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { HERO_GRAPH } from '../../content';

interface ApiQuestionSummary {
  id: string;
  kcId: string;
  prompt: string;
  difficulty: string;
}

interface ApiAssignment {
  id: string;
  title: string;
  createdAt: string;
  dueAt: string | null;
  questionCount: number;
  kcIds: string[];
  allowRetake: boolean;
  shuffleAnswers: boolean;
  openedLearnerCount: number;
  inProgressLearnerCount: number;
  completedLearnerCount: number;
  rosterCount: number;
}

interface AssignmentLocationState {
  questionIds?: string[];
}

/** Teacher assignment flow: pick real bank questions, hand them to class 7A. */
export function TeacherAssignmentsPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialState = (location.state ?? {}) as AssignmentLocationState;
  const [questions, setQuestions] = useState<ApiQuestionSummary[]>([]);
  const [assignments, setAssignments] = useState<ApiAssignment[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialState.questionIds ?? []),
  );
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [allowRetake, setAllowRetake] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [topicFilter, setTopicFilter] = useState(searchParams.get('kc') ?? 'ALL');
  const [questionSearch, setQuestionSearch] = useState('');
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

  const filteredQuestions = useMemo(() => {
    const normalized = questionSearch.trim().toLocaleLowerCase('vi');
    return questions.filter((question) => {
      if (topicFilter !== 'ALL' && question.kcId !== topicFilter) return false;
      return !normalized || question.prompt.toLocaleLowerCase('vi').includes(normalized);
    });
  }, [questionSearch, questions, topicFilter]);

  const selectedQuestions = questions.filter((question) => selected.has(question.id));
  const selectedTopics = [
    ...new Set(
      selectedQuestions.map(
        (question) =>
          HERO_GRAPH.nodes.find((node) => node.id === question.kcId)?.name ?? question.kcId,
      ),
    ),
  ];
  const estimatedMinutes = selected.size * 3;

  function topicLabel(kcId: string): string {
    return HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;
  }

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
        body: JSON.stringify({
          title,
          questionIds: [...selected],
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          allowRetake,
          shuffleAnswers,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setTitle('');
      setDueAt('');
      setSelected(new Set());
      setAllowRetake(false);
      setShuffleAnswers(false);
      setState('saved');
      await reload();
    } catch {
      setState('error');
    }
  }

  return (
    <div className="page-stack teacher-assignment-page">
      <header className="page-heading">
        <p className="eyebrow">Giao bài</p>
        <h1>Tạo bài tập cho lớp 7A</h1>
        <p>Chọn câu hỏi, kiểm tra khối lượng bài rồi đặt hạn nộp trước khi giao.</p>
      </header>

      {loadError ? (
        <p role="alert" className="error-message">
          Không tải được dữ liệu từ máy chủ.
        </p>
      ) : null}

      <section className="assignment-builder">
        <form className="summary-panel question-form" onSubmit={(event) => void submit(event)}>
          <div>
            <p className="eyebrow">Bài tập mới</p>
            <h2>Tạo bài tập</h2>
          </div>
          <label>
            Tên bài tập
            <input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Luyện tỉ số bằng nhau — tuần 3"
            />
          </label>
          <label>
            Hạn nộp
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>

          <fieldset className="assignment-options">
            <legend>Cách học sinh làm bài</legend>
            <label>
              <input
                type="checkbox"
                checked={allowRetake}
                onChange={(event) => setAllowRetake(event.target.checked)}
              />
              Cho phép làm lại từng câu
            </label>
            <label>
              <input
                type="checkbox"
                checked={shuffleAnswers}
                onChange={(event) => setShuffleAnswers(event.target.checked)}
              />
              Trộn thứ tự đáp án
            </label>
          </fieldset>

          <fieldset className="assign-picker">
            <legend>Chọn câu hỏi cho bài tập ({selected.size} đã chọn)</legend>
            <div className="assignment-question-filters">
              <label>
                Chủ đề
                <select
                  value={topicFilter}
                  onChange={(event) => setTopicFilter(event.target.value)}
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
                Tìm câu hỏi
                <input
                  type="search"
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder="Nhập nội dung câu hỏi"
                />
              </label>
            </div>
            <div className="assignment-question-options">
              {filteredQuestions.map((question) => (
                <label key={question.id} className="assign-option">
                  <input
                    type="checkbox"
                    checked={selected.has(question.id)}
                    onChange={() => toggle(question.id)}
                  />
                  <span>
                    <strong>{topicLabel(question.kcId)}</strong>
                    <span>{question.prompt}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            className="button-primary"
            type="submit"
            disabled={state === 'saving' || selected.size === 0}
          >
            {state === 'saving' ? 'Đang giao…' : 'Giao bài'}
          </button>
          {state === 'saved' ? <p role="status">Đã giao bài cho lớp 7A.</p> : null}
          {state === 'error' ? (
            <p role="alert" className="error-message">
              Không giao được bài — kiểm tra hạn nộp và thử lại.
            </p>
          ) : null}
        </form>

        <aside className="assignment-summary" aria-labelledby="assignment-summary-heading">
          <p className="eyebrow">Kiểm tra trước khi giao</p>
          <h2 id="assignment-summary-heading">Tóm tắt bài tập</h2>
          <dl>
            <div>
              <dt>Số câu</dt>
              <dd>{selected.size}</dd>
            </div>
            <div>
              <dt>Thời gian dự kiến</dt>
              <dd>{estimatedMinutes > 0 ? `${estimatedMinutes} phút` : 'Chưa có'}</dd>
            </div>
            <div>
              <dt>Chủ đề</dt>
              <dd>{selectedTopics.length > 0 ? selectedTopics.join(', ') : 'Chưa chọn'}</dd>
            </div>
            <div>
              <dt>Hạn nộp</dt>
              <dd>
                {dueAt
                  ? new Date(dueAt).toLocaleString('vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : 'Không đặt hạn'}
              </dd>
            </div>
          </dl>
          <p className="muted">Thời gian dự kiến được tính khoảng 3 phút cho mỗi câu.</p>
        </aside>
      </section>

      <section className="summary-panel">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Tiến độ bài tập</p>
            <h2>Bài đã giao {assignments ? `(${assignments.length})` : ''}</h2>
          </div>
        </header>
        {assignments === null && !loadError ? <p>Đang tải…</p> : null}
        <ul className="assignment-list">
          {(assignments ?? []).map((assignment) => (
            <li key={assignment.id}>
              <div className="assignment-list-heading">
                <div>
                  <strong>{assignment.title}</strong>
                  <span>
                    {assignment.questionCount} câu • khoảng {assignment.questionCount * 3} phút •{' '}
                    {assignment.kcIds.map(topicLabel).join(', ')}
                  </span>
                </div>
                <span className="status-label status-label--neutral">
                  {assignment.dueAt
                    ? `Hạn ${new Date(assignment.dueAt).toLocaleDateString('vi-VN')}`
                    : 'Không đặt hạn'}
                </span>
              </div>
              <dl className="assignment-progress-metrics">
                <div>
                  <dt>Đã mở</dt>
                  <dd>{assignment.openedLearnerCount}</dd>
                </div>
                <div>
                  <dt>Đang làm</dt>
                  <dd>{assignment.inProgressLearnerCount}</dd>
                </div>
                <div>
                  <dt>Hoàn thành</dt>
                  <dd>
                    {assignment.completedLearnerCount}/{assignment.rosterCount}
                  </dd>
                </div>
              </dl>
              <p className="assignment-settings-note">
                {assignment.allowRetake ? 'Cho phép làm lại' : 'Mỗi câu làm một lần'} •{' '}
                {assignment.shuffleAnswers ? 'Có trộn đáp án' : 'Giữ nguyên thứ tự đáp án'}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
