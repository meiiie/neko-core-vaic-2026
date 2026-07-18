import { ArrowLeftIcon } from '@phosphor-icons/react/ArrowLeft';
import { CheckCircleIcon } from '@phosphor-icons/react/CheckCircle';
import { InfoIcon } from '@phosphor-icons/react/Info';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  kcName,
  questionForItem,
} from '../../app/adapters/hero-tutor';
import { studentContextForAccount, useStudentEvents } from '../../app/adapters/student-context';
import { recordAnswer } from '../../services/sync';

const QUESTION_BUDGET = 3;

export function LearnPage() {
  const { account } = useSession();
  const learnerContext = studentContextForAccount(account);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savingRef = useRef(false);
  const localRecords = useStudentEvents(learnerContext);

  if (localRecords === undefined || !learnerContext) {
    return <div className="page-loading" aria-label="Đang tải bài kiểm tra" />;
  }

  const activeLearnerContext = learnerContext;
  const result = diagnoseHero(activeLearnerContext, localRecords);
  const probeQuestion = result.nextItemId ? questionForItem(result.nextItemId) : undefined;
  const questionNumber = Math.min(localRecords.length + 1, QUESTION_BUDGET);

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
      await recordAnswer(record);
      setSelectedChoiceId(null);
      setSaveState('saved');
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
                {result.competingKcIds.length > 0
                  ? result.competingKcIds.map((id) => kcName(id)).join(' · ')
                  : 'Kiến thức nền liên quan'}
              </strong>
            </div>
            <p className="assessment-context-note">
              Hệ thống cần thêm câu trả lời để đánh giá chính xác.
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
          {result.status === 'NEEDS_MORE_EVIDENCE' ? (
            <>
              <h2>Đã lưu câu trả lời của em</h2>
              <p>Hệ thống cần thêm câu trả lời trước khi đưa ra đánh giá chính xác.</p>
            </>
          ) : (
            <>
              <h2>Đã có kết quả để chuẩn bị bước học tiếp theo</h2>
              <p>Em có thể xem kỹ năng cần củng cố và bước học phù hợp với kết quả vừa rồi.</p>
            </>
          )}
          <Link className="button-primary" to="/student/path">
            Xem lộ trình của tôi
          </Link>
        </section>
      )}
    </div>
  );
}
