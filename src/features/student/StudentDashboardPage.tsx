import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import { diagnoseHero, kcName, STATUS_LABELS } from '../../app/adapters/hero-tutor';
import type { DiagnosisStatus } from '../../domain';
import { listEventsByLearner } from '../../storage/event-repository';

function greetingVi(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function todayVi(date: Date): string {
  const formatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const STATUS_TONES: Record<DiagnosisStatus, string> = {
  DIAGNOSED: 'status-label--evidence',
  NEEDS_MORE_EVIDENCE: 'status-label--review',
  OUT_OF_SCOPE: 'status-label--neutral',
  FAST_PATH: 'status-label--evidence',
};

export function StudentDashboardPage() {
  const { account } = useSession();
  const learnerId = account?.learnerId ?? 'chi';
  const localRecords = useLiveQuery(() => listEventsByLearner(learnerId), [learnerId]);

  if (localRecords === undefined) {
    return <div className="page-loading" aria-label="Đang tải tổng quan" />;
  }

  const now = new Date();
  const result = diagnoseHero(learnerId, localRecords);
  const evidenceCount = result.evidenceEventIds.length;
  const currentRoot = result.rootKcId ? kcName(result.rootKcId) : 'Đang thu thập thêm bằng chứng';
  const started = localRecords.length > 0;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <h1>
          {greetingVi(now.getHours())}, {account?.shortName}
        </h1>
        <p className="page-meta">{todayVi(now)} · Toán 7 · Lớp 7A</p>
      </header>

      <section className="continue-card" aria-labelledby="continue-title">
        <span className="hero-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <div className="continue-copy">
          <p className="hero-label-row">
            <span className="hero-label">{started ? 'Tiếp tục học' : 'Bắt đầu hôm nay'}</span>
            <span className="hero-meta">Tối đa 3 câu</span>
          </p>
          <h2 id="continue-title">Kiểm tra nền tảng: Tỉ lệ thức</h2>
          <p>Số câu thay đổi theo bằng chứng của bạn — không dư một câu nào.</p>
        </div>
        <Link className="button-primary" to="/student/check-in">
          {started ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Tổng quan học tập">
        <article className="summary-panel summary-panel--wide">
          <header className="panel-top">
            <h2>Lộ trình học</h2>
            <span className={`status-label ${STATUS_TONES[result.status]}`}>
              {STATUS_LABELS[result.status]}
            </span>
          </header>
          <p className="focus-line">
            Trọng tâm đang kiểm tra: <strong>{currentRoot}</strong>
          </p>
          <p className="muted">
            Khi chưa đủ bằng chứng, bạn nhận thêm một câu phân biệt thay vì bị gán nhãn sai.
          </p>
          <Link className="text-link" to="/student/path">
            Xem lộ trình đầy đủ
          </Link>
        </article>

        <aside className="summary-panel" aria-labelledby="evidence-summary">
          <h2 id="evidence-summary">Bằng chứng học tập</h2>
          <dl className="mini-facts">
            <div>
              <dt>Lượt trả lời được dùng</dt>
              <dd>{evidenceCount}</dd>
            </div>
            <div>
              <dt>Câu mới trên thiết bị</dt>
              <dd>{localRecords.length}</dd>
            </div>
            <div>
              <dt>Giả thuyết đang phân biệt</dt>
              <dd>{result.competingKcIds.length}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  );
}
