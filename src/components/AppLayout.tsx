import { useCallback, useEffect, useRef, useState } from 'react';
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

const MOBILE_NAVIGATION_QUERY = '(max-width: 52rem)';

export function AppLayout() {
  const { account, signOut } = useDemoSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.(MOBILE_NAVIGATION_QUERY).matches === true,
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const restoreMenuFocusRef = useRef(false);

  const closeMobileNavigation = useCallback((restoreMenuFocus: boolean) => {
    restoreMenuFocusRef.current = restoreMenuFocus;
    setMobileOpen(false);
  }, []);

  const selectMobileRoute = useCallback(() => {
    if (!isMobile) return;
    closeMobileNavigation(false);
    window.requestAnimationFrame(() => mainRef.current?.focus());
  }, [closeMobileNavigation, isMobile]);

  useEffect(() => {
    registerSyncTriggers();
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(MOBILE_NAVIGATION_QUERY);
    const updateViewport = () => {
      setIsMobile(media.matches);
      if (!media.matches) {
        restoreMenuFocusRef.current = false;
        setMobileOpen(false);
      }
    };

    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;

    const currentRoute = sidebarRef.current?.querySelector<HTMLElement>(
      '.sidebar-nav [aria-current="page"]',
    );
    const firstRoute = sidebarRef.current?.querySelector<HTMLElement>('.sidebar-nav a');
    (currentRoute ?? firstRoute)?.focus();
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMobileNavigation(true);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [closeMobileNavigation, isMobile, mobileOpen]);

  useEffect(() => {
    if (mobileOpen || !restoreMenuFocusRef.current) return;
    restoreMenuFocusRef.current = false;
    menuButtonRef.current?.focus();
  }, [mobileOpen]);

  if (!account) return null;
  const home = account.role === 'STUDENT' ? '/student' : '/teacher';
  const closedMobileTabIndex = isMobile && !mobileOpen ? -1 : undefined;

  function exitWorkspace() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <header className="mobile-header" inert={isMobile && mobileOpen ? true : undefined}>
        <NavLink className="brand-lockup" to={home}>
          <img src="/icons/icon-192.png" alt="" width="36" height="36" />
          <span>NekoPath</span>
        </NavLink>
        <button
          ref={menuButtonRef}
          className="mobile-menu-button"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="product-sidebar"
          onClick={() => {
            if (mobileOpen) closeMobileNavigation(true);
            else setMobileOpen(true);
          }}
        >
          {mobileOpen ? 'Đóng' : 'Menu'}
        </button>
      </header>

      <aside
        ref={sidebarRef}
        id="product-sidebar"
        className="product-sidebar"
        data-open={mobileOpen || undefined}
        inert={isMobile && !mobileOpen ? true : undefined}
      >
        <div className="sidebar-head">
          <NavLink
            className="brand-lockup"
            to={home}
            tabIndex={closedMobileTabIndex}
            onClick={selectMobileRoute}
          >
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
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              tabIndex={closedMobileTabIndex}
              onClick={selectMobileRoute}
            >
              <span className="nav-index" aria-hidden="true">
                {item.index}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <p className="sidebar-label sidebar-label--secondary">Thiết bị</p>
          <NavLink to="/system" tabIndex={closedMobileTabIndex} onClick={selectMobileRoute}>
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
          <button
            type="button"
            aria-label="Đổi tài khoản"
            tabIndex={closedMobileTabIndex}
            onClick={exitWorkspace}
          >
            Đổi
          </button>
        </div>
      </aside>

      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="Đóng điều hướng"
        aria-hidden={!mobileOpen}
        tabIndex={-1}
        data-open={mobileOpen || undefined}
        onClick={() => closeMobileNavigation(true)}
      />

      <div className="product-workspace" inert={isMobile && mobileOpen ? true : undefined}>
        <header className="workspace-status">
          <span className="environment-label">Dữ liệu mẫu</span>
          <SyncBadge />
          <OnlineStatusBadge />
        </header>
        <UpdatePrompt />
        <main ref={mainRef} id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
