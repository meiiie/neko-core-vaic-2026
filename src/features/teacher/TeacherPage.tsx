/**
 * Placeholder surface for /teacher.
 * The real dashboard (root-based groups, transparent priority, class-wide
 * gaps, evidence, override) renders only from TeacherGroup contract data.
 * No fake dashboard with invented numbers is allowed here
 * (docs/PRODUCT_CONTRACT.md — teacher decision contract).
 */
export function TeacherPage() {
  return (
    <section className="card">
      <h2>Bảng điều khiển giáo viên</h2>
      <p className="placeholder-note">
        Nhóm theo nguyên nhân gốc, thứ tự ưu tiên minh bạch và lỗ hổng toàn lớp sẽ hiển thị tại đây
        khi lõi phân nhóm được tích hợp. Giao diện này không hiển thị số liệu giả.
      </p>
    </section>
  );
}
