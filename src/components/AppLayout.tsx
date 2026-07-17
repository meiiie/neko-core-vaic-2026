import { NavLink, Outlet } from 'react-router-dom';
import { useDemoSession } from '../app/demo-session';
import { UpdatePrompt } from '../features/pwa-status/UpdatePrompt';
import { OnlineStatusBadge } from './OnlineStatusBadge';

export function AppLayout() {
  const { role, setRole, learnerId } = useDemoSession();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>NekoPath</h1>
        <span className="badge badge--sim" title="Toàn bộ hồ sơ học sinh là dữ liệu tổng hợp">
          Dữ liệu mô phỏng
        </span>
        <OnlineStatusBadge />
        <nav className="app-nav" aria-label="Điều hướng chính">
          <NavLink to={`/learn/${learnerId}`}>Học sinh</NavLink>
          <NavLink to="/teacher">Giáo viên</NavLink>
          <NavLink to="/system">Hệ thống</NavLink>
        </nav>
        <div
          className="role-switch"
          role="group"
          aria-label="Vai trò trình diễn (không phải đăng nhập)"
        >
          <button
            type="button"
            aria-pressed={role === 'STUDENT'}
            onClick={() => setRole('STUDENT')}
          >
            Vai trò: Học sinh
          </button>
          <button
            type="button"
            aria-pressed={role === 'TEACHER'}
            onClick={() => setRole('TEACHER')}
          >
            Vai trò: Giáo viên
          </button>
        </div>
      </header>
      <UpdatePrompt />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
