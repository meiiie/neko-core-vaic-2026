import { NavLink, Outlet } from 'react-router-dom';
import { useDemoSession } from '../app/demo-session';
import { UpdatePrompt } from '../features/pwa-status/UpdatePrompt';
import { OnlineStatusBadge } from './OnlineStatusBadge';

/**
 * Shared shell: one mode navigation (student / teacher / quiet system utility).
 * Mode switching is plain navigation — it must never imply login or authorization.
 */
export function AppLayout() {
  const { learnerId } = useDemoSession();

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          NekoPath
        </NavLink>
        <div className="header-labels">
          <span
            className="status-label status-label--review"
            title="Toàn bộ hồ sơ học sinh là dữ liệu tổng hợp"
          >
            Dữ liệu mô phỏng
          </span>
          <OnlineStatusBadge />
        </div>
        <nav className="app-nav" aria-label="Điều hướng chính">
          <NavLink to={`/learn/${learnerId}`}>Học sinh</NavLink>
          <NavLink to="/teacher">Giáo viên</NavLink>
          <NavLink to="/system" className="nav-quiet">
            Hệ thống
          </NavLink>
        </nav>
      </header>
      <UpdatePrompt />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
