import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  HERO_LEARNERS,
  isHeroLearnerId,
  kcName,
  questionForItem,
  STATUS_LABELS,
  UNREVIEWED_LABEL,
} from '../../app/adapters/hero-tutor';
import { appendEvent, listEventsByLearner } from '../../storage/event-repository';

const STATUS_TONE: Record<string, string> = {
  DIAGNOSED: 'status-label--evidence',
  NEEDS_MORE_EVIDENCE: 'status-label--review',
  OUT_OF_SCOPE: 'status-label--neutral',
  FAST_PATH: 'status-label--evidence',
};

/**
 * Student surface as one learning interaction: orientation strip, dominant
 * question, evidence state and local-save feedback close together. All
 * pedagogy comes from diagnose(); this component only renders and records.
 */
export function LearnPage() {
  const { learnerId } = useParams<{ learnerId: string }>();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savingRef = useRef(false);

  const localRecords = useLiveQuery(
    () => (learnerId ? listEventsByLearner(learnerId) : Promise.resolve([])),
    [learnerId],
  );

  if (!isHeroLearnerId(learnerId)) {
    return (
      <section className="section">
        <h1>Ngoài phạm vi demo</h1>
        <p className="evidence-note">
          Bản demo này chỉ có bốn hồ sơ mô phỏng: An, Bình, Chi, Minh.
        </p>
        <p>
          <Link to="/">Về trang chính</Link>
        </p>
      </section>
    );
  }

  if (localRecords === undefined) {
    return (
      <section className="section" aria-busy="true">
        <p>Đang đọc dữ liệu cục bộ…</p>
      </section>
    );
  }

  const profile = HERO_LEARNERS.find((hero) => hero.id === learnerId);
  const result = diagnoseHero(learnerId, localRecords);
  const targetQuestion = questionForItem('K10-CHECK-1');
  const probeQuestion = result.nextItemId ? questionForItem(result.nextItemId) : undefined;
  const currentStep = probeQuestion ? 2 : 3;

  async function answer(itemId: string, choiceId: string, correct: boolean) {
    if (!isHeroLearnerId(learnerId) || localRecords === undefined || savingRef.current) return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      await appendEvent(
        buildLocalAnswerRecord(learnerId, itemId, choiceId, correct, localRecords.length),
      );
      setSaveState('saved');
    } catch {
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <>
      <section className="section">
        <h1>
          Học sinh {profile?.label ?? learnerId}{' '}
          <span className="muted" style={{ fontSize: 'var(--text-base)', fontWeight: 400 }}>
            (hồ sơ mô phỏng: {learnerId})
          </span>
        </h1>
        <ol className="step-strip" aria-label="Tiến trình chẩn đoán">
          <li aria-current={undefined}>1. Bài toán mục tiêu</li>
          <li aria-current={currentStep === 2 ? 'step' : undefined}>2. Câu hỏi kiểm chứng</li>
          <li aria-current={currentStep === 3 ? 'step' : undefined}>3. Bù kiến thức / tiến tiếp</li>
        </ol>
        <p>
          <span className={`status-label ${STATUS_TONE[result.status] ?? 'status-label--neutral'}`}>
            {STATUS_LABELS[result.status]}
          </span>{' '}
          <Link to={`/path/${learnerId}`}>Xem bằng chứng và lộ trình</Link>
        </p>
      </section>

      {probeQuestion ? (
        <section className="action-panel action-panel--review" aria-labelledby="probe-heading">
          <h2 id="probe-heading">Câu hỏi kiểm chứng tiếp theo</h2>
          <p className="prompt">{probeQuestion.promptVi}</p>
          <div className="choice-list" role="group" aria-label="Các lựa chọn trả lời">
            {probeQuestion.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={saveState === 'saving'}
                onClick={() =>
                  void answer(
                    probeQuestion.itemId,
                    choice.id,
                    choice.id === probeQuestion.correctChoiceId,
                  )
                }
              >
                {choice.label}
              </button>
            ))}
          </div>
          {saveState === 'saving' && <p role="status">Đang lưu câu trả lời trên thiết bị…</p>}
          <p className="evidence-note">
            Vì sao hỏi câu này? Hệ thống đang phân biệt các giả thuyết gốc còn cạnh tranh
            {result.competingKcIds.length > 0
              ? `: ${result.competingKcIds.map((id) => kcName(id)).join(' và ')}`
              : ''}
            . {probeQuestion.hypothesisLabel}.
          </p>
          {saveState === 'saved' && (
            <p role="status">Đã lưu câu trả lời trên thiết bị này (không gửi lên máy chủ).</p>
          )}
          {saveState === 'error' && (
            <p role="alert" className="danger">
              Không lưu được câu trả lời — bộ nhớ trình duyệt có thể không khả dụng.
            </p>
          )}
        </section>
      ) : (
        <section className="action-panel" aria-labelledby="next-heading">
          <h2 id="next-heading">Không cần thêm câu hỏi kiểm chứng</h2>
          <p>
            Hệ thống đã đủ bằng chứng để kết luận hoặc đề xuất bước tiếp theo cho{' '}
            {profile?.label ?? learnerId}.
          </p>
          <p>
            <Link className="button-primary" to={`/path/${learnerId}`}>
              Xem lộ trình đề xuất
            </Link>
          </p>
        </section>
      )}

      <section className="section">
        <h2>Bài toán mục tiêu của lớp</h2>
        {targetQuestion ? <p className="prompt">{targetQuestion.promptVi}</p> : null}
        <p className="evidence-note">{UNREVIEWED_LABEL}.</p>
      </section>
    </>
  );
}
