import { ArrowLeftIcon } from '@phosphor-icons/react/ArrowLeft';
import { CheckCircleIcon } from '@phosphor-icons/react/CheckCircle';
import { InfoIcon } from '@phosphor-icons/react/Info';
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../app/session';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  kcIdForItem,
  kcName,
  questionForItem,
} from '../../app/adapters/hero-tutor';
import { reviewRecommendation, REVIEW_REASON_LABELS } from '../../app/adapters/review-selection';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import { recordAnswerWithReview } from '../../services/sync';
import { buildReviewScheduleRecord } from '../../storage/review-schedule-repository';

const QUESTION_BUDGET = 3;

export function LearnPage() {
  const { account } = useSession();
  const [searchParams] = useSearchParams();
  const learnerContext = studentContextForAccount(account);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [answeredThisRound, setAnsweredThisRound] = useState(0);
  const [reassessment, setReassessment] = useState(() => searchParams.get('mode') === 'review');
  const savingRef = useRef(false);
  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);

  if (migrationError) {
    return <StudentDataFailure onRetry={retryMigration} />;
  }

  if (localRecords === undefined || !learnerContext) {
    return <div className="page-loading" aria-label="Đang tải bài kiểm tra" />;
  }

  const activeLearnerContext = learnerContext;
  const result = diagnoseHero(activeLearnerContext, localRecords);
  const recommendedQuestion = result.nextItemId ? questionForItem(result.nextItemId) : undefined;
  const review = reassessment
    ? reviewRecommendation(activeLearnerContext, result, localRecords, new Date().toISOString())
    : undefined;
  // When the learner explicitly opened a review round (?mode=review or
  // "Kiểm tra lại"), serve ONLY a scheduled review item. The transfer
  // recommendation is a diagnostic "what's next" suggestion, not a review —
  // mixing them would silently serve the transfer item under a "review" entry.
  // The regular check-in keeps its original priority (recommended first).
  const candidateQuestion = reassessment
    ? review?.question
    : (recommendedQuestion ?? review?.question);
  const roundComplete = answeredThisRound >= QUESTION_BUDGET;
  const probeQuestion = roundComplete ? undefined : candidateQuestion;
  const questionNumber = answeredThisRound + 1;
  const canContinueAssessment =
    result.status === 'NEEDS_MORE_EVIDENCE' && candidateQuestion !== undefined;
  const reassessmentEmpty = reassessment && !review;

  async function saveAnswer() {
    if (!probeQuestion || !selectedChoiceId || localRecords === undefined || savingRef.current)
      return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      const record = buildLocalAnswerRecord(
        activeLearnerContext,
        probeQuestion.itemId,
        selectedChoiceId,
        selectedChoiceId === probeQuestion.correctChoiceId,
        localRecords.length,
      );
      const kcId = kcIdForItem(record.itemId);
      if (!kcId) throw new Error('UNKNOWN_REVIEW_KC');
      const reviewRecord = buildReviewScheduleRecord(record, kcId, localRecords);
      await recordAnswerWithReview(record, reviewRecord);
      setSelectedChoiceId(null);
      setSaveState('saved');
      setAnsweredThisRound((count) => count + 1);
    } catch {
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <div className="assessment-page">
      <header className="assessment-focus-header">
        <Link className="assessment-exit" to="/student">
          <ArrowLeftIcon aria-hidden="true" size={20} weight="bold" />
          Thoát bài
        </Link>
        <div className="assessment-title">
          <h1>Bài kiểm tra nền tảng</h1>
          <p>Toán 7 · Chủ đề tỉ lệ thức</p>
        </div>
        <span className="status-label status-label--neutral">Lưu trên thiết bị</span>
      </header>

      <div className="assessment-progress" aria-label="Tiến trình đánh giá">
        <span>Tiến trình đánh giá</span>
        <strong>{probeQuestion ? `Câu ${questionNumber}` : 'Hoàn thành'}</strong>
        <span>{probeQuestion ? 'Đang làm' : 'Đã hoàn thành'}</span>
      </div>

      {probeQuestion ? (
        <div className="assessment-layout">
          <section className="question-panel" aria-labelledby="question-heading">
            <header>
              <p className="question-step">Câu {questionNumber}</p>
              <h2 id="question-heading">{probeQuestion.promptVi}</h2>
            </header>

            <div className="answer-list" role="radiogroup" aria-labelledby="question-heading">
              {probeQuestion.choices.map((choice, index) => {
                const selected = selectedChoiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    className="answer-choice"
                    data-selected={selected || undefined}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={saveState === 'saving'}
                    onClick={() => {
                      setSelectedChoiceId(choice.id);
                      setSaveState('idle');
                    }}
                  >
                    <span className="choice-key" aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{choice.label}</span>
                  </button>
                );
              })}
            </div>

            {!selectedChoiceId && saveState !== 'saving' ? (
              <p className="answer-hint">Chọn một đáp án để tiếp tục</p>
            ) : null}

            <footer className="question-actions">
              <Link className="button-secondary" to="/student">
                Lưu và thoát
              </Link>
              <button
                className="button-primary"
                type="button"
                disabled={!selectedChoiceId || saveState === 'saving'}
                onClick={() => void saveAnswer()}
              >
                {saveState === 'saving' ? 'Đang lưu…' : 'Xác nhận và tiếp tục'}
              </button>
            </footer>

            {saveState === 'saved' ? (
              <p role="status" className="save-message">
                Đã lưu. Hệ thống sẽ chọn câu tiếp theo phù hợp với kết quả của em.
              </p>
            ) : null}
            {saveState === 'error' ? (
              <p role="alert" className="error-message">
                Không lưu được câu trả lời. Hãy thử lại trên thiết bị này.
              </p>
            ) : null}
          </section>

          <aside className="assessment-context" aria-labelledby="context-heading">
            <p className="eyebrow">Mục tiêu</p>
            <h2 id="context-heading">Tìm giá trị chưa biết trong tỉ lệ thức</h2>
            <div className="assessment-skill">
              <span>Kỹ năng đang đánh giá</span>
              <strong>
                {review
                  ? kcName(review.kcId)
                  : result.competingKcIds.length > 0
                    ? result.competingKcIds.map((id) => kcName(id)).join(' · ')
                    : 'Kiến thức nền liên quan'}
              </strong>
            </div>
            <p className="assessment-context-note">
              {review
                ? REVIEW_REASON_LABELS[review.reason]
                : 'Hệ thống cần thêm câu trả lời để đánh giá chính xác.'}
            </p>
            <details>
              <summary>
                <InfoIcon aria-hidden="true" size={18} />
                Vì sao?
              </summary>
              <p>
                Câu hỏi này giúp hệ thống hiểu rõ hơn kỹ năng nền nào em cần củng cố trước khi học
                tiếp.
              </p>
            </details>
          </aside>
        </div>
      ) : (
        <section className="completion-panel">
          <CheckCircleIcon
            className="completion-mark completion-mark--icon"
            aria-hidden="true"
            size={56}
            weight="fill"
          />
          <p className="eyebrow">Đã hoàn thành bài kiểm tra nền tảng</p>
          {reassessmentEmpty ? (
            <>
              <h2>Chưa có lượt ôn mới cho em lúc này</h2>
              <p role="status">
                Em đã trả lời đủ câu cho mục tiêu hiện tại. NekoPath chưa mở lượt ôn tiếp theo vì
                chưa đến lịch ôn giãn cách và chưa có câu vận dụng mới. Kết quả học của em vẫn được
                lưu đầy đủ.
              </p>
            </>
          ) : result.status === 'NEEDS_MORE_EVIDENCE' ? (
            <>
              <h2>Đã lưu câu trả lời của em</h2>
              <p>
                {canContinueAssessment
                  ? 'Hệ thống vẫn cần thêm bằng chứng. Câu tiếp theo sẽ được chọn từ kết quả của lượt này.'
                  : 'Chưa đủ bằng chứng để tạo lộ trình. Kết quả đã được chuyển cho giáo viên xem xét.'}
              </p>
            </>
          ) : (
            <>
              <h2>Đã có kết quả để chuẩn bị bước học tiếp theo</h2>
              <p>Em có thể xem kỹ năng cần củng cố và bước học phù hợp với kết quả vừa rồi.</p>
            </>
          )}
          {canContinueAssessment ? (
            <button
              className="button-primary"
              type="button"
              onClick={() => {
                setAnsweredThisRound(0);
                setSaveState('idle');
              }}
            >
              Làm tiếp lượt cần bằng chứng
            </button>
          ) : (
            <Link className="button-primary" to="/student/path">
              {result.status === 'NEEDS_MORE_EVIDENCE'
                ? 'Xem trạng thái bằng chứng'
                : 'Xem lộ trình của tôi'}
            </Link>
          )}
          {(result.status === 'DIAGNOSED' || result.status === 'FAST_PATH') &&
          !reassessmentEmpty ? (
            <button
              className="button-secondary"
              type="button"
              onClick={() => {
                setReassessment(true);
                setAnsweredThisRound(0);
                setSaveState('idle');
              }}
            >
              Kiểm tra lại để cập nhật lộ trình
            </button>
          ) : null}
        </section>
      )}
    </div>
  );
}
