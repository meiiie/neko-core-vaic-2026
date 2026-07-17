import { Link } from 'react-router-dom';
import { HERO_LEARNERS } from '../adapters/hero-tutor';

/**
 * Proof-oriented entry (§4): headline, teacher outcome, primary comparison
 * action and a scannable four-profile proof selector — all above the fold.
 * No root claim is made here before the adapter makes it.
 */
export function HomePage() {
  return (
    <>
      <section className="section">
        <h1>Cùng một lỗi bề mặt — khác lỗ hổng gốc</h1>
        <p style={{ fontSize: 'var(--text-lg)' }}>
          NekoPath lần theo bằng chứng để tìm đúng kiến thức nền bị thiếu của từng học sinh, và cho
          giáo viên biết nên giúp nhóm nào trước, vì sao, bằng hành động gì.
        </p>
        <div className="cta-row">
          <Link className="button-primary" to="/path/an">
            So sánh An ↔ Bình: cùng sai một bài
          </Link>
          <Link className="button-secondary" to="/teacher">
            Mở bảng lớp 40 học sinh
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>Bốn trạng thái bằng chứng để kiểm chứng</h2>
        <ul className="profile-selector">
          {HERO_LEARNERS.map((learner) => (
            <li key={learner.id}>
              <Link to={`/learn/${learner.id}`}>
                <span className="profile-name">{learner.label}</span>
                <span className="profile-note">{learner.note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="evidence-note">
          Toàn bộ hồ sơ là dữ liệu tổng hợp phục vụ trình diễn — không phải học sinh thật. Phần lõi
          chẩn đoán chạy ngay trên thiết bị, không phụ thuộc máy chủ.
        </p>
      </section>
    </>
  );
}
