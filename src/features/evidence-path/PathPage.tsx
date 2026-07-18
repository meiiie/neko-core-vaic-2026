import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deriveStudentLearningPlan,
  gradeBandVi,
  type StudentStepPhase,
} from '../../app/adapters/student-learning-plan';
import {
  diagnoseHero,
  DISPOSITION_LABELS,
  kcName,
  REASON_LABELS,
  STATUS_LABELS,
  toDomainEvents,
} from '../../app/adapters/hero-tutor';
import { reviewRecommendation, REVIEW_REASON_LABELS } from '../../app/adapters/review-selection';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { useSession } from '../../app/session';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import { curriculumCatalogDraft } from '../../content';
import { useLessonKcIds } from '../../services/lessons';
import { useResourceList } from '../../services/resources';
import { formatBytes } from '../../services/resources';
import { buildOfflinePlanManifest, downloadOfflinePlan } from '../../services/offline-plan';

const PHASE_LABELS: Readonly<Record<StudentStepPhase, string>> = {
  EXPLAIN: 'Xem hoặc đọc',
  GUIDED_PRACTICE: 'Luyện có gợi ý',
  POST_CHECK: 'Kiểm tra lại',
  DONE: 'Đã hoàn thành',
};

export function PathPage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);
  const lessonKcIds = useLessonKcIds();
  const resources = useResourceList();
  const [includeVideo, setIncludeVideo] = useState(true);
  const [offlineState, setOfflineState] = useState<
    'IDLE' | 'DOWNLOADING' | 'READY' | 'PARTIAL' | 'NO_SPACE'
  >('IDLE');
  const [downloadedBytes, setDownloadedBytes] = useState(0);

  if (migrationError) return <StudentDataFailure onRetry={retryMigration} />;
  if (localRecords === undefined || !learnerContext) {
    return <div className="page-loading" aria-label="Đang tải kế hoạch" />;
  }

  const diagnosis = diagnoseHero(learnerContext, localRecords);
  const plan = deriveStudentLearningPlan({
    diagnosis,
    catalog: curriculumCatalogDraft,
    records: localRecords,
    resources: resources ?? [],
  });
  const currentStep =
    plan.currentStepIndex === undefined ? undefined : plan.steps[plan.currentStepIndex];
  const recordedAnswerCount = toDomainEvents(localRecords).filter(
    (event) => event.learnerId === learnerContext.learnerId,
  ).length;
  const review = reviewRecommendation(
    learnerContext,
    diagnosis,
    localRecords,
    new Date().toISOString(),
  );
  const offlineManifest = buildOfflinePlanManifest(plan, resources ?? [], { includeVideo });

  if (plan.status === 'NEEDS_CHECK_IN' || plan.status === 'TEACHER_REVIEW') {
    const canCheckIn = plan.status === 'NEEDS_CHECK_IN';
    const hasRetainedAnswers = canCheckIn && recordedAnswerCount > 0;
    return (
      <div className="page-stack">
        <header className="page-heading">
          <p className="eyebrow">Kế hoạch của em</p>
          <h1>
            {hasRetainedAnswers
              ? 'Câu trả lời đã được ghi nhận, nhưng chưa đủ để tìm nguyên nhân gốc'
              : 'Chưa tạo kế hoạch học'}
          </h1>
          <p>
            {canCheckIn
              ? hasRetainedAnswers
                ? 'Dữ liệu học tập không bị mất; lộ trình tạm chưa hiển thị vì số câu hiện có chưa đủ để kết luận nguyên nhân gốc.'
                : 'Cần thêm một vài câu trả lời để phân biệt đúng phần kiến thức đang cản em.'
              : 'Bằng chứng hiện tại chưa đủ an toàn; giáo viên cần xem lại trước khi chọn phần ôn.'}
          </p>
          {hasRetainedAnswers ? (
            <p role="status">
              <strong>{recordedAnswerCount} câu trả lời đã được lưu trong hồ sơ.</strong>
            </p>
          ) : null}
        </header>
        {canCheckIn ? (
          <Link className="button-primary" to="/student/check-in">
            {hasRetainedAnswers
              ? 'Trả lời câu xác minh để mở lộ trình'
              : 'Trả lời câu phân biệt tiếp theo'}
          </Link>
        ) : (
          <p role="status" className="decision-panel decision-panel--review">
            Đã đưa vào danh sách để giáo viên xem xét. NekoPath không tự ép một nguyên nhân gốc.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Toán 7 · Cập nhật từ thiết bị này</p>
          <h1>Kế hoạch học của {account?.shortName}</h1>
          <p>Mỗi bước chỉ hoàn thành sau một câu kiểm tra lại độc lập.</p>
        </div>
        <span className="status-label status-label--evidence">
          {plan.status === 'FAST_PATH'
            ? 'Không cần học lại'
            : plan.status === 'COMPLETED'
              ? 'Đã hoàn thành'
              : `Bước ${plan.currentStepIndex! + 1}/${plan.steps.length}`}
        </span>
      </header>

      {currentStep ? (
        <section className="decision-panel" aria-labelledby="next-step-heading">
          <div>
            <p className="eyebrow">Việc tiếp theo · {gradeBandVi(currentStep.gradeLabels)}</p>
            <h2 id="next-step-heading">{currentStep.titleVi}</h2>
            <p>{currentStep.reasonVi}</p>
            <p>
              {PHASE_LABELS[currentStep.phase]} · Khoảng {currentStep.estimatedMinutes} phút
            </p>
          </div>
          <Link className="button-primary" to={currentStep.nextHref}>
            {currentStep.nextActionVi}
          </Link>
        </section>
      ) : null}

      {plan.steps.length > 0 ? (
        <section
          className="summary-panel offline-plan-panel"
          aria-labelledby="offline-plan-heading"
        >
          <div>
            <p className="eyebrow">Học khi mất mạng</p>
            <h2 id="offline-plan-heading">Gói ngoại tuyến của kế hoạch này</h2>
            {offlineManifest.resources.length > 0 ? (
              <p>
                {offlineState === 'DOWNLOADING'
                  ? `Đã tải ${formatBytes(downloadedBytes)} / ${formatBytes(offlineManifest.totalBytes)}`
                  : `${offlineManifest.resources.length} tệp · ${formatBytes(offlineManifest.totalBytes)}`}
              </p>
            ) : (
              <p>Tóm tắt chữ đã sẵn sàng ngoại tuyến; chưa có video/PDF đã duyệt để tải.</p>
            )}
            {offlineManifest.resources.some(
              (selected) =>
                resources?.find((resource) => resource.id === selected.id)?.kind === 'VIDEO',
            ) ? (
              <label className="offline-video-option">
                <input
                  type="checkbox"
                  checked={includeVideo}
                  disabled={offlineState === 'DOWNLOADING'}
                  onChange={(event) => setIncludeVideo(event.target.checked)}
                />{' '}
                Kèm video trong gói tải
              </label>
            ) : null}
            {offlineState === 'PARTIAL' ? (
              <p role="status">Một số tệp chưa tải xong. Có thể thử lại.</p>
            ) : null}
            {offlineState === 'NO_SPACE' ? (
              <p role="alert">Thiết bị không còn đủ dung lượng cho gói này.</p>
            ) : null}
            {offlineState === 'READY' ? (
              <p role="status">Gói ngoại tuyến đã sẵn sàng trên thiết bị.</p>
            ) : null}
          </div>
          {offlineManifest.resources.length > 0 ? (
            <button
              className="button-secondary"
              type="button"
              disabled={offlineState === 'DOWNLOADING'}
              onClick={() => {
                setOfflineState('DOWNLOADING');
                setDownloadedBytes(0);
                void downloadOfflinePlan(offlineManifest, (progress) =>
                  setDownloadedBytes(progress.completedBytes),
                ).then((result) => setOfflineState(result.status));
              }}
            >
              {offlineState === 'DOWNLOADING'
                ? 'Đang tải…'
                : `Tải để học ngoại tuyến · ${formatBytes(offlineManifest.totalBytes)}`}
            </button>
          ) : null}
        </section>
      ) : null}

      {plan.status === 'FAST_PATH' ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Em đã vững phần nền</p>
            <h2>Bài vận dụng tiếp theo</h2>
            <p>Không cần học lại phần em đã chứng minh là đã nắm chắc.</p>
          </div>
          <Link className="button-primary" to="/student/practice">
            Nhận bài vận dụng
          </Link>
        </section>
      ) : null}

      {plan.steps.length > 0 ? (
        <section className="path-panel" aria-labelledby="path-heading">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Kế hoạch phục hồi tối giản</p>
              <h2 id="path-heading">Từ kiến thức nền tới mục tiêu lớp 7</h2>
            </div>
            <span>{plan.steps.length} bước</span>
          </header>
          <ol className="path-steps">
            {plan.steps.map((step, index) => (
              <li key={step.kcId} data-current={step.status === 'CURRENT' || undefined}>
                <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <small>
                    {step.status === 'CURRENT'
                      ? 'Bước hiện tại'
                      : step.status === 'DONE'
                        ? 'Đã xong'
                        : 'Sắp tới'}{' '}
                    · {PHASE_LABELS[step.phase]}
                  </small>
                  <strong>{step.titleVi}</strong>
                  <small>
                    {gradeBandVi(step.gradeLabels)} · {step.estimatedMinutes} phút
                  </small>
                  <small>{step.reasonVi}</small>
                  <small>
                    {step.resourceIds.length > 0
                      ? `${step.resourceIds.length} học liệu đã duyệt`
                      : lessonKcIds?.has(step.kcId)
                        ? 'Tóm tắt chữ có sẵn ngoại tuyến'
                        : 'Tóm tắt chữ sẽ được tải khi có kết nối'}
                  </small>
                </span>
                {step.status === 'CURRENT' ? (
                  <Link className="step-lesson-link" to={step.nextHref}>
                    {step.nextActionVi}
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {plan.status === 'FAST_PATH' && review ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Kế hoạch duy trì tiếp theo</p>
            <h2>Ôn thông minh: {kcName(review.kcId)}</h2>
            <p>{REVIEW_REASON_LABELS[review.reason]}.</p>
          </div>
          <Link className="button-primary" to="/student/check-in?mode=review">
            {review.isDue ? 'Bắt đầu lượt ôn 3 câu' : 'Ôn sớm 3 câu'}
          </Link>
        </section>
      ) : null}

      <section className="audit-panel">
        <details>
          <summary>Xem căn cứ kỹ thuật</summary>
          <div className="audit-grid">
            <div>
              <h3>Trạng thái máy tính</h3>
              <p>{STATUS_LABELS[diagnosis.status]}</p>
            </div>
            <div>
              <h3>Quy tắc đã kích hoạt</h3>
              <ul>
                {diagnosis.reasonCodes.map((code) => (
                  <li key={code}>{REASON_LABELS[code]}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Số câu trả lời được dùng</h3>
              <p>{diagnosis.evidenceEventIds.length}</p>
            </div>
            <div>
              <h3>Bước xử lý</h3>
              <p>{DISPOSITION_LABELS[diagnosis.disposition]}</p>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
