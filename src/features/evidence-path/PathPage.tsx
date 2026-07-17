import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import {
  diagnoseHero,
  HERO_LEARNERS,
  HERO_TARGET_KC_ID,
  isHeroLearnerId,
  kcName,
  REASON_LABELS,
  STATUS_LABELS,
  UNREVIEWED_LABEL,
} from '../../app/adapters/hero-tutor';
import { listEventsByLearner } from '../../storage/event-repository';

/**
 * Evidence & path surface in three levels (§4): decision → action trail →
 * expandable audit detail. Renders the DiagnosisResult contract verbatim.
 */
export function PathPage() {
  const { learnerId } = useParams<{ learnerId: string }>();

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

  const decisionTone =
    result.status === 'DIAGNOSED' || result.status === 'FAST_PATH'
      ? 'status-label--evidence'
      : result.status === 'NEEDS_MORE_EVIDENCE'
        ? 'status-label--review'
        : 'status-label--neutral';

  return (
    <>
      <section className="section">
        <h1>
          Bằng chứng &amp; lộ trình — {profile?.label ?? learnerId}{' '}
          <span className="muted" style={{ fontSize: 'var(--text-base)', fontWeight: 400 }}>
            (hồ sơ mô phỏng: {learnerId})
          </span>
        </h1>
        <p>
          <span className={`status-label ${decisionTone}`}>{STATUS_LABELS[result.status]}</span>
        </p>
        {result.rootKcId ? (
          <p style={{ fontSize: 'var(--text-lg)' }}>
            Lỗ hổng gốc theo bằng chứng: <strong>{kcName(result.rootKcId)}</strong>
          </p>
        ) : null}
        <p className="evidence-note">{UNREVIEWED_LABEL}.</p>
      </section>

      {result.status === 'NEEDS_MORE_EVIDENCE' ? (
        <section className="action-panel action-panel--review">
          <h2>Chưa kết luận — hai giả thuyết còn cạnh tranh</h2>
          {result.competingKcIds.length > 0 ? (
            <ul>
              {result.competingKcIds.map((id) => (
                <li key={id}>
                  <strong>{kcName(id)}</strong> — chưa đủ bằng chứng trực tiếp để khẳng định hay
                  loại trừ
                </li>
              ))}
            </ul>
          ) : null}
          <p>Hệ thống không gán nhãn ép buộc. Bước tiếp theo là một câu hỏi phân biệt duy nhất:</p>
          <p>
            <Link className="button-primary" to={`/learn/${learnerId}`}>
              Trả lời câu hỏi kiểm chứng tiếp theo
            </Link>
          </p>
        </section>
      ) : null}

      {result.pathKcIds.length > 0 ? (
        <section className="section">
          <h2>Đường bù kiến thức</h2>
          <ol className="path-steps">
            {result.pathKcIds.map((kcId, index) => (
              <li key={kcId}>
                <span className="step-role">
                  {index === 0
                    ? 'Bắt đầu từ lỗ hổng gốc'
                    : kcId === HERO_TARGET_KC_ID
                      ? 'Mục tiêu của lớp'
                      : `Bước ${index + 1}`}
                </span>
                <span className="step-name">{kcName(kcId)}</span>
              </li>
            ))}
          </ol>
          <p className="evidence-note">
            Các kiến thức đã vững không xuất hiện trong đường bù — học sinh không phải học lại thứ
            đã nắm chắc.
          </p>
        </section>
      ) : result.status === 'FAST_PATH' ? (
        <section className="action-panel">
          <h2>Sẵn sàng tiến tiếp</h2>
          <p>
            Bằng chứng cho thấy {profile?.label ?? learnerId} đã vững mục tiêu và các kiến thức nền.
            Không cần học lại — bước tiếp theo là một bài thử thách chuyển giao.
          </p>
          <p>
            <Link className="button-primary" to={`/learn/${learnerId}`}>
              Nhận bài thử thách
            </Link>
          </p>
        </section>
      ) : null}

      <section className="section">
        <h2>Chi tiết kiểm chứng</h2>
        <details className="tech-details">
          <summary>Căn cứ quyết định ({result.reasonCodes.length})</summary>
          <ul>
            {result.reasonCodes.map((code) => (
              <li key={code}>{REASON_LABELS[code]}</li>
            ))}
          </ul>
        </details>
        <details className="tech-details">
          <summary>Sự kiện bằng chứng ({result.evidenceEventIds.length})</summary>
          <ul>
            {result.evidenceEventIds.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        </details>
        <details className="tech-details">
          <summary>Phiên bản nội dung và thuật toán</summary>
          <p>
            Nội dung: <code>{result.contentVersion}</code> — thuật toán:{' '}
            <code>{result.algorithmVersion}</code>
          </p>
        </details>
      </section>
    </>
  );
}
