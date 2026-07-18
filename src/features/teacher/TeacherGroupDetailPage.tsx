import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH } from '../../content';
import { TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';
import {
  saveTeacherOverride,
  type TeacherOverrideDto,
  type TeacherSupportGroupDto,
} from './teacher-api';
import { useTeacherDashboard } from './useTeacherDashboard';

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function TeacherOverrideForm({
  group,
  overrides,
  onSaved,
}: {
  readonly group: TeacherSupportGroupDto;
  readonly overrides: readonly TeacherOverrideDto[];
  readonly onSaved: () => Promise<void>;
}) {
  const [learnerId, setLearnerId] = useState(group.learnerIds[0] ?? '');
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const selectedLearnerId = group.learnerIds.includes(learnerId)
    ? learnerId
    : (group.learnerIds[0] ?? '');
  const current = overrides.find(
    (override) => override.learnerId === selectedLearnerId && override.targetKcId === 'K10',
  );
  const selectedDecision =
    decision ||
    (current?.decision === 'SET_ROOT' && current.rootKcId
      ? `ROOT:${current.rootKcId}`
      : 'NEEDS_MORE_EVIDENCE');
  const learnerLabel = (id: string) =>
    group.learners.find((learner) => learner.id === id)?.displayLabel ?? id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLearnerId || reason.trim().length < 8) return;
    setSaveState('saving');
    try {
      const rootKcId = selectedDecision.startsWith('ROOT:') ? selectedDecision.slice(5) : undefined;
      await saveTeacherOverride({
        learnerId: selectedLearnerId,
        targetKcId: 'K10',
        decision: rootKcId ? 'SET_ROOT' : 'NEEDS_MORE_EVIDENCE',
        ...(rootKcId ? { rootKcId } : {}),
        reason: reason.trim(),
      });
      setReason('');
      setDecision('');
      setSaveState('saved');
      await onSaved();
    } catch {
      setSaveState('error');
    }
  }

  return (
    <form className="teacher-override" onSubmit={(event) => void submit(event)}>
      <header>
        <h3>Điều chỉnh gợi ý cho một học sinh</h3>
        <p>Chỉ dùng khi cô đã xem câu trả lời hoặc trao đổi trực tiếp với học sinh.</p>
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
            {group.learners.map((learner) => (
              <option key={learner.id} value={learner.id}>
                {learner.displayLabel}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gợi ý đúng theo đánh giá của cô
          <select value={selectedDecision} onChange={(event) => setDecision(event.target.value)}>
            <option value="NEEDS_MORE_EVIDENCE">Cần thêm câu trả lời để kết luận</option>
            {HERO_GRAPH.nodes.map((node) => (
              <option key={node.id} value={`ROOT:${node.id}`}>
                Cần ôn bài: {node.name}
              </option>
            ))}
          </select>
        </label>
        <label className="teacher-override-reason">
          Lý do điều chỉnh
          <input
            required
            minLength={8}
            maxLength={240}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Cô đã xem bài làm và trao đổi trực tiếp với em…"
          />
        </label>
      </div>
      {current ? (
        <p className="teacher-override-current">
          Lần điều chỉnh gần nhất cho {learnerLabel(selectedLearnerId)}:{' '}
          {current.decision === 'SET_ROOT'
            ? `Cần ôn bài ${kcName(current.rootKcId ?? '')}`
            : 'Cần thêm câu trả lời để kết luận'}{' '}
          — {current.reason}
        </p>
      ) : null}
      <div className="teacher-override-actions">
        <button className="button-secondary" type="submit" disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'Đang lưu lên máy chủ…' : 'Lưu điều chỉnh'}
        </button>
        {saveState === 'saved' ? <span role="status">Đã lưu điều chỉnh trên máy chủ.</span> : null}
        {saveState === 'error' ? (
          <span role="alert">Không lưu được điều chỉnh. Hãy thử lại.</span>
        ) : null}
      </div>
    </form>
  );
}

export function TeacherGroupDetailPage() {
  const { groupId = '' } = useParams();
  const { dashboard, loading, error, refresh } = useTeacherDashboard();
  const group = dashboard.groups.find((candidate) => candidate.id === groupId);

  if (loading) {
    return (
      <section className="empty-state" role="status">
        <h1>Đang lấy chi tiết nhóm</h1>
        <p>Hệ thống đang đọc câu trả lời từ máy chủ.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state" role="alert">
        <h1>Chưa tải được chi tiết nhóm</h1>
        <p>{error}</p>
        <button className="button-secondary" type="button" onClick={() => void refresh()}>
          Thử tải lại
        </button>
      </section>
    );
  }

  if (!group) {
    return (
      <div className="page-stack teacher-group-detail-page">
        <Link className="text-link teacher-group-back-link" to="/teacher/class">
          Quay lại danh sách nhóm
        </Link>
        <section className="empty-state" role="status">
          <h1>Không tìm thấy nhóm này</h1>
          <p>Nhóm có thể đã thay đổi sau khi máy chủ nhận thêm bài làm.</p>
        </section>
      </div>
    );
  }

  const groupName = group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status];

  function exportGroup() {
    if (!group) return;
    const rows = [
      ['Nhóm', 'Học sinh', 'Số câu trả lời', 'Mức ưu tiên'],
      ...group.learners.map((learner) => [
        groupName,
        learner.displayLabel,
        learner.eventCount,
        group.priorityScore > 0 ? 'Cần hỗ trợ trước' : 'Theo dõi',
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${dashboard.classId}-${group.id.replaceAll(':', '-')}.csv`;
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
          Dữ liệu từ máy chủ · Cập nhật {new Date(dashboard.generatedAt).toLocaleString('vi-VN')}
        </p>
      </header>

      <section className="teacher-group-purpose" aria-labelledby="group-purpose-heading">
        <div>
          <p className="eyebrow">Vì sao có nhóm này?</p>
          <h2 id="group-purpose-heading">
            {group.totalLearnerCount} học sinh đang có dấu hiệu cần ôn {groupName}
          </h2>
          <p>
            Hệ thống dựa trên câu trả lời đã lưu, không dựa trên hồ sơ mẫu. Cô nên xem câu trả lời
            bên dưới trước khi giao bài.
          </p>
        </div>
        <p className="teacher-group-suggestion">
          <strong>Gợi ý:</strong> {teacherActionLabel(group.suggestedActionId)}
        </p>
      </section>

      <section className="teacher-group-detail-metrics" aria-label="Tổng quan nhóm">
        <span>
          <small>Học sinh trong nhóm</small>
          <strong>{group.totalLearnerCount}</strong>
        </span>
        <span>
          <small>Câu đang cần kiểm tra</small>
          <strong>{group.wrongQuestions.length}</strong>
        </span>
        <span>
          <small>Mức ưu tiên</small>
          <strong>{group.priorityScore > 0 ? 'Làm trước' : 'Theo dõi'}</strong>
        </span>
      </section>

      <section className="teacher-group-detail-surface" aria-labelledby="wrong-answers-heading">
        <header className="teacher-evidence-heading">
          <div>
            <p className="eyebrow">Bước 1</p>
            <h2 id="wrong-answers-heading">Kiểm tra câu trả lời sai</h2>
          </div>
          <p>Bấm vào từng câu để xem học sinh đã chọn gì và đáp án đúng.</p>
        </header>

        {group.wrongQuestions.length > 0 ? (
          <div className="wrong-question-disclosure-list">
            {group.wrongQuestions.map((question) => (
              <details className="wrong-question-disclosure" key={question.questionId}>
                <summary>
                  <span>
                    <strong>{question.prompt}</strong>
                    <small>{question.wrongLearnerCount} học sinh trả lời sai</small>
                  </span>
                  <span className="wrong-question-open-label">Xem câu trả lời</span>
                </summary>
                <div className="teacher-answer-table-wrap">
                  <table className="teacher-answer-table">
                    <thead>
                      <tr>
                        <th>Học sinh</th>
                        <th>Đã chọn</th>
                        <th>Đáp án đúng</th>
                        <th>Thời gian</th>
                        <th>Bài làm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {question.answers.map((answer) => (
                        <tr key={answer.eventId}>
                          <th scope="row">{answer.learnerName}</th>
                          <td>{answer.selectedChoiceLabel}</td>
                          <td>{answer.correctChoiceLabel}</td>
                          <td>{new Date(answer.occurredAt).toLocaleString('vi-VN')}</td>
                          <td>{answer.assignmentTitle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="muted">Nhóm này chưa có câu trả lời sai ở lần làm gần nhất.</p>
        )}

        <details className="learner-roster-disclosure">
          <summary>Xem danh sách {group.totalLearnerCount} học sinh trong nhóm</summary>
          <ul>
            {group.learners.map((learner) => (
              <li key={learner.id}>
                <strong>{learner.displayLabel}</strong>
                <span>{learner.eventCount} câu trả lời đã ghi nhận</span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="teacher-support-actions" aria-labelledby="support-actions-heading">
        <div>
          <p className="eyebrow">Bước 2</p>
          <h2 id="support-actions-heading">Chọn cách hỗ trợ</h2>
          <p>Giao bài ôn cho cả nhóm sau khi cô đã kiểm tra các câu trả lời phía trên.</p>
        </div>
        <div className="group-actions">
          <Link
            className="button-primary"
            to={`/teacher/assignments${group.rootKcId ? `?kc=${group.rootKcId}` : ''}`}
          >
            Giao bài ôn cho nhóm
          </Link>
          <button className="button-secondary" type="button" onClick={exportGroup}>
            Tải danh sách
          </button>
        </div>
      </section>

      <details className="teacher-override-disclosure">
        <summary>Điều chỉnh gợi ý của hệ thống</summary>
        <TeacherOverrideForm group={group} overrides={dashboard.overrides} onSaved={refresh} />
      </details>
    </div>
  );
}
