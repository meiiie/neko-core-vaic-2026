import { useParams } from 'react-router-dom';

/**
 * Placeholder surface for /path/:learnerId — root hypothesis / abstention,
 * evidence and micro-path will render here once the domain core lands.
 */
export function PathPage() {
  const { learnerId } = useParams<{ learnerId: string }>();

  return (
    <section className="card">
      <h2>Bằng chứng &amp; lộ trình — {learnerId ?? 'không rõ học sinh'}</h2>
      <p className="placeholder-note">
        Giả thuyết gốc, bằng chứng và lộ trình luyện tập sẽ hiển thị tại đây khi lõi chẩn đoán được
        tích hợp qua hợp đồng DiagnosisResult. Trạng thái có thể là: đã chẩn đoán, cần thêm bằng
        chứng, ngoài phạm vi, hoặc lộ trình tiến nhanh.
      </p>
    </section>
  );
}
