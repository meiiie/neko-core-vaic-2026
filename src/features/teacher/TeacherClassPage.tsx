import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH, PRACTICE_QUESTIONS } from '../../content';
import type { OverrideRecord } from '../../storage/db';
import { appendTeacherOverride } from '../../storage/override-repository';
import { priorityBand, TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';
import { useTeacherDashboard } from './useTeacherDashboard';

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function TeacherOverrideForm({
  learnerIds,
  learnerLabel,
  overrides,
}: {
  readonly learnerIds: readonly string[];
  readonly learnerLabel: (learnerId: string) => string;
  readonly overrides: readonly OverrideRecord[];
}) {
  const [learnerId, setLearnerId] = useState(learnerIds[0] ?? '');
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const selectedLearnerId = learnerIds.includes(learnerId) ? learnerId : (learnerIds[0] ?? '');
  const current = overrides.find(
    (override) => override.learnerId === selectedLearnerId && override.targetKcId === 'K10',
  );
  const selectedDecision =
    decision ||
    (current?.decision === 'SET_ROOT' && current.rootKcId
      ? `ROOT:${current.rootKcId}`
      : 'NEEDS_MORE_EVIDENCE');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLearnerId || reason.trim().length < 8) return;
    setSaveState('saving');
    try {
      const rootKcId = selectedDecision.startsWith('ROOT:') ? selectedDecision.slice(5) : undefined;
      await appendTeacherOverride({
        id: `override-${crypto.randomUUID()}`,
        learnerId: selectedLearnerId,
        targetKcId: 'K10',
        decision: rootKcId ? 'SET_ROOT' : 'NEEDS_MORE_EVIDENCE',
        ...(rootKcId ? { rootKcId } : {}),
        reason: reason.trim(),
        updatedAt: new Date().toISOString(),
      });
      setReason('');
      setDecision('');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <form className="teacher-override" onSubmit={(event) => void submit(event)}>
      <header>
        <h3>Sửa kết quả của học sinh</h3>
        <p>Dùng khi cô đã xem bài hoặc trao đổi trực tiếp và thấy kết quả chưa phù hợp.</p>
      </header>
      <div className="teacher-override-grid">
        <label>
          Học sinh
          <select
            value={selectedLearnerId}
            onChange={(event) => {
              setLearnerId(event.target.value);
              setDecision('');
              setSaveState('idle');
            }}
          >
            {learnerIds.map((id) => (
              <option key={id} value={id}>
                {learnerLabel(id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kết quả sau khi xem lại
          <select value={selectedDecision} onChange={(event) => setDecision(event.target.value)}>
            <option value="NEEDS_MORE_EVIDENCE">Chưa đủ thông tin để kết luận</option>
            {HERO_GRAPH.nodes.map((node) => (
              <option key={node.id} value={`ROOT:${node.id}`}>
                Cần ôn bài: {node.name}
              </option>
            ))}
          </select>
        </label>
        <label className="teacher-override-reason">
          Lý do thay đổi
          <input
            required
            minLength={8}
            maxLength={240}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Cô đã xem bài làm và trao đổi trực tiếp…"
          />
        </label>
      </div>
      {current ? (
        <p className="teacher-override-current">
          Lần sửa gần nhất:{' '}
          {current.decision === 'SET_ROOT'
            ? `Cần ôn bài ${kcName(current.rootKcId ?? '')}`
            : 'Chưa đủ thông tin để kết luận'}{' '}
          — {current.reason}
        </p>
      ) : null}
      <div className="teacher-override-actions">
        <button className="button-secondary" type="submit" disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
        {saveState === 'saved' ? (
          <span role="status">Đã lưu thay đổi và cập nhật lại danh sách nhóm.</span>
        ) : null}
        {saveState === 'error' ? (
          <span role="alert">Không lưu được điều chỉnh. Hãy thử lại.</span>
        ) : null}
      </div>
    </form>
  );
}

export function TeacherClassPage() {
  const { dashboard, overrides } = useTeacherDashboard();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const selectedGroupId = searchParams.get('group');
  const selectedStatus = searchParams.get('status');
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const practiceById = new Map(PRACTICE_QUESTIONS.map((question) => [question.itemId, question]));
  const filteredGroups = groups.filter((group) => {
    if (topic !== 'ALL' && group.rootKcId !== topic) return false;
    if (priority !== 'ALL' && priorityBand(group.priorityScore) !== priority) return false;
    return true;
  });
  const learnerLabel = (learnerId: string) =>
    dashboard.learners.find((learner) => learner.id === learnerId)?.displayLabel ??
    learnerId.toUpperCase();

  function wrongQuestionSummaries(learnerIds: readonly string[]) {
    const learnersByQuestion = new Map<string, string[]>();
    dashboard.learners
      .filter((learner) => learnerIds.includes(learner.id))
      .forEach((learner) => {
        const questionIds = new Set(
          learner.events.filter((event) => !event.correct).map((event) => event.itemId),
        );
        questionIds.forEach((questionId) => {
          learnersByQuestion.set(questionId, [
            ...(learnersByQuestion.get(questionId) ?? []),
            learner.id,
          ]);
        });
      });

    return [...learnersByQuestion].map(([id, ids]) => ({
      id,
      prompt: practiceById.get(id)?.promptVi ?? id,
      learnerIds: ids,
    }));
  }

  function exportGroup(group: (typeof groups)[number]) {
    const rows = [
      ['Nhóm', 'Học sinh', 'Đã đánh giá', 'Mức ưu tiên'],
      ...group.learnerIds.map((learnerId) => [
        group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status],
        learnerLabel(learnerId),
        group.sufficientEvidenceCount > 0 ? 'Có dữ liệu nhóm' : 'Cần đánh giá thêm',
        group.priorityScore > 0 ? 'Cần hỗ trợ trước' : 'Theo dõi',
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lop-7a-${group.id.replaceAll(':', '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack teacher-class-page">
      <header className="page-heading">
        <h1>Nhóm học sinh cần hỗ trợ</h1>
        <p className="page-meta">
          Lớp 7A · {dashboard.learners.length} học sinh · Chọn một nhóm để xem học sinh đang vướng ở
          đâu và giao bài phù hợp.
        </p>
      </header>

      <section className="teacher-filter-bar" aria-label="Lọc nhóm học sinh">
        <label>
          Bài học
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="ALL">Tất cả bài học</option>
            {HERO_GRAPH.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mức cần hỗ trợ
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="ALL">Tất cả nhóm</option>
            <option value="SUPPORT_FIRST">Cần hỗ trợ trước</option>
            <option value="MONITOR">Có thể xem sau</option>
          </select>
        </label>
        <p role="status">Có {filteredGroups.length} nhóm</p>
      </section>

      <section className="group-table" aria-label="Danh sách nhóm cần hỗ trợ">
        {filteredGroups.map((group, index) => {
          const wrongQuestions = wrongQuestionSummaries(group.learnerIds);
          const isHighlighted = selectedGroupId === group.id || selectedStatus === group.status;
          const groupName = group.rootKcId
            ? kcName(group.rootKcId)
            : TEACHER_GROUP_LABELS[group.status];
          return (
            <article
              className={isHighlighted ? 'intervention-row is-highlighted' : 'intervention-row'}
              id={`group-${group.id.replaceAll(':', '-')}`}
              key={group.id}
            >
              <details open={isHighlighted || undefined}>
                <summary className="intervention-summary">
                  <span className="rank-cell" aria-label={`Thứ tự ${index + 1}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="intervention-copy">
                    <span className="eyebrow">
                      {TEACHER_GROUP_LABELS[group.status] ?? group.status}
                    </span>
                    <span className="intervention-title" role="heading" aria-level={2}>
                      <strong>{group.rootKcId ? 'Bài:' : 'Nhóm:'}</strong> {groupName}
                    </span>
                    <span className="intervention-guidance">
                      <strong>Gợi ý:</strong> {teacherActionLabel(group.suggestedActionId)}
                    </span>
                  </span>
                  <span className="intervention-metrics">
                    <span>
                      <small>Học sinh</small>
                      <strong>{group.totalLearnerCount}</strong>
                    </span>
                    <span>
                      <small>Đã có đủ dữ liệu</small>
                      <strong>
                        {group.sufficientEvidenceCount}/{group.totalLearnerCount}
                      </strong>
                    </span>
                    <span>
                      <small>Cần làm trước?</small>
                      <strong>{group.priorityScore > 0 ? 'Có' : 'Chưa'}</strong>
                    </span>
                  </span>
                  <span className="intervention-disclosure-label">
                    <span className="when-closed">Xem chi tiết</span>
                    <span className="when-open">Thu gọn</span>
                  </span>
                </summary>

                <div className="intervention-detail">
                  <div className="group-detail-grid">
                    <div>
                      <h3>Học sinh trong nhóm ({group.totalLearnerCount})</h3>
                      <div className="learner-chip-list">
                        {group.learnerIds.map((id) => (
                          <span key={id}>
                            {learnerLabel(id)}
                            {overrides.some((item) => item.learnerId === id) ? (
                              <small>Đã được cô sửa</small>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Câu nhiều học sinh trả lời sai</h3>
                      {wrongQuestions.length > 0 ? (
                        <ul className="wrong-question-summary-list">
                          {wrongQuestions.map((question) => (
                            <li key={question.id}>
                              <span className="wrong-question-copy">
                                <strong>{question.prompt}</strong>
                                <small>{question.id}</small>
                              </span>
                              <span className="wrong-question-count">
                                {question.learnerIds.length} học sinh
                              </span>
                              <small className="wrong-question-learners">
                                {question.learnerIds.map(learnerLabel).join(', ')}
                              </small>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Chưa có câu trả lời sai trong dữ liệu mẫu.</p>
                      )}
                    </div>
                  </div>
                  {group.representativeEventIds.length > 0 ? (
                    <p className="muted group-audit-note">
                      Đã kiểm tra {group.representativeEventIds.length} câu trả lời gần đây.
                    </p>
                  ) : null}
                  <TeacherOverrideForm
                    learnerIds={group.learnerIds}
                    learnerLabel={learnerLabel}
                    overrides={overrides}
                  />
                  <div className="group-actions">
                    <Link
                      className="button-primary"
                      to={`/teacher/assignments${group.rootKcId ? `?kc=${group.rootKcId}` : ''}`}
                    >
                      Giao bài cho nhóm
                    </Link>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => exportGroup(group)}
                    >
                      Tải danh sách
                    </button>
                  </div>
                </div>
              </details>
            </article>
          );
        })}
      </section>

      {filteredGroups.length === 0 ? (
        <section className="empty-state" role="status">
          <h2>Không có nhóm phù hợp</h2>
          <p>Thử chọn bài học khác hoặc xem tất cả nhóm.</p>
        </section>
      ) : null}
    </div>
  );
}
