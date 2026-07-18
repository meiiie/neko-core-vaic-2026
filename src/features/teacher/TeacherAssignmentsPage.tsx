import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { HERO_GRAPH } from '../../content';
import { ASSIGNMENTS_CHANGED_EVENT } from '../../services/assignment-events';
import type { TeacherDashboardDto, TeacherSupportGroupDto } from './teacher-api';

interface ApiQuestionSummary {
  id: string;
  kcId: string;
  prompt: string;
  difficulty: string;
}

interface ApiAssignment {
  id: string;
  title: string;
  teacherMessage: string;
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
  recipientCount?: number;
  recipientNames?: string[];
}

interface AssignmentLocationState {
  questionIds?: string[];
}

const DIFFICULTY_LABELS: Readonly<Record<string, string>> = {
  EASY: 'Dễ',
  MEDIUM: 'Vừa',
  HARD: 'Khó',
  UNSPECIFIED: 'Chưa phân loại',
};

function topicLabel(kcId: string): string {
  return HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;
}

function randomQuestionIds(questions: readonly ApiQuestionSummary[], count: number): string[] {
  const pool = [...questions];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!];
  }
  return pool.slice(0, Math.min(Math.max(1, count), pool.length)).map((question) => question.id);
}

function recommendationPool(
  questions: readonly ApiQuestionSummary[],
  group: TeacherSupportGroupDto,
  kcId: string,
): ApiQuestionSummary[] {
  const explicitlyRecommended = questions.filter((question) =>
    group.recommendedQuestionIds.includes(question.id),
  );
  return explicitlyRecommended.length > 0
    ? explicitlyRecommended
    : questions.filter((question) => question.kcId === kcId);
}

/** Review assignment composer: system suggestion first, teacher confirmation last. */
export function TeacherAssignmentsPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('group');
  const requestedKcId = searchParams.get('kc');
  const requestedLearnerId = searchParams.get('learner');
  const initialQuestionIds = useMemo(
    () => ((location.state ?? {}) as AssignmentLocationState).questionIds ?? [],
    [location.state],
  );
  const initialized = useRef(false);
  const [dashboard, setDashboard] = useState<TeacherDashboardDto | null>(null);
  const [questions, setQuestions] = useState<ApiQuestionSummary[]>([]);
  const [assignments, setAssignments] = useState<ApiAssignment[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [randomCount, setRandomCount] = useState(5);
  const [autoSelectionCount, setAutoSelectionCount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [allowRetake, setAllowRetake] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [stage, setStage] = useState<'compose' | 'review' | 'saved'>('compose');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [sentCount, setSentCount] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [questionsRes, assignmentsRes, dashboardRes] = await Promise.all([
        fetch('/api/questions', { credentials: 'include' }),
        fetch('/api/assignments', { credentials: 'include' }),
        fetch('/api/teacher/dashboard', { credentials: 'include' }),
      ]);
      if (!questionsRes.ok || !assignmentsRes.ok || !dashboardRes.ok) throw new Error('load');
      const questionsBody = (await questionsRes.json()) as { questions: ApiQuestionSummary[] };
      const assignmentsBody = (await assignmentsRes.json()) as { assignments: ApiAssignment[] };
      const dashboardBody = (await dashboardRes.json()) as TeacherDashboardDto;
      setQuestions(questionsBody.questions);
      setAssignments(assignmentsBody.assignments);
      setDashboard(dashboardBody);
      setLoadError(false);

      if (!initialized.current) {
        const group = dashboardBody.groups.find((candidate) => candidate.id === groupId);
        const validInitialIds = initialQuestionIds.filter((id) =>
          questionsBody.questions.some((question) => question.id === id),
        );
        const recommendedKcId =
          group?.recommendedKcIds.find((kcId) =>
            questionsBody.questions.some((question) => question.kcId === kcId),
          ) ?? requestedKcId;
        const firstQuestion = questionsBody.questions.find((question) =>
          validInitialIds.includes(question.id),
        );
        const packageId = recommendedKcId ?? firstQuestion?.kcId ?? '';
        const requestedLearner = dashboardBody.learners.find(
          (learner) =>
            learner.id === requestedLearnerId && (!group || group.learnerIds.includes(learner.id)),
        );
        const initialRecipients = requestedLearner
          ? [requestedLearner.id]
          : group
            ? group.learnerIds
            : dashboardBody.learners.map((learner) => learner.id);
        setSelectedPackageId(packageId);
        setRecipients(new Set(initialRecipients));
        if (validInitialIds.length > 0) {
          setSelected(new Set(validInitialIds));
        } else if (group && packageId) {
          const questionIds = randomQuestionIds(
            recommendationPool(questionsBody.questions, group, packageId),
            5,
          );
          setSelected(new Set(questionIds));
          setAutoSelectionCount(questionIds.length);
        }
        if (group && packageId) {
          const lessonName = topicLabel(packageId);
          setTitle(`Ôn tập: ${lessonName}`);
          setTeacherMessage(
            initialRecipients.length === 1
              ? `Cô gửi em bài ôn "${lessonName}". Em làm chậm và xem kỹ từng câu nhé.`
              : `Cô gửi các em bài ôn "${lessonName}". Các em làm chậm và xem kỹ từng câu nhé.`,
          );
        }
        initialized.current = true;
      }
    } catch {
      setLoadError(true);
    }
  }, [groupId, initialQuestionIds, requestedKcId, requestedLearnerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state changes only after awaited responses
    void reload();
  }, [reload]);

  useEffect(() => {
    const handleAssignmentsChanged = () => void reload();
    window.addEventListener(ASSIGNMENTS_CHANGED_EVENT, handleAssignmentsChanged);
    return () => window.removeEventListener(ASSIGNMENTS_CHANGED_EVENT, handleAssignmentsChanged);
  }, [reload]);

  const group = dashboard?.groups.find((candidate) => candidate.id === groupId);
  const packages = HERO_GRAPH.nodes.flatMap((node) => {
    const packageQuestions = questions.filter((question) => question.kcId === node.id);
    return packageQuestions.length > 0
      ? [{ kcId: node.id, name: node.name, questions: packageQuestions }]
      : [];
  });
  const selectedPackage = packages.find((item) => item.kcId === selectedPackageId);
  const selectedQuestions = questions.filter((question) => selected.has(question.id));
  const selectedLearners = (dashboard?.learners ?? []).filter((learner) =>
    recipients.has(learner.id),
  );

  function selectPackage(kcId: string) {
    setSelectedPackageId(kcId);
    setSelected(new Set());
    setAutoSelectionCount(null);
    setStage('compose');
    if (!title || title.startsWith('Ôn tập:')) setTitle(`Ôn tập: ${topicLabel(kcId)}`);
  }

  function chooseRandom() {
    if (!selectedPackage) return;
    setSelected(new Set(randomQuestionIds(selectedPackage.questions, randomCount)));
    setAutoSelectionCount(null);
  }

  function chooseAll() {
    if (!selectedPackage) return;
    setSelected(new Set(selectedPackage.questions.map((question) => question.id)));
    setAutoSelectionCount(null);
  }

  function toggleQuestion(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAutoSelectionCount(null);
  }

  function toggleRecipient(id: string) {
    setRecipients((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (
      selected.size === 0 ||
      recipients.size === 0 ||
      title.trim().length < 3 ||
      teacherMessage.trim().length < 3
    )
      return;
    setSaveState('saving');
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          teacherMessage: teacherMessage.trim(),
          questionIds: [...selected],
          learnerIds: [...recipients],
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          allowRetake,
          shuffleAnswers,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setSentCount(recipients.size);
      setStage('saved');
      setSaveState('idle');
      await reload();
    } catch {
      setSaveState('error');
    }
  }

  const canReview =
    selected.size > 0 &&
    recipients.size > 0 &&
    title.trim().length >= 3 &&
    teacherMessage.trim().length >= 3;

  return (
    <div className="page-stack teacher-assignment-page">
      <header className="page-heading">
        <p className="eyebrow">Giao bài ôn</p>
        <h1>{group ? 'Bài ôn được đề xuất' : 'Tạo và giao bài tập'}</h1>
        <p>
          {group
            ? 'Hệ thống đã chọn đúng học sinh và một số câu phù hợp. Cô kiểm tra lại trước khi giao.'
            : 'Chọn người nhận, gói câu hỏi theo bài học và kiểm tra lần cuối trước khi giao.'}
        </p>
      </header>

      <ol className="assignment-flow-steps" aria-label="Các bước giao bài">
        <li data-active={stage === 'compose' || undefined}>1. Chọn học sinh</li>
        <li data-active={stage === 'compose' || undefined}>2. Chọn gói và câu hỏi</li>
        <li data-active={stage === 'review' || undefined}>3. Xem lại</li>
        <li data-active={stage === 'saved' || undefined}>4. Giao bài</li>
      </ol>

      {loadError ? (
        <p role="alert" className="error-message">
          Không tải được dữ liệu từ máy chủ. Hãy thử tải lại trang.
        </p>
      ) : null}

      {stage === 'saved' ? (
        <section className="assignment-sent-state" role="status">
          <p className="eyebrow">Đã hoàn tất</p>
          <h2>Đã giao bài cho {sentCount} học sinh.</h2>
          <p>Bài tập chỉ xuất hiện trong tài khoản của đúng những học sinh cô đã chọn.</p>
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setStage('compose');
              setSelected(new Set());
              setTitle('');
              setTeacherMessage('');
            }}
          >
            Tạo bài khác
          </button>
        </section>
      ) : null}

      {stage === 'compose' ? (
        <section className="assignment-builder">
          <div className="summary-panel question-form targeted-assignment-form">
            {group ? (
              <section
                className="assignment-recommendation"
                aria-labelledby="recommendation-heading"
              >
                <p className="eyebrow">Đề xuất từ bài làm gần nhất</p>
                <h2 id="recommendation-heading">Ôn bài: {topicLabel(group.rootKcId ?? '')}</h2>
                <p>
                  {group.totalLearnerCount} học sinh có dấu hiệu cần ôn ·{' '}
                  {Math.round(group.wrongAnswerRate * 100)}% câu trả lời gần nhất bị sai.
                </p>
              </section>
            ) : null}

            <section className="assignment-compose-step" aria-labelledby="recipient-heading">
              <div className="assignment-step-heading">
                <span>1</span>
                <div>
                  <h2 id="recipient-heading">Học sinh nhận bài</h2>
                  <p>
                    {group
                      ? `Đã chọn ${recipients.size} học sinh theo dấu hiệu bài làm`
                      : `Đã chọn ${recipients.size} học sinh`}
                  </p>
                </div>
              </div>
              <div className="selected-recipient-chips" aria-label="Học sinh đã chọn">
                {selectedLearners.map((learner) => (
                  <span key={learner.id}>{learner.displayLabel}</span>
                ))}
              </div>
              <details className="recipient-editor">
                <summary>Điều chỉnh người nhận</summary>
                <div className="recipient-checklist">
                  {(dashboard?.learners ?? []).map((learner) => (
                    <label key={learner.id}>
                      <input
                        type="checkbox"
                        checked={recipients.has(learner.id)}
                        onChange={() => toggleRecipient(learner.id)}
                      />
                      {learner.displayLabel}
                    </label>
                  ))}
                </div>
              </details>
            </section>

            <section className="assignment-compose-step" aria-labelledby="package-heading">
              <div className="assignment-step-heading">
                <span>2</span>
                <div>
                  <h2 id="package-heading">Gói câu hỏi theo bài học</h2>
                  <p>Chọn một bài để xem toàn bộ câu hỏi trong gói.</p>
                </div>
              </div>
              <div className="assignment-package-grid">
                {packages.map((item) => (
                  <button
                    key={item.kcId}
                    className="assignment-package-card"
                    type="button"
                    aria-pressed={selectedPackageId === item.kcId}
                    onClick={() => selectPackage(item.kcId)}
                  >
                    <small>Bài học</small>
                    <strong>{item.name}</strong>
                    <span>{item.questions.length} câu hỏi</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedPackage ? (
              <section
                className="assignment-compose-step"
                aria-labelledby="question-picker-heading"
              >
                <div className="assignment-step-heading assignment-step-heading--spread">
                  <div>
                    <h2 id="question-picker-heading">Câu hỏi trong gói</h2>
                    <p>
                      Đã chọn {selected.size}/{selectedPackage.questions.length} câu trong gói
                    </p>
                  </div>
                  <button className="button-secondary" type="button" onClick={chooseAll}>
                    Chọn tất cả {selectedPackage.questions.length} câu
                  </button>
                </div>
                {autoSelectionCount !== null ? (
                  <p className="assignment-auto-note" role="status">
                    Hệ thống đã chọn ngẫu nhiên {autoSelectionCount} câu phù hợp.
                  </p>
                ) : null}
                <div className="random-question-control">
                  <label>
                    Số câu chọn ngẫu nhiên
                    <select
                      value={Math.min(randomCount, selectedPackage.questions.length)}
                      onChange={(event) => setRandomCount(Number(event.target.value))}
                    >
                      {Array.from(
                        { length: Math.min(10, selectedPackage.questions.length) },
                        (_, index) => (
                          <option key={index + 1} value={index + 1}>
                            {index + 1} câu
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <button className="button-secondary" type="button" onClick={chooseRandom}>
                    Chọn ngẫu nhiên
                  </button>
                </div>
                <div className="assignment-question-options">
                  {selectedPackage.questions.map((question) => (
                    <label key={question.id} className="assign-option">
                      <input
                        type="checkbox"
                        checked={selected.has(question.id)}
                        onChange={() => toggleQuestion(question.id)}
                      />
                      <span>
                        <strong>{question.prompt}</strong>
                        <span>{DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            <section
              className="assignment-compose-step assignment-settings"
              aria-labelledby="settings-heading"
            >
              <h2 id="settings-heading">Thông tin bài giao</h2>
              <label>
                Tên bài tập
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ví dụ: Ôn tập phân số bằng nhau"
                />
              </label>
              <label>
                Lời nhắn của giáo viên
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  value={teacherMessage}
                  onChange={(event) => setTeacherMessage(event.target.value)}
                  placeholder="Ví dụ: Cô gửi em bài ôn này. Em làm kỹ từng câu nhé."
                />
              </label>
              <p className="assignment-settings-note">
                Lời nhắn này sẽ xuất hiện cùng bài được giao trong tài khoản học sinh.
              </p>
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
            </section>

            <button
              className="button-primary assignment-review-button"
              type="button"
              disabled={!canReview}
              onClick={() => setStage('review')}
            >
              Xem lại bài sẽ giao
            </button>
            {!canReview ? (
              <p className="muted">
                Cần chọn ít nhất một học sinh, một câu hỏi, đặt tên bài và viết lời nhắn.
              </p>
            ) : null}
          </div>

          <aside className="assignment-summary" aria-labelledby="assignment-summary-heading">
            <p className="eyebrow">Tóm tắt đang chọn</p>
            <h2 id="assignment-summary-heading">Bài sẽ giao</h2>
            <dl>
              <div>
                <dt>Người nhận</dt>
                <dd>{recipients.size} học sinh</dd>
              </div>
              <div>
                <dt>Gói bài học</dt>
                <dd>{selectedPackage?.name ?? 'Chưa chọn'}</dd>
              </div>
              <div>
                <dt>Số câu</dt>
                <dd>{selected.size}</dd>
              </div>
              <div>
                <dt>Thời gian</dt>
                <dd>{selected.size > 0 ? `${selected.size * 3} phút` : 'Chưa có'}</dd>
              </div>
            </dl>
          </aside>
        </section>
      ) : null}

      {stage === 'review' ? (
        <section className="assignment-review-panel" aria-labelledby="final-review-heading">
          <header>
            <p className="eyebrow">Bước 3</p>
            <h2 id="final-review-heading">Kiểm tra lần cuối</h2>
            <p>Chỉ khi cô xác nhận, bài mới xuất hiện trong tài khoản học sinh.</p>
          </header>
          <div className="assignment-review-grid">
            <section>
              <h3>Người nhận ({selectedLearners.length})</h3>
              <ul>
                {selectedLearners.map((learner) => (
                  <li key={learner.id}>{learner.displayLabel}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>{selectedPackage?.name ?? 'Gói câu hỏi'}</h3>
              <p>
                {selectedQuestions.length} câu · khoảng {selectedQuestions.length * 3} phút
              </p>
              <ol>
                {selectedQuestions.map((question) => (
                  <li key={question.id}>{question.prompt}</li>
                ))}
              </ol>
            </section>
            <section>
              <h3>Thông tin bài giao</h3>
              <p>
                <strong>{title}</strong>
              </p>
              <p>Hạn nộp: {dueAt ? new Date(dueAt).toLocaleString('vi-VN') : 'Không đặt hạn'}</p>
              <h3>Lời nhắn của giáo viên</h3>
              <p>{teacherMessage}</p>
            </section>
          </div>
          <div className="assignment-review-actions">
            <button className="button-secondary" type="button" onClick={() => setStage('compose')}>
              Quay lại chỉnh sửa
            </button>
            <button
              className="button-primary"
              type="button"
              disabled={saveState === 'saving'}
              onClick={() => void submit()}
            >
              {saveState === 'saving' ? 'Đang giao bài…' : 'Xác nhận và giao bài'}
            </button>
          </div>
          {saveState === 'error' ? (
            <p role="alert" className="error-message">
              Không giao được bài. Dữ liệu đã chọn vẫn được giữ để cô thử lại.
            </p>
          ) : null}
        </section>
      ) : null}

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
                    {assignment.questionCount} câu · khoảng {assignment.questionCount * 3} phút •{' '}
                    {assignment.kcIds.map(topicLabel).join(', ')}
                  </span>
                </div>
                <span className="status-label status-label--neutral">
                  {assignment.dueAt
                    ? `Hạn ${new Date(assignment.dueAt).toLocaleDateString('vi-VN')}`
                    : 'Không đặt hạn'}
                </span>
              </div>
              <p>
                <strong>Người nhận:</strong>{' '}
                {assignment.recipientNames?.length
                  ? assignment.recipientNames.join(', ')
                  : `${assignment.recipientCount ?? assignment.rosterCount} học sinh`}
              </p>
              {assignment.teacherMessage ? (
                <p className="assignment-settings-note">
                  <strong>Lời nhắn:</strong> {assignment.teacherMessage}
                </p>
              ) : null}
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
                    {assignment.completedLearnerCount}/
                    {assignment.recipientCount ?? assignment.rosterCount}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
