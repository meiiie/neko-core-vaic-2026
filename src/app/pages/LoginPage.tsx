import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { LOCAL_PROFILES, useSession } from '../session';

/**
 * Real login against the API (session cookie). The directory of seeded demo
 * accounts and the shared demo password are displayed on purpose: this is a
 * synthetic evaluation environment, not production credential handling.
 */

const DEMO_PASSWORD = 'nekopath-2026';

interface DirectoryAccount {
  username: string;
  role: 'STUDENT' | 'TEACHER';
  name: string;
  initials: string;
  subtitle: string;
}

function destination(role: 'STUDENT' | 'TEACHER'): string {
  return role === 'STUDENT' ? '/student' : '/teacher';
}

export function LoginPage() {
  const { account, ready, signIn, enterLocalMode } = useSession();
  const navigate = useNavigate();
  const [directory, setDirectory] = useState<DirectoryAccount[]>([]);
  const [directoryError, setDirectoryError] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && account) navigate(destination(account.role), { replace: true });
  }, [ready, account, navigate]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/directory')
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { accounts: DirectoryAccount[] };
        if (!cancelled) setDirectory(body.accounts);
      })
      .catch(() => {
        if (!cancelled) setDirectoryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enter(user: string) {
    setPending(user);
    setError(null);
    const failure = await signIn(user, password);
    setPending(null);
    if (failure) setError(failure);
    // Successful sign-in redirects via the effect above.
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="product-name">
        <a className="login-brand" href="/login" aria-label="NekoPath">
          <BrandMark size={44} />
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
            Tài khoản thật trên máy chủ demo — mật khẩu chung: <code>{DEMO_PASSWORD}</code>
          </p>

          {directoryError ? (
            <section className="login-role-group" aria-label="Chế độ cục bộ">
              <p role="alert" className="error-message">
                Không kết nối được máy chủ lớp học. Em vẫn có thể học bằng chế độ cục bộ — toàn bộ
                dữ liệu lưu trên thiết bị này và tự đồng bộ khi máy chủ trở lại.
              </p>
              <p className="login-role-label">Vào chế độ cục bộ</p>
              <div className="demo-account-list">
                {LOCAL_PROFILES.map((profile) => (
                  <button
                    className="demo-account"
                    key={profile.id}
                    type="button"
                    onClick={() => enterLocalMode(profile.id)}
                  >
                    <span className="account-avatar" aria-hidden="true">
                      {profile.initials}
                    </span>
                    <span className="account-copy">
                      <strong>{profile.name}</strong>
                      <span>{profile.subtitle}</span>
                    </span>
                    <span className="account-action">Vào cục bộ</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {(
            [
              ['TEACHER', 'Giáo viên'],
              ['STUDENT', 'Học sinh lớp 7A'],
            ] as const
          ).map(([role, label]) => {
            const entries = directory.filter((entry) => entry.role === role);
            if (entries.length === 0) return null;
            return (
              <section key={role} className="login-role-group" aria-label={label}>
                <p className="login-role-label">{label}</p>
                <div className="demo-account-list">
                  {entries.map((entry) => (
                    <button
                      className="demo-account"
                      key={entry.username}
                      type="button"
                      disabled={pending !== null}
                      onClick={() => void enter(entry.username)}
                    >
                      <span className="account-avatar" aria-hidden="true">
                        {entry.initials}
                      </span>
                      <span className="account-copy">
                        <strong>{entry.name}</strong>
                        <span>{entry.subtitle}</span>
                      </span>
                      <span className="account-action">
                        {pending === entry.username ? 'Đang vào…' : 'Đăng nhập'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (username) void enter(username);
            }}
          >
            <label>
              Tên đăng nhập
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="vd: hs05.7a"
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button-secondary" type="submit" disabled={pending !== null}>
              Đăng nhập bằng tài khoản khác
            </button>
          </form>

          {error ? (
            <p role="alert" className="error-message">
              {error}
            </p>
          ) : null}

          <p className="login-disclosure">
            Đây là môi trường đánh giá sử dụng dữ liệu mẫu, không chứa thông tin học sinh thật.
          </p>
        </div>
      </section>
    </main>
  );
}
