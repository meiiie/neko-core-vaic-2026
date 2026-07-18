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
} from '../../app/adapters/hero-tutor';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { reviewRecommendation, REVIEW_REASON_LABELS } from '../../app/adapters/review-selection';
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
  const review = reviewRecommendation(learnerContext, result, localRecords);
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

      {result.status === 'NEEDS_MORE_EVIDENCE' ? (
        <section className="decision-panel decision-panel--review">
          <div>
            <p className="eyebrow">Quyết định an toàn</p>
            <h2>Chưa đủ bằng chứng để chọn một lỗ hổng gốc</h2>
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
              Làm câu kiểm tra tiếp theo
            </Link>
          ) : (
            <p role="status">Đã chuyển vào danh sách để giáo viên xem xét.</p>
          )}
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
          <Link className="button-primary" to="/student/practice">
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

      {result.pathKcIds.length > 0 ? (
        <section className="path-panel" aria-labelledby="path-heading">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Đường học được đề xuất</p>
              <h2 id="path-heading">Từ kiến thức nền đến mục tiêu của lớp</h2>
            </div>
            <span>{result.pathKcIds.length} bước</span>
          </header>
          <ol className="path-steps">
            {result.pathKcIds.map((kcId, index) => (
              <li key={kcId}>
                <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <small>
                    {index === 0
                      ? 'Bắt đầu ở đây'
                      : kcId === HERO_TARGET_KC_ID
                        ? 'Mục tiêu của lớp'
                        : 'Bước nối tiếp'}
                  </small>
                  <strong>{kcName(kcId)}</strong>
                </span>
                {lessonKcIds?.has(kcId) ? (
                  <Link className="step-lesson-link" to={`/student/lesson/${kcId}`}>
                    Ôn tóm tắt
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {result.status === 'FAST_PATH' && review ? (
        <section className="decision-panel">
          <div>
            <p className="eyebrow">Kế hoạch duy trì tiếp theo</p>
            <h2>Ôn thông minh: {kcName(review.kcId)}</h2>
            <p>{REVIEW_REASON_LABELS[review.reason]}.</p>
          </div>
          <Link className="button-primary" to="/student/check-in?mode=review">
            Bắt đầu lượt ôn 3 câu
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
