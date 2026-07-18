import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import { greetingVi, todayVi } from '../../app/vietnamese-time';
import { diagnoseHero, kcName, STATUS_LABELS } from '../../app/adapters/hero-tutor';
import { reviewRecommendation } from '../../app/adapters/review-selection';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import type { DiagnosisStatus } from '../../domain';

const STATUS_TONES: Record<DiagnosisStatus, string> = {
  DIAGNOSED: 'status-label--evidence',
  NEEDS_MORE_EVIDENCE: 'status-label--review',
  OUT_OF_SCOPE: 'status-label--neutral',
  FAST_PATH: 'status-label--evidence',
};

export function StudentDashboardPage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);

  if (migrationError) {
    return <StudentDataFailure onRetry={retryMigration} />;
  }

  if (localRecords === undefined || !learnerContext) {
    return <div className="page-loading" aria-label="Đang tải tổng quan" />;
  }

  const now = new Date();
  const result = diagnoseHero(learnerContext, localRecords);
  const review = reviewRecommendation(learnerContext, result, localRecords, now.toISOString());
  const localAnswers = localRecords.filter(
    (record) => record.kind === 'ANSWER' || record.kind === 'ASSIGNMENT_ANSWER',
  );
  const evidenceCount = result.evidenceEventIds.length;
  const currentRoot = result.rootKcId ? kcName(result.rootKcId) : 'Đang thu thập thêm bằng chứng';
  const started = localAnswers.length > 0;
  const continueDestination =
    result.status === 'DIAGNOSED'
      ? '/student/practice'
      : result.status === 'FAST_PATH'
        ? result.nextItemId
          ? '/student/practice'
          : review
            ? '/student/check-in?mode=review'
            : '/student/path'
        : '/student/check-in';
  const continueTitle =
    result.status === 'DIAGNOSED'
      ? `Tiếp tục lộ trình: ${currentRoot}`
      : result.status === 'FAST_PATH'
        ? result.nextItemId
          ? 'Thử thách vận dụng tiếp theo'
          : review
            ? `Ôn thông minh: ${kcName(review.kcId)}`
            : 'Đã hoàn thành mục tiêu hiện tại'
        : 'Kiểm tra nền tảng: Tỉ lệ thức';
  const continueAction =
    result.status === 'DIAGNOSED'
      ? 'Tiếp tục luyện tập'
      : result.status === 'FAST_PATH'
        ? result.nextItemId
          ? 'Nhận bài thử thách'
          : review
            ? review.isDue
              ? 'Bắt đầu lượt ôn'
              : 'Xem lịch ôn'
            : 'Xem kết quả'
        : started
          ? 'Tiếp tục làm bài'
          : 'Bắt đầu làm bài';

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
          <h2 id="continue-title">{continueTitle}</h2>
          <p>Hệ thống ưu tiên lỗ hổng hiện tại, phần từng sai đã cải thiện và phần lâu chưa ôn.</p>
        </div>
        <Link className="button-primary" to={continueDestination}>
          {continueAction}
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
              <dd>{localAnswers.length}</dd>
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
