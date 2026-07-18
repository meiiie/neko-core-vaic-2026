import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

interface OverrideSaveOutcome {
  message: string;
  assignmentUrl: string;
  learnerLabel: string;
}

function TeacherOverrideForm({
  group,
  overrides,
  onSaved,
}: {
  readonly group: TeacherSupportGroupDto;
  readonly overrides: readonly TeacherOverrideDto[];
  readonly onSaved: (learnerId: string) => Promise<OverrideSaveOutcome>;
}) {
  const [learnerId, setLearnerId] = useState(group.learnerIds[0] ?? '');
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveOutcome, setSaveOutcome] = useState<OverrideSaveOutcome | null>(null);
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
      const outcome = await onSaved(selectedLearnerId);
      setSaveOutcome(outcome);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <form className="teacher-override" onSubmit={(event) => void submit(event)}>
      <header>
        <h3>Điều chỉnh gợi ý cho một học sinh</h3>
        <p>Chỉ dùng khi cô đã xem câu trả lời hoặc trao đổi trực tiếp với học sinh.</p>
        <p>
          Lưu mục này chỉ cập nhật gợi ý của hệ thống, chưa giao bài cho học sinh. Sau khi lưu, cô
          cần kiểm tra bài ôn rồi xác nhận giao.
        </p>
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
              setSaveOutcome(null);
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
          {saveState === 'saving' ? 'Đang lưu gợi ý…' : 'Lưu gợi ý mới'}
        </button>
        {saveState === 'saved' && saveOutcome ? (
          <div className="teacher-override-saved" role="status">
            <span>{saveOutcome.message}</span>
            <Link className="button-primary" to={saveOutcome.assignmentUrl}>
              Tạo bài ôn cho {saveOutcome.learnerLabel}
            </Link>
          </div>
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
  const navigate = useNavigate();
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
          Quay lại các bài cần ôn
        </Link>
        <section className="empty-state" role="status">
          <h1>Không tìm thấy nhóm này</h1>
          <p>Nhóm có thể đã thay đổi sau khi máy chủ nhận thêm bài làm.</p>
        </section>
      </div>
    );
  }

  const activeGroup = group;
  const groupName = group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status];
  const currentGroupId = group.id;

  async function handleOverrideSaved(learnerId: string): Promise<OverrideSaveOutcome> {
    const nextDashboard = await refresh();
    const nextGroup = nextDashboard?.groups.find((candidate) =>
      candidate.learnerIds.includes(learnerId),
    );
    const destinationGroup = nextGroup ?? activeGroup;
    const learnerLabel =
      destinationGroup.learners.find((learner) => learner.id === learnerId)?.displayLabel ??
      activeGroup.learners.find((learner) => learner.id === learnerId)?.displayLabel ??
      learnerId;
    const assignmentUrl = `/teacher/assignments?group=${encodeURIComponent(destinationGroup.id)}&learner=${encodeURIComponent(learnerId)}`;
    if (nextGroup && nextGroup.id !== currentGroupId) {
      const nextName = nextGroup.rootKcId
        ? kcName(nextGroup.rootKcId)
        : TEACHER_GROUP_LABELS[nextGroup.status];
      navigate(`/teacher/class/${encodeURIComponent(nextGroup.id)}`, { replace: true });
      return {
        message: `Đã lưu gợi ý và chuyển học sinh sang bài cần ôn: ${nextName}. Chưa có bài nào được giao cho học sinh.`,
        assignmentUrl,
        learnerLabel,
      };
    }
    return {
      message: 'Đã lưu gợi ý trên máy chủ. Chưa có bài nào được giao cho học sinh.',
      assignmentUrl,
      learnerLabel,
    };
  }

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
        Quay lại các bài cần ôn
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
          <p className="eyebrow">Vì sao cần ôn bài này?</p>
          <h2 id="group-purpose-heading">
            {group.totalLearnerCount} học sinh đang có dấu hiệu cần ôn {groupName}
          </h2>
          <p>
            Hệ thống dựa trên câu trả lời đã lưu, không dựa trên hồ sơ mẫu. Cô nên xem câu trả lời
            bên dưới trước khi giao bài.
          </p>
        </div>
        <p className="teacher-group-suggestion">
          <strong>Phương án hệ thống đề xuất:</strong> {teacherActionLabel(group.suggestedActionId)}
        </p>
      </section>

      <section className="teacher-group-detail-metrics" aria-label="Tổng quan nhóm">
        <span>
          <small>Học sinh cần ôn</small>
          <strong>{group.totalLearnerCount}</strong>
        </span>
        <span>
          <small>Tỷ lệ học sinh cần ôn</small>
          <strong>{Math.round(group.reviewLearnerRate * 100)}%</strong>
        </span>
        <span>
          <small>Tỷ lệ câu trả lời sai</small>
          <strong>{Math.round(group.wrongAnswerRate * 100)}%</strong>
        </span>
      </section>

      <section className="teacher-group-detail-surface" aria-labelledby="wrong-answers-heading">
        <header className="teacher-evidence-heading">
          <div>
            <p className="eyebrow">Bước 1</p>
            <h2 id="wrong-answers-heading">Học sinh đang sai ở đâu?</h2>
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
          <summary>Xem {group.totalLearnerCount} học sinh cần ôn bài này</summary>
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
          <p className="eyebrow">Bước 2 · Gợi ý bài ôn</p>
          <h2 id="support-actions-heading">Xem gói câu hỏi hệ thống đề xuất</h2>
          <p>
            Hệ thống tìm thấy {group.recommendedQuestionIds.length} câu phù hợp với bài học các em
            đang cần ôn. Cô có thể xem, bỏ chọn hoặc chọn ngẫu nhiên trước khi giao.
          </p>
        </div>
        <div className="group-actions">
          <Link
            className="button-primary"
            to={`/teacher/assignments?group=${encodeURIComponent(group.id)}`}
          >
            Xem gói bài ôn đề xuất
          </Link>
          <button className="button-secondary" type="button" onClick={exportGroup}>
            Tải danh sách
          </button>
        </div>
      </section>

      <details className="teacher-override-disclosure">
        <summary>Điều chỉnh gợi ý của hệ thống</summary>
        <TeacherOverrideForm
          group={group}
          overrides={dashboard.overrides}
          onSaved={handleOverrideSaved}
        />
      </details>
    </div>
  );
}
