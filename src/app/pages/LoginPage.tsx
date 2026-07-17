import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { useSession } from '../session';

/**
 * Sign-in — one calm centred card. Picking your name from the class roll
 * (dropdown) beats typing an email on a shared rural-classroom device; the
 * password stays the only secret. Returning users on this device are restored
 * from the cached session and never see this screen; the first sign-in needs
 * the network, so an unreachable server falls back to a plain email field
 * with an honest note.
 */

const LAST_EMAIL_KEY = 'nekopath.last-email.v1';

interface DirectoryAccount {
  email: string;
  name: string;
  role: 'STUDENT' | 'TEACHER';
  subtitle: string;
}

export function LoginPage() {
  const { account, ready, signIn } = useSession();
  const navigate = useNavigate();

  const [directory, setDirectory] = useState<DirectoryAccount[] | null>(null);
  const [directoryFailed, setDirectoryFailed] = useState(false);
  const [email, setEmail] = useState(() => window.localStorage.getItem(LAST_EMAIL_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && account)
      navigate(account.role === 'STUDENT' ? '/student' : '/teacher', { replace: true });
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
        if (!cancelled) setDirectoryFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const failure = await signIn(email.trim(), password);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, email.trim());
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  const teachers = (directory ?? []).filter((entry) => entry.role === 'TEACHER');
  const students = (directory ?? []).filter((entry) => entry.role === 'STUDENT');

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark size={40} />
          <span>NekoPath</span>
        </div>
        <h1 className="auth-title">Đăng nhập</h1>
        <p className="auth-subtitle">Trợ giảng thích ứng cho lớp học đa trình độ.</p>

        <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
          {directory ? (
            <label className="auth-field">
              <span>Bạn là ai?</span>
              <select
                className="auth-select"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              >
                <option value="" disabled>
                  Chọn tên của bạn trong lớp…
                </option>
                {teachers.length > 0 ? (
                  <optgroup label="Giáo viên">
                    {teachers.map((entry) => (
                      <option key={entry.email} value={entry.email}>
                        {entry.name} — {entry.subtitle}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {students.length > 0 ? (
                  <optgroup label="Học sinh lớp 7A">
                    {students.map((entry) => (
                      <option key={entry.email} value={entry.email}>
                        {entry.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
          ) : (
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="ban@nekopath.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {directoryFailed ? (
                <small className="auth-hint">
                  Không tải được danh sách lớp — nhập email tài khoản. Lần đăng nhập đầu cần có
                  mạng.
                </small>
              ) : null}
            </label>
          )}

          <label className="auth-field">
            <span>Mật khẩu</span>
            <span className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="auth-submit"
            type="submit"
            disabled={pending || !email.trim() || !password}
          >
            {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="auth-fineprint">
          Tài khoản do nhà trường cấp. Dữ liệu học tập lưu trên thiết bị và tự đồng bộ khi có mạng.
        </p>
      </div>
    </main>
  );
}
