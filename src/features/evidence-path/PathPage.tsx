import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import {
  diagnoseHero,
  DISPOSITION_LABELS,
  HERO_TARGET_KC_ID,
  kcName,
  misconceptionName,
  REASON_LABELS,
  STATUS_LABELS,
  toDomainEvents,
} from '../../app/adapters/hero-tutor';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { reviewRecommendation, REVIEW_REASON_LABELS } from '../../app/adapters/review-selection';
import { derivePathProgress } from '../../app/adapters/path-progression';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import { useLessonKcIds } from '../../services/lessons';

export function PathPage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const lessonKcIds = useLessonKcIds();
  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);

  if (migrationError) {
    return <StudentDataFailure onRetry={retryMigration} />;
  }

  if (localRecords === undefined || !learnerContext) {
    return <div className="page-loading" aria-label="Đang tải lộ trình" />;
  }

  const result = diagnoseHero(learnerContext, localRecords);
  const progress = derivePathProgress(learnerContext, result, localRecords);
  const displayedPathKcIds = progress?.pathKcIds ?? result.pathKcIds;
  const continuingKcId =
    result.status === 'NEEDS_MORE_EVIDENCE' ? progress?.currentKcId : undefined;
  const recordedAnswerCount = toDomainEvents(localRecords).filter(
    (event) => event.learnerId === learnerContext.learnerId,
  ).length;
  const review = reviewRecommendation(
    learnerContext,
    result,
    localRecords,
    new Date().toISOString(),
  );
  const supported = result.status === 'DIAGNOSED' || result.status === 'FAST_PATH';

  return (
    <div className="page-stack">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Hồ sơ học tập · Toán 7</p>
          <h1>Lộ trình của {account?.shortName}</h1>
          <p>Cập nhật từ các câu trả lời đã lưu trên thiết bị này.</p>
        </div>
        <span
          className={`status-label ${supported ? 'status-label--evidence' : 'status-label--review'}`}
        >
          {STATUS_LABELS[result.status]}
        </span>
      </header>

      {result.status === 'NEEDS_MORE_EVIDENCE' && !continuingKcId ? (
        <section className="decision-panel decision-panel--review">
          <div>
            <p className="eyebrow">Lộ trình đang chờ xác minh</p>
            <h2>
              {recordedAnswerCount > 0
                ? 'Câu trả lời đã được ghi nhận, nhưng chưa đủ bằng chứng trực tiếp để mở lộ trình'
                : 'Chưa đủ dữ liệu để mở lộ trình'}
            </h2>
            {recordedAnswerCount > 0 ? (
              <p role="status">
                <strong>{recordedAnswerCount} câu trả lời đã được lưu trong hồ sơ.</strong> Dữ liệu
                học tập không bị mất. NekoPath chưa chọn một lỗ hổng gốc vì các câu hiện có chưa đủ
                bằng chứng trực tiếp cho giả thuyết còn lại.
              </p>
            ) : (
              <p>Hệ thống chưa có câu trả lời trực tiếp phù hợp để đề xuất một lộ trình an toàn.</p>
            )}
            <p>
              {result.competingKcIds.length > 0
                ? result.competingKcIds.length === 1
                  ? `Còn một giả thuyết cần thêm bằng chứng trực tiếp: ${kcName(result.competingKcIds[0])}.`
                  : `${result.competingKcIds.length} hướng còn cạnh tranh: ${result.competingKcIds.map((id) => kcName(id)).join(' và ')}.`
                : 'Cần thêm một câu kiểm tra trực tiếp trước khi mở nội dung bù.'}
            </p>
          </div>
          {result.disposition === 'ASK_VERIFY' && result.nextItemId ? (
            <Link className="button-primary" to="/student/check-in">
              Trả lời câu xác minh để mở lộ trình
            </Link>
          ) : (
            <div className="decision-panel__action">
              <p className="eyebrow">Bước tiếp theo</p>
              <p role="status">
                <strong>Đã đưa vào danh sách giáo viên xem xét.</strong> NekoPath sẽ không tự mở một
                lộ trình chưa đủ căn cứ.
              </p>
              <Link className="button-secondary" to="/student/assignments">
                Xem bài được giao trong khi chờ
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {continuingKcId ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Lộ trình tiếp tục</p>
            <h2>Bước tiếp theo: {kcName(continuingKcId)}</h2>
            <p role="status">
              Bước trước đã được củng cố. NekoPath giữ nguyên đường học đã xác định và chuyển sang
              kiến thức kế tiếp; đây chưa phải là kết luận về một lỗ hổng gốc mới.
            </p>
          </div>
          <Link className="button-primary" to={`/student/practice?kc=${continuingKcId}`}>
            Luyện bước tiếp theo
          </Link>
        </section>
      ) : null}

      {result.rootKcId ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Trọng tâm được bằng chứng hỗ trợ</p>
            <h2>{kcName(result.rootKcId)}</h2>
            <p>
              NekoPath bỏ qua phần đã vững và chỉ giữ các bước cần thiết để quay lại mục tiêu lớp.
            </p>
          </div>
          <Link
            className="button-primary"
            to={`/student/practice?kc=${progress?.currentKcId ?? result.rootKcId}`}
          >
            Bắt đầu luyện tập
          </Link>
        </section>
      ) : null}

      {result.status === 'FAST_PATH' ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Sẵn sàng tiến tiếp</p>
            <h2>Không cần học lại phần đã nắm chắc</h2>
            <p>Bước tiếp theo là một bài toán chuyển giao thay vì lặp lại bài cơ bản.</p>
          </div>
          <Link className="button-primary" to="/student/practice">
            Nhận bài thử thách
          </Link>
        </section>
      ) : null}

      {displayedPathKcIds.length > 0 ? (
        <section className="path-panel" aria-labelledby="path-heading">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Đường học được đề xuất</p>
              <h2 id="path-heading">Từ kiến thức nền đến mục tiêu của lớp</h2>
            </div>
            <span>{displayedPathKcIds.length} bước</span>
          </header>
          <ol className="path-steps">
            {displayedPathKcIds.map((kcId, index) => {
              const stepStatus = progress?.steps.find((step) => step.kcId === kcId)?.status;
              const stepLabel =
                stepStatus === 'COMPLETED'
                  ? 'Đã hoàn thành'
                  : stepStatus === 'CURRENT'
                    ? 'Đang học'
                    : kcId === HERO_TARGET_KC_ID
                      ? 'Mục tiêu của lớp'
                      : index === 0
                        ? 'Bắt đầu ở đây'
                        : 'Chưa mở';
              const action =
                stepStatus === 'CURRENT' ? (
                  <Link className="step-lesson-link" to={`/student/practice?kc=${kcId}`}>
                    Luyện bước này
                  </Link>
                ) : stepStatus === 'COMPLETED' ? (
                  <Link
                    className="step-lesson-link"
                    to={`/student/practice?kc=${kcId}&mode=review`}
                  >
                    Ôn lại
                  </Link>
                ) : lessonKcIds?.has(kcId) ? (
                  <Link className="step-lesson-link" to={`/student/lesson/${kcId}`}>
                    Xem tóm tắt
                  </Link>
                ) : null;
              return (
                <li key={kcId} data-status={stepStatus?.toLowerCase()}>
                  <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <small>{stepLabel}</small>
                    <strong>{kcName(kcId)}</strong>
                  </span>
                  {action}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {result.status === 'FAST_PATH' && review ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Kế hoạch duy trì tiếp theo</p>
            <h2>Ôn thông minh: {kcName(review.kcId)}</h2>
            <p>{REVIEW_REASON_LABELS[review.reason]}.</p>
            {review.dueAt ? (
              <p>
                {review.isDue ? 'Đã đến hạn ôn' : 'Lịch ôn tiếp theo'}:{' '}
                <time dateTime={review.dueAt}>
                  {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
                    new Date(review.dueAt),
                  )}
                </time>
              </p>
            ) : null}
          </div>
          <Link className="button-primary" to="/student/check-in?mode=review">
            {review.isDue ? 'Bắt đầu lượt ôn 3 câu' : 'Ôn sớm 3 câu'}
          </Link>
        </section>
      ) : null}

      <section className="audit-panel">
        <details>
          <summary>Xem căn cứ kỹ thuật của quyết định</summary>
          <div className="audit-grid">
            <div>
              <h3>Quy tắc đã kích hoạt</h3>
              <ul>
                {result.reasonCodes.map((code) => (
                  <li key={code}>{REASON_LABELS[code]}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Bằng chứng được sử dụng</h3>
              <p>{result.evidenceEventIds.length} lượt trả lời theo đúng thứ tự thời gian.</p>
            </div>
            <div>
              <h3>Bước xử lý tiếp theo</h3>
              <p>{DISPOSITION_LABELS[result.disposition]}</p>
            </div>
            <div>
              <h3>Mẫu ngộ nhận đã quan sát</h3>
              {result.misconceptionHypotheses.length > 0 ? (
                <ul>
                  {result.misconceptionHypotheses.map((hypothesis) => (
                    <li key={`${hypothesis.kcId}:${hypothesis.misconceptionId}`}>
                      {misconceptionName(hypothesis.misconceptionId)} —{' '}
                      {hypothesis.verificationStatus === 'SUPPORTED_BY_MULTIPLE_ITEMS'
                        ? `lặp lại ở ${hypothesis.independentItemCount} câu hỏi khác nhau`
                        : 'mới có một quan sát, cần xác minh'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Chưa có đáp án nhiễu đủ rõ để nêu một mẫu ngộ nhận.</p>
              )}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
