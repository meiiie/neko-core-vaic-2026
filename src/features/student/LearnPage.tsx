import { Link, useParams } from 'react-router-dom';

/**
 * Placeholder surface for /learn/:learnerId.
 * The real diagnostic flow arrives when the domain core (Codex lane) is
 * integrated through the DiagnosisResult contract. No diagnosis logic and no
 * fabricated results belong here.
 */
export function LearnPage() {
  const { learnerId } = useParams<{ learnerId: string }>();

  return (
    <section className="card">
      <h2>Bài luyện tập — {learnerId ?? 'không rõ học sinh'}</h2>
      <p className="placeholder-note">
        Bề mặt chẩn đoán sẽ hiển thị tại đây sau khi lõi chẩn đoán (domain core) được tích hợp. Chưa
        có kết quả nào được tạo sẵn hay mô phỏng tại giao diện này.
      </p>
      <p>
        <Link to={`/path/${learnerId ?? ''}`}>Xem lộ trình của học sinh này</Link>
      </p>
    </section>
  );
}
