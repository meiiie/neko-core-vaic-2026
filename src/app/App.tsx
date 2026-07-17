import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { PathPage } from '../features/evidence-path/PathPage';
import { AssignmentsPage, AssignmentTakePage } from '../features/student/AssignmentsPage';
import { LearnPage } from '../features/student/LearnPage';
import { PracticePage } from '../features/student/PracticePage';
import { StudentDashboardPage } from '../features/student/StudentDashboardPage';
import { SystemPage } from '../features/system/SystemPage';
import { TeacherAssignmentsPage } from '../features/teacher/TeacherAssignmentsPage';
import { TeacherClassPage } from '../features/teacher/TeacherClassPage';
import { TeacherPage } from '../features/teacher/TeacherPage';
import { TeacherQuestionsPage } from '../features/teacher/TeacherQuestionsPage';
import { SessionProvider, useSession, type Role } from './session';
import { LoginPage } from './pages/LoginPage';

function RequireSession() {
  const { account, ready } = useSession();
  if (!ready) return <div className="page-loading" aria-label="Đang khôi phục phiên làm việc" />;
  return account ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ role }: { role: Role }) {
  const { account, ready } = useSession();
  if (!ready) return <div className="page-loading" aria-label="Đang khôi phục phiên làm việc" />;
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== role) {
    return <Navigate to={account.role === 'STUDENT' ? '/student' : '/teacher'} replace />;
  }
  return <Outlet />;
}

function WorkspaceHome() {
  const { account, ready } = useSession();
  if (!ready) return <div className="page-loading" aria-label="Đang khôi phục phiên làm việc" />;
  if (!account) return <Navigate to="/login" replace />;
  return <Navigate to={account.role === 'STUDENT' ? '/student' : '/teacher'} replace />;
}

function NotFoundPage() {
  const { account } = useSession();
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
    <SessionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          <Route element={<AppLayout />}>
            <Route index element={<WorkspaceHome />} />
            <Route element={<RequireRole role="STUDENT" />}>
              <Route path="student" element={<StudentDashboardPage />} />
              <Route path="student/check-in" element={<LearnPage />} />
              <Route path="student/practice" element={<PracticePage />} />
              <Route path="student/assignments" element={<AssignmentsPage />} />
              <Route path="student/assignments/:assignmentId" element={<AssignmentTakePage />} />
              <Route path="student/path" element={<PathPage />} />
            </Route>
            <Route element={<RequireRole role="TEACHER" />}>
              <Route path="teacher" element={<TeacherPage />} />
              <Route path="teacher/class" element={<TeacherClassPage />} />
              <Route path="teacher/questions" element={<TeacherQuestionsPage />} />
              <Route path="teacher/assignments" element={<TeacherAssignmentsPage />} />
            </Route>
            <Route path="system" element={<SystemPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </SessionProvider>
  );
}
