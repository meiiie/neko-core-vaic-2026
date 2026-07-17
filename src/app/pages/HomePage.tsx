import { Link } from 'react-router-dom';
import { HERO_LEARNERS } from '../adapters/mock-tutor';

export function HomePage() {
  return (
    <>
      <section className="card">
        <h2>Cùng một lỗi trên bề mặt — nhiều nguyên nhân gốc khác nhau</h2>
        <p>
          NekoPath chẩn đoán khoảng trống kiến thức gốc phía sau một câu trả lời sai, đề xuất lộ
          trình luyện tập đúng vào prerequisite bị thiếu, và cho giáo viên một bảng hành động theo
          nhóm nhu cầu. Phần lõi chạy ngay trên thiết bị, không phụ thuộc máy chủ.
        </p>
        <p className="placeholder-note">
          Toàn bộ hồ sơ dưới đây là dữ liệu mô phỏng phục vụ trình diễn — không phải học sinh thật.
        </p>
      </section>
      <section className="card">
        <h2>Bốn hồ sơ trình diễn</h2>
        <ul>
          {HERO_LEARNERS.map((learner) => (
            <li key={learner.id}>
              <Link to={`/learn/${learner.id}`}>{learner.label}</Link> — {learner.note}
            </li>
          ))}
        </ul>
        <p>
          <Link to="/teacher">Xem lớp học (góc nhìn giáo viên)</Link>
        </p>
      </section>
    </>
  );
}
