import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH, PRACTICE_QUESTIONS } from '../../content';
import type { OverrideRecord } from '../../storage/db';
import { appendTeacherOverride } from '../../storage/override-repository';
import { TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';
import { useTeacherDashboard } from './useTeacherDashboard';

const practiceById = new Map(PRACTICE_QUESTIONS.map((question) => [question.itemId, question]));

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

export function TeacherGroupDetailPage() {
  const { groupId = '' } = useParams();
  const { dashboard, overrides } = useTeacherDashboard();
  const group = dashboard.groups.find((candidate) => candidate.id === groupId);

  if (!group) {
    return (
      <div className="page-stack teacher-group-detail-page">
        <Link className="text-link teacher-group-back-link" to="/teacher/class">
          Quay lại danh sách nhóm
        </Link>
        <section className="empty-state" role="status">
          <h1>Không tìm thấy nhóm này</h1>
          <p>Nhóm có thể đã thay đổi sau khi dữ liệu lớp được cập nhật.</p>
        </section>
      </div>
    );
  }

  const groupName = group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status];
  const learnerLabel = (learnerId: string) =>
    dashboard.learners.find((learner) => learner.id === learnerId)?.displayLabel ??
    learnerId.toUpperCase();
  const learnersByQuestion = new Map<string, string[]>();
  dashboard.learners
    .filter((learner) => group.learnerIds.includes(learner.id))
    .forEach((learner) => {
      new Set(
        learner.events.filter((event) => !event.correct).map((event) => event.itemId),
      ).forEach((questionId) => {
        learnersByQuestion.set(questionId, [
          ...(learnersByQuestion.get(questionId) ?? []),
          learner.id,
        ]);
      });
    });
  const wrongQuestions = [...learnersByQuestion].map(([id, learnerIds]) => ({
    id,
    prompt: practiceById.get(id)?.promptVi ?? id,
    learnerIds,
  }));

  function exportGroup() {
    if (!group) return;
    const rows = [
      ['Nhóm', 'Học sinh', 'Đã đánh giá', 'Mức ưu tiên'],
      ...group.learnerIds.map((learnerId) => [
        groupName,
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
    <div className="page-stack teacher-group-detail-page">
      <Link className="text-link teacher-group-back-link" to="/teacher/class">
        Quay lại danh sách nhóm
      </Link>

      <header className="page-heading teacher-group-detail-heading">
        <p className="eyebrow">{TEACHER_GROUP_LABELS[group.status] ?? group.status}</p>
        <h1>
          <strong>{group.rootKcId ? 'Bài:' : 'Nhóm:'}</strong> {groupName}
        </h1>
        <p className="page-meta">
          <strong>Gợi ý:</strong> {teacherActionLabel(group.suggestedActionId)}
        </p>
      </header>

      <section className="teacher-group-detail-metrics" aria-label="Tổng quan nhóm">
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
      </section>

      <section className="teacher-group-detail-surface" aria-label={`Chi tiết nhóm ${groupName}`}>
        <div className="group-detail-grid">
          <div>
            <h2>Học sinh trong nhóm ({group.totalLearnerCount})</h2>
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
            <h2>Câu nhiều học sinh trả lời sai</h2>
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
          <button className="button-secondary" type="button" onClick={exportGroup}>
            Tải danh sách
          </button>
        </div>
      </section>
    </div>
  );
}
