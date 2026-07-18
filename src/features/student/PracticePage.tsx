import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  kcIdForItem,
  kcName,
  questionForItem,
  toDomainEvents,
} from '../../app/adapters/hero-tutor';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { nextPracticeQuestion } from '../../app/adapters/practice-selection';
import { reviewRecommendation } from '../../app/adapters/review-selection';
import { useSession } from '../../app/session';
import { StudentDataFailure } from '../../components/StudentDataFailure';
import { type PracticeQuestion } from '../../content';
import { useLesson } from '../../services/lessons';
import { resolveTutorLlm, type TutorLlmResult } from '../../services/llm';
import { recordAnswerWithReview } from '../../services/sync';
import { buildReviewScheduleRecord } from '../../storage/review-schedule-repository';

type Phase = 'answering' | 'feedback';

interface FeedbackState {
  readonly correct: boolean;
  readonly choiceId: string;
  readonly eventId: string;
  /** The question that was answered — frozen so live re-diagnosis cannot swap
   * the visible question while its feedback is still on screen. */
  readonly question: PracticeQuestion | null;
}

export function PracticePage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const learnerId = learnerContext?.learnerId ?? '';
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [explainState, setExplainState] = useState<{
    key: string;
    reply: TutorLlmResult;
  } | null>(null);
  const savingRef = useRef(false);

  const {
    records: localRecords,
    migrationError,
    retryMigration,
  } = useStudentEvents(learnerContext);

  const result =
    localRecords === undefined || !learnerContext
      ? null
      : diagnoseHero(learnerContext, localRecords);
  const rootKcId = result?.status === 'DIAGNOSED' ? result.rootKcId : undefined;
  const rootLesson = useLesson(rootKcId ?? '');
  const explainKey = rootKcId ? `${learnerId}-${rootKcId}` : null;
  const explain = explainState && explainState.key === explainKey ? explainState.reply : null;

  // "Why am I practicing this" — through the LLM port (mock profile in L1).
  useEffect(() => {
    if (!explainKey || !rootKcId) return;
    let cancelled = false;
    const port = resolveTutorLlm();
    void port
      .complete({
        requestId: `${explainKey}-explain`,
        useCase: 'EXPLAIN_DIAGNOSIS',
        locale: 'vi-VN',
        facts: { status: 'DIAGNOSED', rootKcName: kcName(rootKcId) },
        allowedCitationIds: [],
        forbiddenStrings: [],
        fallbackText: `Em cần củng cố "${kcName(rootKcId)}" trước khi quay lại mục tiêu của lớp.`,
      })
      .then((reply) => {
        if (!cancelled) setExplainState({ key: explainKey, reply });
      });
    return () => {
      cancelled = true;
    };
  }, [explainKey, rootKcId]);

  if (migrationError) {
    return <StudentDataFailure onRetry={retryMigration} />;
  }

  if (localRecords === undefined || !learnerContext || result === null) {
    return <div className="page-loading" aria-label="Đang tải bài luyện tập" />;
  }
  const activeLearnerContext = learnerContext;

  // During feedback the answered question stays frozen on screen; the live
  // re-diagnosed "next" question only takes over after Tiếp tục/Thử lại.
  const upNext = rootKcId ? nextPracticeQuestion(rootKcId, localRecords) : undefined;
  const question = phase === 'feedback' && feedback?.question ? feedback.question : upNext;
  const transferQuestion =
    result.status === 'FAST_PATH' && result.nextItemId
      ? questionForItem(result.nextItemId)
      : undefined;
  const nextReview = reviewRecommendation(
    learnerContext,
    result,
    localRecords,
    new Date().toISOString(),
  );

  async function submitAnswer(
    target: { itemId: string; correctChoiceId: string },
    answered: PracticeQuestion | null,
  ): Promise<void> {
    if (!selectedChoiceId || savingRef.current || localRecords === undefined) return;
    savingRef.current = true;
    setSaveError(false);
    const correct = selectedChoiceId === target.correctChoiceId;
    const misconceptionId =
      answered?.choices.find((choice) => choice.id === selectedChoiceId)?.misconceptionTag ??
      questionForItem(target.itemId)?.choices.find((choice) => choice.id === selectedChoiceId)
        ?.misconceptionId;
    try {
      const record = buildLocalAnswerRecord(
        activeLearnerContext,
        target.itemId,
        selectedChoiceId,
        correct,
        localRecords.length,
        misconceptionId
          ? { misconceptionId, methodValidity: 'INVALID' }
          : { methodValidity: 'UNKNOWN' },
      );
      const kcId = kcIdForItem(record.itemId);
      if (!kcId) throw new Error('UNKNOWN_REVIEW_KC');
      const reviewRecord = buildReviewScheduleRecord(record, kcId, localRecords);
      await recordAnswerWithReview(record, reviewRecord);
      setFeedback({ correct, choiceId: selectedChoiceId, eventId: record.id, question: answered });
      setPhase('feedback');
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
    }
  }

  function continueSession() {
    setPhase('answering');
    setFeedback(null);
    setSelectedChoiceId(null);
  }

  // ---------- Completion / no-practice states ----------

  if (result.status === 'NEEDS_MORE_EVIDENCE') {
    return (
      <div className="page-stack">
        <header className="page-heading">
          <p className="eyebrow">Luyện tập</p>
          <h1>Chưa xác định được phần cần luyện</h1>
          <p>
            Hệ thống cần thêm bằng chứng trước khi chọn đúng bài cho em — hãy hoàn thành bài kiểm
            tra ngắn trước.
          </p>
        </header>
        <Link className="button-primary" to="/student/check-in">
          Làm bài kiểm tra ngắn
        </Link>
      </div>
    );
  }

  if (result.status === 'FAST_PATH' || (!question && !transferQuestion)) {
    return (
      <div className="page-stack">
        <section className="completion-panel">
          <span className="completion-mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">Lộ trình đã hoàn thành</p>
          <h2>Em đã vững các kiến thức nền của mục tiêu này</h2>
          {transferQuestion && phase === 'answering' ? (
            <>
              <p>Thử sức với bài vận dụng — không bắt buộc, nhưng rất đáng thử:</p>
              <section className="question-panel" aria-labelledby="transfer-heading">
                <header>
                  <span className="question-number" aria-hidden="true">
                    ★
                  </span>
                  <div>
                    <p className="eyebrow">Bài thử thách vận dụng</p>
                    <h2 id="transfer-heading">{transferQuestion.promptVi}</h2>
                  </div>
                </header>
                <div className="answer-list" role="radiogroup" aria-labelledby="transfer-heading">
                  {transferQuestion.choices.map((choice, index) => (
                    <button
                      key={choice.id}
                      className="answer-choice"
                      data-selected={selectedChoiceId === choice.id || undefined}
                      type="button"
                      role="radio"
                      aria-checked={selectedChoiceId === choice.id}
                      onClick={() => setSelectedChoiceId(choice.id)}
                    >
                      <span className="choice-key" aria-hidden="true">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{choice.label}</span>
                    </button>
                  ))}
                </div>
                <footer className="question-actions">
                  <Link className="button-secondary" to="/student">
                    Về tổng quan
                  </Link>
                  <button
                    className="button-primary"
                    type="button"
                    disabled={!selectedChoiceId}
                    onClick={() =>
                      void submitAnswer(
                        {
                          itemId: transferQuestion.itemId,
                          correctChoiceId: transferQuestion.correctChoiceId,
                        },
                        null,
                      )
                    }
                  >
                    Kiểm tra
                  </button>
                </footer>
              </section>
            </>
          ) : null}
          {phase === 'feedback' && feedback ? (
            <section
              className={feedback.correct ? 'feedback-panel is-correct' : 'feedback-panel is-wrong'}
              role="status"
            >
              <h3>{feedback.correct ? 'Chính xác — xuất sắc!' : 'Chưa đúng'}</h3>
              <p>
                {feedback.correct
                  ? 'Em đã vận dụng được tỉ lệ thức vào tình huống thực tế.'
                  : 'Bài vận dụng khó hơn bình thường — em có thể thử lại hoặc quay về tổng quan.'}
              </p>
              <button className="button-primary" type="button" onClick={continueSession}>
                {feedback.correct ? 'Hoàn tất' : 'Thử lại'}
              </button>
            </section>
          ) : null}
          {nextReview && (!transferQuestion || phase === 'feedback') ? (
            <Link className="button-primary" to="/student/check-in?mode=review">
              Bắt đầu lượt ôn thông minh tiếp theo
            </Link>
          ) : null}
          <Link className="button-secondary" to="/student/path">
            Xem kế hoạch học tiếp theo
          </Link>
        </section>
      </div>
    );
  }

  if (!question || !rootKcId) {
    return (
      <div className="page-stack">
        <header className="page-heading">
          <p className="eyebrow">Luyện tập</p>
          <h1>Chưa có bài luyện cho phần này</h1>
          <p>Nội dung luyện tập cho kiến thức này đang được biên soạn.</p>
        </header>
        <Link className="button-secondary" to="/student/path">
          Về lộ trình
        </Link>
      </div>
    );
  }

  // ---------- Active practice ----------

  const remainingPath = result.pathKcIds;
  const selectedChoice = question.choices.find((choice) => choice.id === feedback?.choiceId);
  const questionEvents = toDomainEvents(localRecords).filter(
    (event) => event.itemId === question.itemId,
  );
  const feedbackPendingInLiveQuery =
    feedback !== null && !questionEvents.some((event) => event.id === feedback.eventId);
  const attemptCount = questionEvents.length + (feedbackPendingInLiveQuery ? 1 : 0);
  const incorrectAttemptCount =
    questionEvents.filter((event) => !event.correct).length +
    (feedbackPendingInLiveQuery && feedback && !feedback.correct ? 1 : 0);
  const hintLevel = Math.min(Math.max(incorrectAttemptCount, 1), 3);

  return (
    <div className="assessment-page">
      <header className="assessment-header">
        <div>
          <p className="eyebrow">Luyện tập · {kcName(rootKcId)}</p>
          <h1>Lấp lỗ hổng: {kcName(rootKcId)}</h1>
          <p>
            Trả lời đúng vài câu liên tiếp để chứng minh em đã vững — hệ thống sẽ tự chuyển sang
            bước tiếp theo.
            {rootLesson?.lesson ? (
              <>
                {' '}
                <Link className="text-link" to={`/student/lesson/${rootKcId}`}>
                  Xem tóm tắt kiến thức trước
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <span className="status-label status-label--neutral">Lưu trên thiết bị</span>
      </header>

      {explain ? (
        <aside className="coach-note" aria-label="Vì sao em luyện phần này">
          <p>{explain.text}</p>
          <small>
            {explain.status === 'OK'
              ? 'Lời nhắn soạn tự động từ dữ kiện đã kiểm chứng.'
              : 'Lời nhắn dự phòng (nguồn AI tạm không khả dụng).'}
          </small>
        </aside>
      ) : null}

      <div className="assessment-layout">
        <section className="question-panel" aria-labelledby="practice-heading">
          <header>
            <span className="question-number" aria-hidden="true">
              {question.itemId.endsWith('1') ? '01' : '02'}
            </span>
            <div>
              <p className="eyebrow">Chọn một đáp án rồi bấm Kiểm tra</p>
              <h2 id="practice-heading">{question.promptVi}</h2>
            </div>
          </header>

          <div className="answer-list" role="radiogroup" aria-labelledby="practice-heading">
            {question.choices.map((choice, index) => {
              const selected = selectedChoiceId === choice.id;
              const showState =
                phase === 'feedback' &&
                (choice.id === question.correctChoiceId || choice.id === feedback?.choiceId);
              const stateClass =
                phase === 'feedback' && choice.id === question.correctChoiceId
                  ? 'is-correct'
                  : phase === 'feedback' && choice.id === feedback?.choiceId
                    ? 'is-wrong'
                    : '';
              return (
                <button
                  key={choice.id}
                  className={`answer-choice ${feedback && showState ? stateClass : ''}`}
                  data-selected={selected || undefined}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={phase === 'feedback'}
                  onClick={() => setSelectedChoiceId(choice.id)}
                >
                  <span className="choice-key" aria-hidden="true">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{choice.label}</span>
                </button>
              );
            })}
          </div>

          {phase === 'answering' ? (
            <footer className="question-actions">
              <Link className="button-secondary" to="/student/path">
                Lưu và thoát
              </Link>
              <button
                className="button-primary"
                type="button"
                disabled={!selectedChoiceId}
                onClick={() =>
                  void submitAnswer(
                    { itemId: question.itemId, correctChoiceId: question.correctChoiceId },
                    question,
                  )
                }
              >
                Kiểm tra
              </button>
            </footer>
          ) : feedback ? (
            <section
              className={feedback.correct ? 'feedback-panel is-correct' : 'feedback-panel is-wrong'}
              role="status"
            >
              <h3>{feedback.correct ? 'Chính xác!' : 'Chưa đúng — cùng xem lại nhé'}</h3>
              {feedback.correct ? (
                <p>{question.explanationVi}</p>
              ) : (
                <>
                  {selectedChoice?.noteVi ? <p>{selectedChoice.noteVi}</p> : null}
                  <div className="hint-ladder">
                    <p className="eyebrow">Gợi ý {hintLevel}/3</p>
                    <p>{question.hints[hintLevel - 1]}</p>
                  </div>
                </>
              )}
              <button className="button-primary" type="button" onClick={continueSession}>
                {feedback.correct ? 'Tiếp tục' : 'Thử lại'}
              </button>
            </section>
          ) : null}

          {saveError ? (
            <p role="alert" className="error-message">
              Không lưu được câu trả lời. Hãy thử lại trên thiết bị này.
            </p>
          ) : null}
        </section>

        <aside className="assessment-context" aria-labelledby="practice-context">
          <p className="eyebrow">Đường đến mục tiêu</p>
          <h2 id="practice-context">Còn {remainingPath.length} bước</h2>
          <ol className="mini-path">
            {remainingPath.map((kcId, index) => (
              <li key={kcId} data-current={index === 0 || undefined}>
                {kcName(kcId)}
              </li>
            ))}
          </ol>
          <dl>
            <div>
              <dt>Số lần thử câu này</dt>
              <dd>{attemptCount} lần</dd>
            </div>
          </dl>
          <details>
            <summary>Nội dung này từ đâu?</summary>
            <p>{question.hypothesisLabel}.</p>
          </details>
        </aside>
      </div>
    </div>
  );
}
