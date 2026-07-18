import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { derivePathProgress } from '../../app/adapters/path-progression';
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
  const [searchParams] = useSearchParams();
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
  const progress =
    result && localRecords && learnerContext
      ? derivePathProgress(learnerContext, result, localRecords)
      : undefined;
  const requestedKcId = searchParams.get('kc') ?? undefined;
  const requestedStep = requestedKcId
    ? progress?.steps.find((step) => step.kcId === requestedKcId)
    : undefined;
  const lockedRequestedKcId = requestedStep?.status === 'UPCOMING' ? requestedStep.kcId : undefined;
  const confirmationMode = searchParams.get('mode') === 'confirm';
  const explicitReview = searchParams.get('mode') === 'review';
  // When the learner just mastered the requested step (it flipped to COMPLETED
  // during this session), do NOT pin them on the finished KC and do NOT silently
  // enter review/repeat mode — follow the live `currentKcId` so the path
  // advances in place. Only an explicit ?mode=review keeps them practising the
  // completed KC; ?mode=confirm is an intentional labelled repeat.
  const requestedAdvancedAway =
    requestedStep?.status === 'COMPLETED' && !explicitReview && !confirmationMode;
  const reviewMode = explicitReview || (requestedStep?.status === 'COMPLETED' && confirmationMode);
  const activeKcId = lockedRequestedKcId
    ? undefined
    : requestedStep && !requestedAdvancedAway
      ? requestedStep.kcId
      : (progress?.currentKcId ?? (result?.status === 'DIAGNOSED' ? result.rootKcId : undefined));
  const activeLesson = useLesson(activeKcId ?? '');
  const explainedRootKcId =
    result?.status === 'DIAGNOSED' && result.rootKcId === activeKcId ? activeKcId : undefined;
  const explainKey = explainedRootKcId ? `${learnerId}-${explainedRootKcId}` : null;
  const explain = explainState && explainState.key === explainKey ? explainState.reply : null;

  // "Why am I practicing this" — through the LLM port (mock profile in L1).
  useEffect(() => {
    if (!explainKey || !explainedRootKcId) return;
    let cancelled = false;
    const port = resolveTutorLlm();
    void port
      .complete({
        requestId: `${explainKey}-explain`,
        useCase: 'EXPLAIN_DIAGNOSIS',
        locale: 'vi-VN',
        facts: { status: 'DIAGNOSED', rootKcName: kcName(explainedRootKcId) },
        allowedCitationIds: [],
        forbiddenStrings: [],
        fallbackText: `Em cần củng cố "${kcName(explainedRootKcId)}" trước khi quay lại mục tiêu của lớp.`,
      })
      .then((reply) => {
        if (!cancelled) setExplainState({ key: explainKey, reply });
      });
    return () => {
      cancelled = true;
    };
  }, [explainKey, explainedRootKcId]);

  if (migrationError) {
    return <StudentDataFailure onRetry={retryMigration} />;
  }

  if (localRecords === undefined || !learnerContext || result === null) {
    return <div className="page-loading" aria-label="Đang tải bài luyện tập" />;
  }
  const activeLearnerContext = learnerContext;

  // During feedback the answered question stays frozen on screen; the live
  // re-diagnosed "next" question only takes over after Tiếp tục/Thử lại.
  const upNext = activeKcId
    ? nextPracticeQuestion(activeKcId, localRecords, {
        allowRepeat: reviewMode || confirmationMode,
      })
    : undefined;
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

  if (lockedRequestedKcId && progress?.currentKcId) {
    return (
      <div className="page-stack">
        <section className="empty-state">
          <p className="eyebrow">Bước chưa mở</p>
          <h1>Hoàn thành {kcName(progress.currentKcId)} trước</h1>
          <p>
            {kcName(lockedRequestedKcId)} nằm ở bước sau. NekoPath không bỏ qua bước hiện tại vì
            chưa có bài kiểm tra xác nhận.
          </p>
          <Link className="button-primary" to={`/student/practice?kc=${progress.currentKcId}`}>
            Tiếp tục bước đang học
          </Link>
        </section>
      </div>
    );
  }

  if (result.status === 'NEEDS_MORE_EVIDENCE' && !progress?.currentKcId) {
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

  // A learner who explicitly asked to review a completed step (?mode=review
  // with a valid ?kc=) must reach the active-practice branch, not be bounced to
  // the "path complete" panel. The panel below only renders when there is no
  // explicit review request, or the requested KC is missing.
  const explicitReviewRequest = explicitReview && requestedStep !== undefined;
  if ((result.status === 'FAST_PATH' || progress?.isComplete) && !explicitReviewRequest) {
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
          {!transferQuestion && !nextReview ? (
            <p role="status" className="eyebrow">
              Chưa có bài vận dụng hay lượt ôn mới cho mục tiêu này. Em có thể ôn lại từng bước từ
              lộ trình khi muốn.
            </p>
          ) : null}
          <Link className="button-secondary" to="/student/path">
            Xem kế hoạch học tiếp theo
          </Link>
        </section>
      </div>
    );
  }

  if (activeKcId && !question && !transferQuestion) {
    return (
      <div className="page-stack">
        <section className="decision-panel decision-panel--review">
          <div>
            <p className="eyebrow">Cần thêm câu kiểm tra</p>
            <h1>Đã làm hết câu hỏi khác nhau của bước {kcName(activeKcId)}</h1>
            <p role="status">
              NekoPath không lặp lại âm thầm một câu đã làm đúng và cũng không coi hết câu hỏi là
              hoàn thành lộ trình. Giáo viên cần bổ sung hoặc xác nhận thêm bằng chứng cho bước này.
            </p>
          </div>
          <div className="decision-panel__action">
            <Link className="button-primary" to={`/student/practice?kc=${activeKcId}&mode=confirm`}>
              Làm một câu xác nhận lại
            </Link>
            <Link className="button-secondary" to="/student/path">
              Về lộ trình
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!question || !activeKcId) {
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

  const remainingSteps =
    progress?.steps ??
    result.pathKcIds.map((kcId, index) => ({
      kcId,
      status: index === 0 ? ('CURRENT' as const) : ('UPCOMING' as const),
    }));
  const remainingCount = remainingSteps.filter((step) => step.status !== 'COMPLETED').length;
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
  const isRootRemediation =
    result.status === 'DIAGNOSED' && result.rootKcId === activeKcId && !reviewMode;
  // The KC whose question is frozen on the feedback screen. When the live path
  // has moved past it (currentKcId advanced), we surface a "step completed"
  // notice and route the learner to the next KC instead of looping back into
  // the finished one.
  const feedbackKcId = feedback?.question?.kcId ?? null;
  const feedbackStep = feedbackKcId
    ? progress?.steps.find((step) => step.kcId === feedbackKcId)
    : undefined;
  const stepJustCompleted =
    feedback?.correct === true &&
    feedbackStep?.status === 'COMPLETED' &&
    !confirmationMode &&
    !reviewMode;

  return (
    <div className="assessment-page">
      <header className="assessment-header">
        <div>
          <p className="eyebrow">
            {confirmationMode ? 'Câu xác nhận' : reviewMode ? 'Ôn lại' : 'Luyện tập'} ·{' '}
            {kcName(activeKcId)}
          </p>
          <h1>
            {confirmationMode
              ? `Xác nhận bước: ${kcName(activeKcId)}`
              : reviewMode
                ? `Ôn lại: ${kcName(activeKcId)}`
                : isRootRemediation
                  ? `Lấp lỗ hổng: ${kcName(activeKcId)}`
                  : `Bước tiếp theo: ${kcName(activeKcId)}`}
          </h1>
          <p>
            {confirmationMode
              ? 'Câu này được lặp lại có chủ đích vì ngân hàng hiện chưa có câu kiểm tra thứ ba đã duyệt.'
              : reviewMode
                ? 'Đây là lượt ôn có chủ đích; câu đã gặp có thể xuất hiện lại.'
                : 'Mỗi câu hỏi khác nhau chỉ được tính cho đúng bước này. Khi đủ bằng chứng, hệ thống sẽ chuyển sang bước kế tiếp.'}
            {activeLesson?.lesson ? (
              <>
                {' '}
                <Link className="text-link" to={`/student/lesson/${activeKcId}`}>
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
              <p className="eyebrow">
                {questionEvents.length > 0 && !reviewMode
                  ? 'Thử lại câu từng sai sau khi xem gợi ý'
                  : 'Chọn một đáp án rồi bấm Kiểm tra'}
              </p>
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
                <>
                  <p>{question.explanationVi}</p>
                  {stepJustCompleted && feedbackKcId ? (
                    <p className="eyebrow">
                      Đã hoàn thành bước {kcName(feedbackKcId)} — đủ bằng chứng trực tiếp.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  {selectedChoice?.noteVi ? <p>{selectedChoice.noteVi}</p> : null}
                  <div className="hint-ladder">
                    <p className="eyebrow">Gợi ý {hintLevel}/3</p>
                    <p>{question.hints[hintLevel - 1]}</p>
                  </div>
                </>
              )}
              {feedback.correct && confirmationMode ? (
                <Link className="button-primary" to="/student/path">
                  Xem bước tiếp theo
                </Link>
              ) : stepJustCompleted && progress?.currentKcId ? (
                <Link
                  className="button-primary"
                  to={`/student/practice?kc=${progress.currentKcId}`}
                >
                  Tiếp tục bước kế tiếp: {kcName(progress.currentKcId)}
                </Link>
              ) : (
                <button className="button-primary" type="button" onClick={continueSession}>
                  {feedback.correct ? 'Tiếp tục' : 'Thử lại'}
                </button>
              )}
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
          <h2 id="practice-context">Còn {remainingCount} bước</h2>
          <ol className="mini-path">
            {remainingSteps.map((step) => (
              <li
                key={step.kcId}
                data-current={step.status === 'CURRENT' || undefined}
                data-completed={step.status === 'COMPLETED' || undefined}
              >
                {kcName(step.kcId)}
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
