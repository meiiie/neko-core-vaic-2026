import { Link } from 'react-router-dom';
import { deriveStudentLearningPlan, gradeBandVi } from '../../app/adapters/student-learning-plan';
import { diagnoseHero } from '../../app/adapters/hero-tutor';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { useSession } from '../../app/session';
import { greetingVi, todayVi } from '../../app/vietnamese-time';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import { curriculumCatalogDraft } from '../../content';
import { useResourceList } from '../../services/resources';

export function StudentDashboardPage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);
  const resources = useResourceList();

  if (migrationError) return <StudentDataFailure onRetry={retryMigration} />;
  if (localRecords === undefined || !learnerContext) {
    return <div className="page-loading" aria-label="Đang tải tổng quan" />;
  }

  const now = new Date();
  const diagnosis = diagnoseHero(learnerContext, localRecords);
  const plan = deriveStudentLearningPlan({
    diagnosis,
    catalog: curriculumCatalogDraft,
    records: localRecords,
    resources: resources ?? [],
  });
  const currentStep =
    plan.currentStepIndex === undefined ? undefined : plan.steps[plan.currentStepIndex];

  const hero = (() => {
    if (plan.status === 'NEEDS_CHECK_IN') {
      return {
        eyebrow: 'Bắt đầu hôm nay',
        meta: `Tối đa ${plan.checkInQuestionLimit} câu · Không tính điểm`,
        title: 'Kiểm tra nền tảng để tìm đúng phần cần ôn',
        description:
          'Các câu hỏi ngắn giúp tìm mắt xích đang cản bài lớp 7, không dùng để xếp hạng em.',
        href: '/student/check-in',
        action: 'Bắt đầu kiểm tra nền tảng',
      };
    }
    if (currentStep) {
      return {
        eyebrow: `Bước ${plan.currentStepIndex! + 1}/${plan.steps.length} · ${gradeBandVi(currentStep.gradeLabels)}`,
        meta: `Khoảng ${currentStep.estimatedMinutes} phút`,
        title: `Học bước ${plan.currentStepIndex! + 1}: ${currentStep.titleVi}`,
        description: currentStep.reasonVi,
        href: currentStep.nextHref,
        action: currentStep.nextActionVi,
      };
    }
    if (plan.status === 'FAST_PATH') {
      return {
        eyebrow: 'Em đã vững phần nền',
        meta: 'Không cần học lại',
        title: 'Bài vận dụng tiếp theo',
        description: 'NekoPath bỏ qua phần em đã nắm chắc và chuyển thẳng tới bài thử thách.',
        href: '/student/practice',
        action: 'Nhận bài vận dụng',
      };
    }
    if (plan.status === 'COMPLETED') {
      return {
        eyebrow: 'Kế hoạch hiện tại đã xong',
        meta: `${plan.steps.length} bước hoàn thành`,
        title: 'Em đã hoàn thành phần phục hồi',
        description: 'Xem lịch ôn giãn cách hoặc bài vận dụng tiếp theo.',
        href: '/student/path',
        action: 'Xem kế hoạch tiếp theo',
      };
    }
    return {
      eyebrow: 'Giáo viên sẽ hỗ trợ',
      meta: 'Không tự gán lỗ hổng',
      title: 'Cần giáo viên xem lại trước khi tạo kế hoạch',
      description: 'Bằng chứng hiện tại chưa đủ an toàn để chọn một nguyên nhân gốc.',
      href: '/student/path',
      action: 'Xem trạng thái',
    };
  })();

  const misconception = diagnosis.misconceptionHypotheses.find(
    (item) => item.verificationStatus === 'SUPPORTED_BY_MULTIPLE_ITEMS',
  );

  return (
    <div className="page-stack">
      <header className="page-heading">
        <h1>
          {greetingVi(now.getHours())}, {account?.shortName}
        </h1>
        <p className="page-meta">
          {todayVi(now)} · Toán 7 · {account?.className ?? 'Chưa gán lớp'}
        </p>
      </header>

      <section className="continue-card" aria-labelledby="continue-title">
        <span className="hero-icon" aria-hidden="true">
          ▶
        </span>
        <div className="continue-copy">
          <p className="hero-label-row">
            <span className="hero-label">{hero.eyebrow}</span>
            <span className="hero-meta">{hero.meta}</span>
          </p>
          <h2 id="continue-title">{hero.title}</h2>
          <p>{hero.description}</p>
        </div>
        <Link className="button-primary" to={hero.href}>
          {hero.action}
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Kế hoạch học hôm nay">
        <article className="summary-panel summary-panel--wide">
          <header className="panel-top">
            <h2>Kế hoạch của em</h2>
            <span className="status-label status-label--evidence">
              {currentStep
                ? `Bước ${plan.currentStepIndex! + 1}/${plan.steps.length}`
                : plan.status === 'NEEDS_CHECK_IN'
                  ? 'Chưa tạo kế hoạch'
                  : 'Đã cập nhật'}
            </span>
          </header>
          {currentStep ? (
            <>
              <p className="focus-line">
                <strong>{currentStep.titleVi}</strong> · {gradeBandVi(currentStep.gradeLabels)}
              </p>
              <p className="muted">{currentStep.reasonVi}</p>
            </>
          ) : (
            <p className="muted">
              {plan.status === 'NEEDS_CHECK_IN'
                ? 'Hoàn thành bài kiểm tra nền tảng ngắn để nhận kế hoạch riêng.'
                : 'Không có bước phục hồi đang chờ.'}
            </p>
          )}
          <Link className="text-link" to="/student/path">
            Xem kế hoạch đầy đủ
          </Link>
        </article>

        <aside className="summary-panel" aria-labelledby="why-this-step">
          <h2 id="why-this-step">Vì sao em học bước này?</h2>
          {currentStep ? (
            <>
              <p>{currentStep.reasonVi}</p>
              {misconception ? (
                <p className="muted">
                  Em đã lặp lại cùng một cách sai ở {misconception.independentItemCount} câu khác
                  nhau.
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted">
              NekoPath chỉ tạo kế hoạch khi câu trả lời đủ rõ; nếu chưa rõ, hệ thống sẽ hỏi thêm.
            </p>
          )}
        </aside>
      </section>
    </div>
  );
}
