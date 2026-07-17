import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buildHeroClassDashboard, kcName } from '../../app/adapters/hero-tutor';
import { HERO_GRAPH, PRACTICE_QUESTIONS } from '../../content';
import { useSyncStatus } from '../../services/sync';
import { priorityBand, TEACHER_GROUP_LABELS, teacherActionLabel } from './teacher-presentation';

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function TeacherClassPage() {
  const dashboard = useMemo(() => buildHeroClassDashboard(), []);
  const syncStatus = useSyncStatus();
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [minimumSize, setMinimumSize] = useState('0');
  const selectedGroupId = searchParams.get('group');
  const selectedStatus = searchParams.get('status');
  const groups = [...dashboard.groups].sort((a, b) => b.priorityScore - a.priorityScore);
  const practiceById = new Map(PRACTICE_QUESTIONS.map((question) => [question.itemId, question]));
  const filteredGroups = groups.filter((group) => {
    if (topic !== 'ALL' && group.rootKcId !== topic) return false;
    if (priority !== 'ALL' && priorityBand(group.priorityScore) !== priority) return false;
    if (group.totalLearnerCount < Number(minimumSize)) return false;
    return true;
  });

  function wrongQuestionsByLearner(learnerIds: readonly string[]) {
    return dashboard.learners
      .filter((learner) => learnerIds.includes(learner.id))
      .map((learner) => {
        const questionIds = [
          ...new Set(learner.events.filter((event) => !event.correct).map((event) => event.itemId)),
        ];
        return {
          learnerId: learner.id,
          questions: questionIds.map((id) => ({
            id,
            prompt: practiceById.get(id)?.promptVi ?? id,
          })),
        };
      })
      .filter((learner) => learner.questions.length > 0);
  }

  function exportGroup(group: (typeof groups)[number]) {
    const rows = [
      ['Nhóm', 'Học sinh', 'Đã đánh giá', 'Mức ưu tiên'],
      ...group.learnerIds.map((learnerId) => [
        group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status],
        learnerId.toUpperCase(),
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

  const updatedLabel = syncStatus?.lastSyncedAt
    ? `Cập nhật lúc ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Dữ liệu mẫu trên thiết bị';

  return (
    <div className="page-stack teacher-class-page">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Lớp 7A • 40 học sinh</p>
          <h1>Nhóm cần hỗ trợ</h1>
          <p>So sánh các nhóm, xem câu trả lời sai và chọn việc nên làm tiếp theo.</p>
        </div>
        <span className="status-label status-label--neutral">{updatedLabel}</span>
      </header>

      <section className="teacher-filter-bar" aria-label="Lọc nhóm học sinh">
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
          Mức ưu tiên
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="ALL">Tất cả mức</option>
            <option value="SUPPORT_FIRST">Cần hỗ trợ trước</option>
            <option value="MONITOR">Theo dõi thêm</option>
          </select>
        </label>
        <label>
          Số học sinh
          <select value={minimumSize} onChange={(event) => setMinimumSize(event.target.value)}>
            <option value="0">Mọi quy mô nhóm</option>
            <option value="10">Từ 10 học sinh</option>
            <option value="12">Từ 12 học sinh</option>
          </select>
        </label>
        <p role="status">Hiển thị {filteredGroups.length} nhóm</p>
      </section>

      <section className="group-table" aria-label="Danh sách nhóm cần hỗ trợ">
        {filteredGroups.map((group, index) => {
          const learnerMistakes = wrongQuestionsByLearner(group.learnerIds);
          const isHighlighted = selectedGroupId === group.id || selectedStatus === group.status;
          return (
            <article
              className={isHighlighted ? 'intervention-row is-highlighted' : 'intervention-row'}
              id={`group-${group.id.replaceAll(':', '-')}`}
              key={group.id}
            >
              <div className="rank-cell" aria-label={`Thứ tự ${index + 1}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div className="intervention-main">
                <p className="eyebrow">{TEACHER_GROUP_LABELS[group.status] ?? group.status}</p>
                <h2>
                  {group.rootKcId ? kcName(group.rootKcId) : TEACHER_GROUP_LABELS[group.status]}
                </h2>
                <p>{teacherActionLabel(group.suggestedActionId)}</p>

                <details open={isHighlighted || undefined}>
                  <summary>Xem chi tiết</summary>
                  <div className="group-detail-grid">
                    <div>
                      <h3>Học sinh trong nhóm</h3>
                      <div className="learner-chip-list">
                        {group.learnerIds.map((id) => (
                          <span key={id}>{id.toUpperCase()}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Học sinh và câu trả lời sai</h3>
                      {learnerMistakes.length > 0 ? (
                        <ul className="wrong-question-list learner-mistake-list">
                          {learnerMistakes.map((learner) => (
                            <li key={learner.learnerId}>
                              <strong>{learner.learnerId.toUpperCase()}</strong>
                              <ul>
                                {learner.questions.map((question) => (
                                  <li key={question.id}>
                                    {question.prompt} <small>({question.id})</small>
                                  </li>
                                ))}
                              </ul>
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
                      {group.representativeEventIds.length} câu trả lời đại diện đã được kiểm tra
                      theo đúng thứ tự thời gian.
                    </p>
                  ) : null}
                </details>

                <div className="group-actions">
                  <Link
                    className="button-primary"
                    to={`/teacher/assignments${group.rootKcId ? `?kc=${group.rootKcId}` : ''}`}
                  >
                    Giao bài
                  </Link>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => exportGroup(group)}
                  >
                    Xuất danh sách
                  </button>
                </div>
              </div>
              <dl className="intervention-metrics">
                <div>
                  <dt>Số học sinh</dt>
                  <dd>{group.totalLearnerCount}</dd>
                </div>
                <div>
                  <dt>Đã đánh giá</dt>
                  <dd>
                    {group.sufficientEvidenceCount}/{group.totalLearnerCount}
                  </dd>
                </div>
                <div>
                  <dt>Mức ưu tiên</dt>
                  <dd>{group.priorityScore > 0 ? 'Hỗ trợ trước' : 'Theo dõi'}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </section>

      {filteredGroups.length === 0 ? (
        <section className="empty-state" role="status">
          <h2>Không có nhóm phù hợp</h2>
          <p>Thử đổi chủ đề, mức ưu tiên hoặc số học sinh tối thiểu.</p>
        </section>
      ) : null}
    </div>
  );
}
