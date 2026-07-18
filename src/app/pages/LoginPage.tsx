import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { useSession } from '../session';

/**
 * Sign-in — search your name in the class roll, tap it, press Đăng nhập.
 * The class password is applied automatically (event environment, documented
 * in ops/RUNBOOK.md): rural Grade-7 students on a shared device should not
 * have to type anything beyond finding their own name. Returning users are
 * restored from the cached session and never see this screen.
 */

const LAST_EMAIL_KEY = 'nekopath.last-email.v1';
const CLASS_PASSWORD = 'Nekopath@2026';

interface DirectoryAccount {
  email: string;
  name: string;
  role: 'STUDENT' | 'TEACHER';
  subtitle: string;
}

/** Diacritic-insensitive matching so "han" finds "Hân", "le" finds "Lê". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function LoginPage() {
  const { account, ready, signIn } = useSession();
  const navigate = useNavigate();

  const [directory, setDirectory] = useState<DirectoryAccount[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>(
    () => window.localStorage.getItem(LAST_EMAIL_KEY) ?? '',
  );
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
        if (!cancelled) {
          setDirectory(body.accounts);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!directory) return [];
    const needle = fold(query.trim());
    if (!needle) return directory;
    return directory.filter((entry) => fold(entry.name).includes(needle));
  }, [directory, query]);

  const selectedAccount = directory?.find((entry) => entry.email === selected) ?? null;
  const teachers = filtered.filter((entry) => entry.role === 'TEACHER');
  const students = filtered.filter((entry) => entry.role === 'STUDENT');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !selectedAccount) return;
    setPending(true);
    setError(null);
    const failure = await signIn(selectedAccount.email, CLASS_PASSWORD);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    try {
      window.localStorage.setItem(LAST_EMAIL_KEY, selectedAccount.email);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }

  function renderGroup(label: string, entries: DirectoryAccount[]) {
    if (entries.length === 0) return null;
    return (
      <li>
        <p className="auth-roll-label">{label}</p>
        <ul className="auth-roll-group">
          {entries.map((entry) => (
            <li key={entry.email}>
              <button
                type="button"
                className="auth-roll-item"
                aria-pressed={selected === entry.email}
                onClick={() => setSelected(entry.email)}
              >
                <span className="auth-roll-name">{entry.name}</span>
                {entry.role === 'TEACHER' ? (
                  <span className="auth-roll-sub">{entry.subtitle}</span>
                ) : null}
                {selected === entry.email ? (
                  <span className="auth-roll-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <div className="auth-brand">
          <BrandMark size={40} />
          <span>NekoPath</span>
        </div>
        <h1 className="auth-title">Đăng nhập</h1>
        <p className="auth-subtitle">Tìm tên của bạn trong lớp rồi bấm Đăng nhập.</p>

        {loadError ? (
          <p className="auth-error" role="alert">
            Không tải được danh sách lớp — lần đăng nhập đầu cần có mạng.{' '}
            <button type="button" className="auth-retry" onClick={() => window.location.reload()}>
              Thử lại
            </button>
          </p>
        ) : null}

        {directory === null && !loadError ? (
          <p className="auth-loading">Đang tải danh sách lớp…</p>
        ) : null}

        {directory !== null ? (
          <>
            <input
              type="search"
              className="auth-search"
              placeholder="Tìm tên của bạn…"
              aria-label="Tìm tên của bạn"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="auth-roll" aria-label="Danh sách lớp">
              {renderGroup('Giáo viên', teachers)}
              {renderGroup('Học sinh lớp 7A', students)}
              {filtered.length === 0 ? (
                <li className="auth-roll-empty">Không tìm thấy tên «{query}».</li>
              ) : null}
            </ul>
          </>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth-submit" type="submit" disabled={pending || !selectedAccount}>
          {pending
            ? 'Đang đăng nhập…'
            : selectedAccount
              ? `Đăng nhập — ${selectedAccount.name}`
              : 'Chọn tên để đăng nhập'}
        </button>

        <p className="auth-fineprint">
          Tài khoản do nhà trường cấp. Dữ liệu học tập lưu trên thiết bị và tự đồng bộ khi có mạng.
        </p>
      </form>
    </main>
  );
}
