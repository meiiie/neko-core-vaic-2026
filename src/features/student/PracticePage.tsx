import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  kcName,
  questionForItem,
} from '../../app/adapters/hero-tutor';
import { useSession } from '../../app/session';
import { practiceQuestionsForKc, type PracticeQuestion } from '../../content';
import { resolveTutorLlm, type TutorLlmResult } from '../../services/llm';
import { queueEventForSync } from '../../services/sync';
import type { LearnerEventRecord } from '../../storage/db';
import { appendEvent, listEventsByLearner } from '../../storage/event-repository';

type Phase = 'answering' | 'feedback';

interface FeedbackState {
  readonly correct: boolean;
  readonly choiceId: string;
  /** The question that was answered — frozen so live re-diagnosis cannot swap
   * the visible question while its feedback is still on screen. */
  readonly question: PracticeQuestion | null;
}

/** Pick the practice question of this KC with the fewest recorded attempts. */
function nextQuestion(
  kcId: string,
  records: readonly LearnerEventRecord[],
): PracticeQuestion | undefined {
  const questions = practiceQuestionsForKc(kcId);
  if (questions.length === 0) return undefined;
  const attempts = new Map<string, number>();
  for (const record of records) {
    attempts.set(record.itemId, (attempts.get(record.itemId) ?? 0) + 1);
  }
  return [...questions].sort(
    (a, b) => (attempts.get(a.itemId) ?? 0) - (attempts.get(b.itemId) ?? 0),
  )[0];
}

export function PracticePage() {
  const { account } = useSession();
  const learnerId = account?.learnerId ?? 'chi';
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('answering');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [explainState, setExplainState] = useState<{
    key: string;
    reply: TutorLlmResult;
  } | null>(null);
  const savingRef = useRef(false);

  const localRecords = useLiveQuery(() => listEventsByLearner(learnerId), [learnerId]);

  const result = localRecords === undefined ? null : diagnoseHero(learnerId, localRecords);
  const rootKcId = result?.status === 'DIAGNOSED' ? result.rootKcId : undefined;
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

  if (localRecords === undefined || result === null) {
    return <div className="page-loading" aria-label="Đang tải bài luyện tập" />;
  }

  // During feedback the answered question stays frozen on screen; the live
  // re-diagnosed "next" question only takes over after Tiếp tục/Thử lại.
  const upNext = rootKcId ? nextQuestion(rootKcId, localRecords) : undefined;
  const question = phase === 'feedback' && feedback?.question ? feedback.question : upNext;
  const transferQuestion =
    result.status === 'FAST_PATH' && result.nextItemId
      ? questionForItem(result.nextItemId)
      : undefined;

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
        learnerId,
        target.itemId,
        selectedChoiceId,
        correct,
        localRecords.length,
        misconceptionId
          ? { misconceptionId, methodValidity: 'INVALID' }
          : { methodValidity: 'UNKNOWN' },
      );
      await appendEvent(record);
      void queueEventForSync(record);
      setFeedback({ correct, choiceId: selectedChoiceId, question: answered });
      setPhase('feedback');
      if (!correct) {
        setWrongAttempts((count) => count + 1);
        setHintLevel((level) => Math.min(level + 1, 3));
      }
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
    // A correct answer moves on: reset the ladder for the next question.
    if (feedback?.correct) {
      setWrongAttempts(0);
      setHintLevel(0);
    }
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
          <Link className="button-secondary" to="/student/path">
            Xem lại lộ trình
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

  return (
    <div className="assessment-page">
      <header className="assessment-header">
        <div>
          <p className="eyebrow">Luyện tập · {kcName(rootKcId)}</p>
          <h1>Lấp lỗ hổng: {kcName(rootKcId)}</h1>
          <p>
            Trả lời đúng vài câu liên tiếp để chứng minh em đã vững — hệ thống sẽ tự chuyển sang
            bước tiếp theo.
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
                    <p className="eyebrow">Gợi ý {Math.min(hintLevel, 3)}/3</p>
                    <p>{question.hints[Math.min(hintLevel, 3) - 1]}</p>
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
              <dd>{wrongAttempts + (feedback?.correct ? 1 : 0)} lần</dd>
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
