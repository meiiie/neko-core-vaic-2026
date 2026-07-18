import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSession, type Role } from '../app/session';
import { registerSyncTriggers } from '../services/sync';
import { ConnectionStatus } from './ConnectionStatus';
import { BrandMark } from './BrandMark';

const NekoDock = lazy(async () => {
  const module = await import('./NekoDock');
  return { default: module.NekoDock };
});

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly end?: boolean;
}

const NAVIGATION: Record<Role, readonly NavItem[]> = {
  STUDENT: [
    { to: '/student', label: 'Hôm nay', end: true },
    { to: '/student/check-in', label: 'Kiểm tra thích ứng' },
    { to: '/student/path', label: 'Lộ trình học' },
    { to: '/student/practice', label: 'Luyện tập' },
    { to: '/student/assignments', label: 'Bài được giao' },
  ],
  TEACHER: [
    { to: '/teacher', label: 'Tổng quan lớp', end: true },
    { to: '/teacher/class', label: 'Nhóm cần hỗ trợ' },
    { to: '/teacher/questions', label: 'Ngân hàng câu hỏi' },
    { to: '/teacher/assignments', label: 'Giao bài' },
  ],
};

const MOBILE_NAVIGATION_QUERY = '(max-width: 52rem)';

export function AppLayout() {
  const { account, signOut } = useSession();
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
  const [nekoOpen, setNekoOpen] = useState(
    () => window.localStorage.getItem('nekopath.neko-dock.open') === '1',
  );
  const [nekoLoaded, setNekoLoaded] = useState(nekoOpen);

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

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleDrawerKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileNavigation(true);
        return;
      }

      if (event.key !== 'Tab') return;
      const drawer = sidebarRef.current;
      if (!drawer) return;

      const tabbable = [...drawer.querySelectorAll<HTMLElement>('a[href], button')].filter(
        (element) => element.tabIndex >= 0 && !element.hasAttribute('disabled'),
      );
      const first = tabbable[0];
      const last = tabbable.at(-1);
      if (!first || !last) return;

      const active = document.activeElement;
      if (event.shiftKey && (active === first || !drawer.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !drawer.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDrawerKeydown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', handleDrawerKeydown);
    };
  }, [closeMobileNavigation, isMobile, mobileOpen]);

  useEffect(() => {
    if (mobileOpen || !restoreMenuFocusRef.current) return;
    restoreMenuFocusRef.current = false;
    menuButtonRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem('nekopath.neko-dock.open', nekoOpen ? '1' : '0');
    } catch {
      // Preference only; losing it is harmless.
    }
  }, [nekoOpen]);

  if (!account) return null;
  const isTeacher = account.role === 'TEACHER';
  const home = account.role === 'STUDENT' ? '/student' : '/teacher';
  const closedMobileTabIndex = isMobile && !mobileOpen ? -1 : undefined;

  async function exitWorkspace() {
    await signOut();
    navigate('/login', { replace: true });
  }

  function toggleNeko() {
    setNekoLoaded(true);
    setNekoOpen((open) => !open);
  }

  return (
    <div className="product-shell">
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <header className="mobile-header" inert={isMobile && mobileOpen ? true : undefined}>
        <NavLink className="brand-lockup" to={home}>
          <BrandMark size={36} />
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
            <BrandMark size={40} />
            <span>
              <strong>NekoPath</strong>
              <small>{account.role === 'STUDENT' ? 'Cổng học sinh' : 'Cổng giáo viên'}</small>
            </span>
          </NavLink>
        </div>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          <p className="sidebar-label">{isTeacher ? 'Lớp học' : 'Học tập'}</p>
          {NAVIGATION[account.role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              tabIndex={closedMobileTabIndex}
              onClick={selectMobileRoute}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}

          <p className="sidebar-label sidebar-label--secondary">Thiết bị</p>
          <NavLink to="/system" tabIndex={closedMobileTabIndex} onClick={selectMobileRoute}>
            <span>Dữ liệu &amp; ngoại tuyến</span>
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <ConnectionStatus />
        </div>

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
            aria-label="Đổi hồ sơ"
            tabIndex={closedMobileTabIndex}
            onClick={() => void exitWorkspace()}
          >
            Đổi<span className="sidebar-account-action-detail"> hồ sơ</span>
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

      <div
        className="product-workspace"
        data-neko-open={(isTeacher && nekoOpen) || undefined}
        inert={isMobile && mobileOpen ? true : undefined}
      >
        <main ref={mainRef} id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {isTeacher && !nekoOpen ? (
        <button
          type="button"
          className="neko-launcher"
          aria-label="Mở trợ lý Neko"
          inert={isMobile && mobileOpen ? true : undefined}
          onClick={toggleNeko}
        >
          <BrandMark size={20} />
          <span>Neko</span>
        </button>
      ) : null}

      {isTeacher && nekoLoaded ? (
        <Suspense fallback={null}>
          <NekoDock open={nekoOpen} onClose={() => setNekoOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
