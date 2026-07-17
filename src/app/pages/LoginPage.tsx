import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, useDemoSession } from '../demo-session';

function destination(role: 'STUDENT' | 'TEACHER'): string {
  return role === 'STUDENT' ? '/student' : '/teacher';
}

export function LoginPage() {
  const { account, signIn } = useDemoSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (account) navigate(destination(account.role), { replace: true });
  }, [account, navigate]);

  function enter(accountId: string) {
    const selected = DEMO_ACCOUNTS.find((candidate) => candidate.id === accountId);
    if (selected && signIn(accountId)) navigate(destination(selected.role), { replace: true });
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="product-name">
        <a className="login-brand" href="/login" aria-label="NekoPath">
          <img src="/icons/icon-192.png" alt="" width="44" height="44" />
          <span>NekoPath</span>
        </a>
        <div className="login-story-copy">
          <p className="eyebrow">Trợ giảng thích ứng cho lớp học đa trình độ</p>
          <h1 id="product-name">Mỗi học sinh một lộ trình. Giáo viên vẫn là người quyết định.</h1>
          <p>
            NekoPath lần theo kiến thức nền, chọn câu kiểm tra tiếp theo và gom lớp theo nhu cầu để
            giáo viên can thiệp đúng chỗ.
          </p>
        </div>
        <dl className="login-proof-list">
          <div>
            <dt>Chạy cục bộ</dt>
            <dd>Làm bài và xem lộ trình ngay cả khi mạng yếu.</dd>
          </div>
          <div>
            <dt>Giải thích được</dt>
            <dd>Mỗi nhóm và đề xuất đều có bằng chứng đi kèm.</dd>
          </div>
        </dl>
      </section>

      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-card">
          <p className="eyebrow">Môi trường dùng thử</p>
          <h2 id="login-heading">Đăng nhập bằng tài khoản mẫu</h2>
          <p className="login-intro">
            Chọn vai trò để mở đúng không gian làm việc. Không cần mật khẩu.
          </p>

          <div className="demo-account-list">
            {DEMO_ACCOUNTS.map((demoAccount) => (
              <button
                className="demo-account"
                key={demoAccount.id}
                type="button"
                onClick={() => enter(demoAccount.id)}
              >
                <span className="account-avatar" aria-hidden="true">
                  {demoAccount.initials}
                </span>
                <span className="account-copy">
                  <strong>{demoAccount.name}</strong>
                  <span>{demoAccount.subtitle}</span>
                </span>
                <span className="account-action">Đăng nhập</span>
              </button>
            ))}
          </div>

          <p className="login-disclosure">
            Đây là môi trường đánh giá sử dụng dữ liệu mẫu, không chứa thông tin học sinh thật.
          </p>
        </div>
      </section>
    </main>
  );
}
