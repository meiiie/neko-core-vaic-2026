import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  kcName,
  questionForItem,
  STATUS_LABELS,
} from '../../app/adapters/hero-tutor';
import { recordAnswer } from '../../services/sync';
import { listEventsByLearner } from '../../storage/event-repository';

const QUESTION_BUDGET = 3;

export function LearnPage() {
  const { account } = useSession();
  const learnerId = account?.learnerId ?? 'chi';
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savingRef = useRef(false);
  const localRecords = useLiveQuery(() => listEventsByLearner(learnerId), [learnerId]);

  if (localRecords === undefined) {
    return <div className="page-loading" aria-label="Đang tải bài kiểm tra" />;
  }

  const result = diagnoseHero(learnerId, localRecords);
  const probeQuestion = result.nextItemId ? questionForItem(result.nextItemId) : undefined;
  const targetQuestion = questionForItem('K10-CHECK-1');
  const questionNumber = Math.min(localRecords.length + 1, QUESTION_BUDGET);
  const progress = probeQuestion ? Math.round(((questionNumber - 1) / QUESTION_BUDGET) * 100) : 100;

  async function saveAnswer() {
    if (!probeQuestion || !selectedChoiceId || localRecords === undefined || savingRef.current)
      return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      const record = buildLocalAnswerRecord(
        learnerId,
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
      <header className="assessment-header">
        <div>
          <p className="eyebrow">Toán 7 · Chủ đề tỉ lệ thức</p>
          <h1>Bài kiểm tra nền tảng</h1>
          <p>Hệ thống chọn câu tiếp theo từ câu trả lời trước; tổng số câu có thể thay đổi.</p>
        </div>
        <span className="status-label status-label--neutral">Lưu trên thiết bị</span>
      </header>

      <div className="assessment-progress" aria-label={`Tiến độ ${progress}%`}>
        <div>
          <strong>{probeQuestion ? `Câu ${questionNumber}` : 'Hoàn thành'}</strong>
          <span>{probeQuestion ? `tối đa ${QUESTION_BUDGET} câu` : 'đã đủ bằng chứng'}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {probeQuestion ? (
        <div className="assessment-layout">
          <section className="question-panel" aria-labelledby="question-heading">
            <header>
              <span className="question-number" aria-hidden="true">
                {String(questionNumber).padStart(2, '0')}
              </span>
              <div>
                <p className="eyebrow">Chọn một đáp án</p>
                <h2 id="question-heading">{probeQuestion.promptVi}</h2>
              </div>
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
                Đã lưu. Câu tiếp theo được chọn từ bằng chứng mới.
              </p>
            ) : null}
            {saveState === 'error' ? (
              <p role="alert" className="error-message">
                Không lưu được câu trả lời. Hãy thử lại trên thiết bị này.
              </p>
            ) : null}
          </section>

          <aside className="assessment-context" aria-labelledby="context-heading">
            <p className="eyebrow">Mục tiêu của bài</p>
            <h2 id="context-heading">Tìm giá trị chưa biết trong tỉ lệ thức</h2>
            {targetQuestion ? <p>{targetQuestion.promptVi}</p> : null}
            <dl>
              <div>
                <dt>Trạng thái</dt>
                <dd>{STATUS_LABELS[result.status]}</dd>
              </div>
              <div>
                <dt>Đang phân biệt</dt>
                <dd>
                  {result.competingKcIds.length > 0
                    ? result.competingKcIds.map((id) => kcName(id)).join(' / ')
                    : 'Kiến thức nền liên quan'}
                </dd>
              </div>
            </dl>
            <details>
              <summary>Vì sao hệ thống hỏi câu này?</summary>
              <p>{probeQuestion.hypothesisLabel}.</p>
            </details>
          </aside>
        </div>
      ) : (
        <section className="completion-panel">
          <span className="completion-mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">Đã hoàn thành phiên kiểm tra</p>
          <h2>NekoPath đã có đủ bằng chứng cho bước tiếp theo</h2>
          <p>
            Bạn có thể xem kiến thức nền cần củng cố và đường học ngắn nhất đến mục tiêu của lớp.
          </p>
          <Link className="button-primary" to="/student/path">
            Xem lộ trình của tôi
          </Link>
        </section>
      )}
    </div>
  );
}
