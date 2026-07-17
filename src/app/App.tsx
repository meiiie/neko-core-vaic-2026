import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { PathPage } from '../features/evidence-path/PathPage';
import { LearnPage } from '../features/student/LearnPage';
import { PracticePage } from '../features/student/PracticePage';
import { StudentDashboardPage } from '../features/student/StudentDashboardPage';
import { SystemPage } from '../features/system/SystemPage';
import { TeacherClassPage } from '../features/teacher/TeacherClassPage';
import { TeacherPage } from '../features/teacher/TeacherPage';
import { DemoSessionProvider, useDemoSession, type DemoRole } from './demo-session';
import { LoginPage } from './pages/LoginPage';

function RequireSession() {
  const { account } = useDemoSession();
  return account ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ role }: { role: DemoRole }) {
  const { account } = useDemoSession();
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== role) {
    return <Navigate to={account.role === 'STUDENT' ? '/student' : '/teacher'} replace />;
  }
  return <Outlet />;
}

function WorkspaceHome() {
  const { account } = useDemoSession();
  if (!account) return <Navigate to="/login" replace />;
  return <Navigate to={account.role === 'STUDENT' ? '/student' : '/teacher'} replace />;
}

function NotFoundPage() {
  const { account } = useDemoSession();
  const home = account?.role === 'TEACHER' ? '/teacher' : '/student';
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này không thuộc không gian làm việc hiện tại.</p>
      <Link className="button-primary" to={home}>
        Về trang tổng quan
      </Link>
    </section>
  );
}

export function App() {
  return (
    <DemoSessionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          <Route element={<AppLayout />}>
            <Route index element={<WorkspaceHome />} />
            <Route element={<RequireRole role="STUDENT" />}>
              <Route path="student" element={<StudentDashboardPage />} />
              <Route path="student/check-in" element={<LearnPage />} />
              <Route path="student/practice" element={<PracticePage />} />
              <Route path="student/path" element={<PathPage />} />
            </Route>
            <Route element={<RequireRole role="TEACHER" />}>
              <Route path="teacher" element={<TeacherPage />} />
              <Route path="teacher/class" element={<TeacherClassPage />} />
            </Route>
            <Route path="system" element={<SystemPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </DemoSessionProvider>
  );
}
