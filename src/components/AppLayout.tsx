import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDemoSession, type DemoRole } from '../app/demo-session';
import { UpdatePrompt } from '../features/pwa-status/UpdatePrompt';
import { registerSyncTriggers } from '../services/sync';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import { SyncBadge } from './SyncBadge';

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly index: string;
  readonly end?: boolean;
}

const NAVIGATION: Record<DemoRole, readonly NavItem[]> = {
  STUDENT: [
    { to: '/student', label: 'Tổng quan', index: '01', end: true },
    { to: '/student/check-in', label: 'Bài kiểm tra', index: '02' },
    { to: '/student/practice', label: 'Luyện tập', index: '03' },
    { to: '/student/assignments', label: 'Bài được giao', index: '04' },
    { to: '/student/path', label: 'Lộ trình của tôi', index: '05' },
  ],
  TEACHER: [
    { to: '/teacher', label: 'Tổng quan lớp', index: '01', end: true },
    { to: '/teacher/class', label: 'Nhóm can thiệp', index: '02' },
    { to: '/teacher/questions', label: 'Ngân hàng câu hỏi', index: '03' },
    { to: '/teacher/assignments', label: 'Giao bài', index: '04' },
  ],
};

export function AppLayout() {
  const { account, signOut } = useDemoSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    registerSyncTriggers();
  }, []);

  if (!account) return null;
  const home = account.role === 'STUDENT' ? '/student' : '/teacher';

  function exitWorkspace() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <header className="mobile-header">
        <NavLink className="brand-lockup" to={home}>
          <img src="/icons/icon-192.png" alt="" width="36" height="36" />
          <span>NekoPath</span>
        </NavLink>
        <button
          className="mobile-menu-button"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="product-sidebar"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? 'Đóng' : 'Menu'}
        </button>
      </header>

      <aside id="product-sidebar" className="product-sidebar" data-open={mobileOpen || undefined}>
        <div className="sidebar-head">
          <NavLink className="brand-lockup" to={home} onClick={() => setMobileOpen(false)}>
            <img src="/icons/icon-192.png" alt="" width="40" height="40" />
            <span>
              <strong>NekoPath</strong>
              <small>{account.role === 'STUDENT' ? 'Cổng học sinh' : 'Cổng giáo viên'}</small>
            </span>
          </NavLink>
        </div>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <p className="sidebar-label">Không gian làm việc</p>
          {NAVIGATION[account.role].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)}>
              <span className="nav-index" aria-hidden="true">
                {item.index}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <p className="sidebar-label sidebar-label--secondary">Thiết bị</p>
          <NavLink to="/system" onClick={() => setMobileOpen(false)}>
            <span className="nav-index" aria-hidden="true">
              06
            </span>
            <span>Dữ liệu &amp; ngoại tuyến</span>
          </NavLink>
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">
            {account.initials}
          </span>
          <span className="account-copy">
            <strong>{account.shortName}</strong>
            <span>{account.subtitle}</span>
          </span>
          <button type="button" onClick={exitWorkspace}>
            Đổi
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="product-workspace">
        <header className="workspace-status">
          <span className="environment-label">Dữ liệu mẫu</span>
          <SyncBadge />
          <OnlineStatusBadge />
        </header>
        <UpdatePrompt />
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
