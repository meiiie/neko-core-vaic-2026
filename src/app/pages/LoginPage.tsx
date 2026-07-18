import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { useSession } from '../session';

/**
 * Sign-in — one refined combobox: tap the field, the class roll drops down
 * anchored to it; type to filter (diacritic-insensitive); pick a name and the
 * list folds away, leaving a minimal card (chosen name + one button). Full
 * keyboard support (↑ ↓ Enter Esc). The class password is applied
 * automatically (documented event environment) — a rural student on a shared
 * device only needs to know their own name.
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>(
    () => window.localStorage.getItem(LAST_EMAIL_KEY) ?? '',
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  // Close when tapping anywhere outside the combobox (spatial consistency:
  // the panel folds back into the field it grew from).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (!directory) return [];
    const needle = fold(query.trim());
    if (!needle) return directory;
    return directory.filter((entry) => fold(entry.name).includes(needle));
  }, [directory, query]);

  const selectedAccount = directory?.find((entry) => entry.email === selected) ?? null;

  function choose(entry: DirectoryAccount) {
    setSelected(entry.email);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = Math.min(Math.max(activeIndex + delta, 0), filtered.length - 1);
      setActiveIndex(next);
      const options = listRef.current?.querySelectorAll('[role="option"]');
      options?.[next]?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = filtered[activeIndex] ?? (filtered.length === 1 ? filtered[0] : undefined);
      if (target) choose(target);
    }
  }

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

  // While closed the field shows the chosen name; while open it is a filter.
  const fieldValue = open ? query : (selectedAccount?.name ?? '');

  function renderGroup(label: string, entries: DirectoryAccount[]) {
    if (entries.length === 0) return null;
    return (
      <li role="presentation">
        <p className="auth-roll-label">{label}</p>
        <ul role="presentation" className="auth-roll-group">
          {entries.map((entry) => {
            // filtered keeps directory order (teachers first), so the flat
            // keyboard index is simply the entry's position in filtered.
            const index = filtered.indexOf(entry);
            return (
              <li
                key={entry.email}
                role="option"
                aria-selected={selected === entry.email}
                data-active={index === activeIndex || undefined}
                className="auth-option"
                onPointerDown={(event) => {
                  event.preventDefault(); // keep focus in the input
                  choose(entry);
                }}
                onPointerMove={() => setActiveIndex(index)}
              >
                <span className="auth-option-name">{entry.name}</span>
                {entry.role === 'TEACHER' ? (
                  <span className="auth-option-sub">{entry.subtitle}</span>
                ) : null}
                {selected === entry.email ? (
                  <span className="auth-option-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </li>
    );
  }

  const teachers = filtered.filter((entry) => entry.role === 'TEACHER');
  const students = filtered.filter((entry) => entry.role === 'STUDENT');

  return (
    <main className="auth">
      <form className="auth-card" onSubmit={(e) => void submit(e)}>
        <div className="auth-brand">
          <BrandMark size={40} />
          <span>NekoPath</span>
        </div>
        <h1 className="auth-title">Đăng nhập</h1>
        <p className="auth-subtitle">Chọn tên của bạn trong lớp để bắt đầu.</p>

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
          <div className="auth-combobox" ref={boxRef}>
            <label className="auth-field">
              <span>Bạn là ai?</span>
              <span className="auth-combo-field" data-open={open || undefined}>
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="class-roll"
                  aria-autocomplete="list"
                  aria-label="Chọn tên của bạn"
                  autoComplete="off"
                  placeholder={open ? 'Gõ để tìm tên…' : 'Chọn tên của bạn…'}
                  value={fieldValue}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                    if (!open) setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  onClick={() => setOpen(true)}
                  onKeyDown={onKeyDown}
                />
                <span className="auth-combo-chevron" aria-hidden="true">
                  ▾
                </span>
              </span>
            </label>

            {open ? (
              <ul id="class-roll" role="listbox" className="auth-dropdown" ref={listRef}>
                {renderGroup('Giáo viên', teachers)}
                {renderGroup('Học sinh lớp 7A', students)}
                {filtered.length === 0 ? (
                  <li className="auth-roll-empty">Không tìm thấy tên «{query}».</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth-submit" type="submit" disabled={pending || !selectedAccount}>
          {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>

        <p className="auth-fineprint">
          Tài khoản do nhà trường cấp. Dữ liệu học tập lưu trên thiết bị và tự đồng bộ khi có mạng.
        </p>
      </form>
    </main>
  );
}
