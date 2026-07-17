import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import {
  diagnoseHero,
  isHeroLearnerId,
  kcName,
  REASON_LABELS,
  STATUS_LABELS,
  UNREVIEWED_LABEL,
} from '../../app/adapters/hero-tutor';
import { listEventsByLearner } from '../../storage/event-repository';

/**
 * Evidence & path surface: renders the DiagnosisResult contract verbatim —
 * why (evidence, reason codes), what next (path or probe), what is skipped.
 */
export function PathPage() {
  const { learnerId } = useParams<{ learnerId: string }>();

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

  return (
    <>
      <section className="card">
        <h2>Kết luận chẩn đoán — {learnerId}</h2>
        <p>
          <strong>{STATUS_LABELS[result.status]}</strong>
        </p>
        {result.rootKcId ? (
          <p>
            Giả thuyết gốc: <strong>{kcName(result.rootKcId)}</strong> ({result.rootKcId})
          </p>
        ) : null}
        {result.competingKcIds.length > 0 ? (
          <p>
            Giả thuyết cạnh tranh:{' '}
            {result.competingKcIds.map((id) => `${kcName(id)} (${id})`).join('; ')}
          </p>
        ) : null}
        <ul>
          {result.reasonCodes.map((code) => (
            <li key={code}>{REASON_LABELS[code]}</li>
          ))}
        </ul>
        <p className="placeholder-note">{UNREVIEWED_LABEL}</p>
      </section>

      <section className="card">
        <h2>Lộ trình đề xuất</h2>
        {result.pathKcIds.length > 0 ? (
          <ol>
            {result.pathKcIds.map((kcId) => (
              <li key={kcId}>
                {kcName(kcId)} ({kcId})
              </li>
            ))}
          </ol>
        ) : (
          <p className="placeholder-note">
            Chưa có lộ trình — hệ thống đang chờ thêm bằng chứng hoặc học sinh đã sẵn sàng tiến
            tiếp.
          </p>
        )}
        {result.nextItemId ? (
          <p>
            Bước tiếp theo: trả lời câu hỏi <strong>{result.nextItemId}</strong> tại{' '}
            <Link to={`/learn/${learnerId}`}>trang luyện tập</Link>.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2>Bằng chứng sử dụng</h2>
        <p>
          {result.evidenceEventIds.length} sự kiện học tập (mô phỏng + trả lời cục bộ trên thiết bị
          này):
        </p>
        <ul>
          {result.evidenceEventIds.map((id) => (
            <li key={id}>
              <code>{id}</code>
            </li>
          ))}
        </ul>
        <p className="placeholder-note">
          Phiên bản nội dung: <code>{result.contentVersion}</code> — thuật toán:{' '}
          <code>{result.algorithmVersion}</code>
        </p>
      </section>
    </>
  );
}
