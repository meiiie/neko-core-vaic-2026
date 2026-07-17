import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buildLocalAnswerRecord,
  diagnoseHero,
  isHeroLearnerId,
  questionForItem,
  STATUS_LABELS,
  UNREVIEWED_LABEL,
} from '../../app/adapters/hero-tutor';
import { appendEvent, listEventsByLearner } from '../../storage/event-repository';

/**
 * Student surface: shows the shared target task, then whichever probe the
 * domain core requests next. All pedagogy comes from diagnose(); this
 * component only renders results and records answers locally.
 */
export function LearnPage() {
  const { learnerId } = useParams<{ learnerId: string }>();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const localRecords = useLiveQuery(
    () => (learnerId ? listEventsByLearner(learnerId) : Promise.resolve([])),
    [learnerId],
  );

  if (!isHeroLearnerId(learnerId)) {
    return (
      <section className="card">
        <h2>Ngoài phạm vi demo</h2>
        <p className="placeholder-note">
          Bản demo này chỉ có bốn hồ sơ mô phỏng: an, binh, chi, minh.
        </p>
        <p>
          <Link to="/">Về trang chính</Link>
        </p>
      </section>
    );
  }

  if (localRecords === undefined) {
    return (
      <section className="card" aria-busy="true">
        <p>Đang đọc dữ liệu cục bộ…</p>
      </section>
    );
  }

  const result = diagnoseHero(learnerId, localRecords);
  const targetQuestion = questionForItem('K10-CHECK-1');
  const probeQuestion = result.nextItemId ? questionForItem(result.nextItemId) : undefined;

  async function answer(itemId: string, choiceId: string, correct: boolean) {
    if (!isHeroLearnerId(learnerId) || localRecords === undefined) return;
    setSaveState('saving');
    try {
      await appendEvent(
        buildLocalAnswerRecord(learnerId, itemId, choiceId, correct, localRecords.length),
      );
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <>
      <section className="card">
        <h2>Bài toán chung của lớp — {learnerId}</h2>
        {targetQuestion ? (
          <>
            <p>{targetQuestion.promptVi}</p>
            <p className="placeholder-note">{UNREVIEWED_LABEL}</p>
          </>
        ) : null}
        <p>
          Trạng thái chẩn đoán hiện tại: <strong>{STATUS_LABELS[result.status]}</strong>
        </p>
        <p>
          <Link to={`/path/${learnerId}`}>Xem bằng chứng và lộ trình chi tiết</Link>
        </p>
      </section>

      {probeQuestion ? (
        <section className="card">
          <h2>Câu hỏi tiếp theo do hệ thống chọn</h2>
          <p>{probeQuestion.promptVi}</p>
          <p className="placeholder-note">{probeQuestion.hypothesisLabel}</p>
          <div role="group" aria-label="Các lựa chọn trả lời">
            {probeQuestion.choices.map((choice) => (
              <p key={choice.id}>
                <button
                  type="button"
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
              </p>
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>Không cần thêm câu hỏi chẩn đoán</h2>
          <p className="placeholder-note">
            Hệ thống đã đủ bằng chứng để kết luận hoặc đề xuất bước tiếp theo — xem chi tiết ở trang
            lộ trình.
          </p>
        </section>
      )}

      {saveState === 'saved' && (
        <p role="status">Đã lưu câu trả lời trên thiết bị này (không gửi lên máy chủ).</p>
      )}
      {saveState === 'error' && (
        <p role="alert" className="danger">
          Không lưu được câu trả lời — bộ nhớ trình duyệt có thể không khả dụng.
        </p>
      )}
    </>
  );
}
