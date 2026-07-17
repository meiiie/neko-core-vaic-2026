import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { useDemoSession } from '../../app/demo-session';
import { diagnoseHero, kcName, STATUS_LABELS } from '../../app/adapters/hero-tutor';
import { listEventsByLearner } from '../../storage/event-repository';

export function StudentDashboardPage() {
  const { account } = useDemoSession();
  const learnerId = account?.learnerId ?? 'chi';
  const localRecords = useLiveQuery(() => listEventsByLearner(learnerId), [learnerId]);

  if (localRecords === undefined) {
    return <div className="page-loading" aria-label="Đang tải tổng quan" />;
  }

  const result = diagnoseHero(learnerId, localRecords);
  const evidenceCount = result.evidenceEventIds.length;
  const currentRoot = result.rootKcId ? kcName(result.rootKcId) : 'Đang thu thập thêm bằng chứng';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Thứ Sáu, 17 tháng 7</p>
          <h1>Chào buổi chiều, {account?.shortName}</h1>
          <p>Tiếp tục bài kiểm tra ngắn để NekoPath điều chỉnh lộ trình Toán hôm nay.</p>
        </div>
      </header>

      <section className="continue-card" aria-labelledby="continue-title">
        <div className="continue-marker" aria-hidden="true">
          7A
        </div>
        <div className="continue-copy">
          <p className="eyebrow">Việc cần làm tiếp theo</p>
          <h2 id="continue-title">Kiểm tra nền tảng: Tỉ lệ thức</h2>
          <p>Tối đa 3 câu • Số câu thay đổi theo bằng chứng của bạn</p>
          <div className="compact-progress" aria-label={`${localRecords.length} câu đã hoàn thành`}>
            <span style={{ width: `${Math.min(100, localRecords.length * 34)}%` }} />
          </div>
        </div>
        <Link className="button-primary" to="/student/check-in">
          {localRecords.length > 0 ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Tổng quan học tập">
        <article className="summary-panel summary-panel--wide">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Lộ trình hiện tại</p>
              <h2>Đi từ bằng chứng, không đi theo bài cố định</h2>
            </div>
            <span className="status-label status-label--review">
              {STATUS_LABELS[result.status]}
            </span>
          </header>
          <div className="learning-focus">
            <span>Trọng tâm đang kiểm tra</span>
            <strong>{currentRoot}</strong>
            <p>
              Hệ thống chỉ mở nội dung bù khi có đủ bằng chứng; nếu chưa rõ, bạn nhận thêm một câu
              phân biệt thay vì bị gán nhãn sai.
            </p>
          </div>
          <Link className="text-link" to="/student/path">
            Xem cách NekoPath đưa ra lộ trình
          </Link>
        </article>

        <aside className="summary-panel" aria-labelledby="evidence-summary">
          <p className="eyebrow">Hồ sơ học tập</p>
          <h2 id="evidence-summary">Bằng chứng đã ghi nhận</h2>
          <strong className="metric-number">{evidenceCount}</strong>
          <p className="muted">lượt trả lời đang được dùng cho quyết định hiện tại</p>
          <dl className="mini-facts">
            <div>
              <dt>Câu mới trên thiết bị</dt>
              <dd>{localRecords.length}</dd>
            </div>
            <div>
              <dt>Giả thuyết còn lại</dt>
              <dd>{result.competingKcIds.length}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  );
}
