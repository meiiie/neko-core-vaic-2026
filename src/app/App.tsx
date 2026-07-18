import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { BrandMark } from '../components/BrandMark';
import { SessionProvider, useSession, type Role } from './session';
import { UpdatePrompt } from '../features/pwa-status/UpdatePrompt';
import { LoginPage } from './pages/LoginPage';

const PathPage = lazy(() =>
  import('../features/evidence-path/PathPage').then(({ PathPage }) => ({ default: PathPage })),
);
const AssignmentsPage = lazy(() =>
  import('../features/student/AssignmentsPage').then(({ AssignmentsPage }) => ({
    default: AssignmentsPage,
  })),
);
const AssignmentTakePage = lazy(() =>
  import('../features/student/AssignmentsPage').then(({ AssignmentTakePage }) => ({
    default: AssignmentTakePage,
  })),
);
const LearnPage = lazy(() =>
  import('../features/student/LearnPage').then(({ LearnPage }) => ({ default: LearnPage })),
);
const PracticePage = lazy(() =>
  import('../features/student/PracticePage').then(({ PracticePage }) => ({
    default: PracticePage,
  })),
);
const StudentDashboardPage = lazy(() =>
  import('../features/student/StudentDashboardPage').then(({ StudentDashboardPage }) => ({
    default: StudentDashboardPage,
  })),
);
const SystemPage = lazy(() =>
  import('../features/system/SystemPage').then(({ SystemPage }) => ({ default: SystemPage })),
);
const TeacherAssignmentsPage = lazy(() =>
  import('../features/teacher/TeacherAssignmentsPage').then(({ TeacherAssignmentsPage }) => ({
    default: TeacherAssignmentsPage,
  })),
);
const TeacherClassPage = lazy(() =>
  import('../features/teacher/TeacherClassPage').then(({ TeacherClassPage }) => ({
    default: TeacherClassPage,
  })),
);
const TeacherGroupDetailPage = lazy(() =>
  import('../features/teacher/TeacherGroupDetailPage').then(({ TeacherGroupDetailPage }) => ({
    default: TeacherGroupDetailPage,
  })),
);
const TeacherPage = lazy(() =>
  import('../features/teacher/TeacherPage').then(({ TeacherPage }) => ({ default: TeacherPage })),
);
const TeacherQuestionsPage = lazy(() =>
  import('../features/teacher/TeacherQuestionsPage').then(({ TeacherQuestionsPage }) => ({
    default: TeacherQuestionsPage,
  })),
);

function SessionStartup() {
  return (
    <main className="auth">
      <div className="auth-card session-startup" role="status" aria-live="polite">
        <div className="auth-brand">
          <BrandMark size={40} />
          <span>NekoPath</span>
        </div>
        <p className="session-startup__message">Đang mở không gian học tập…</p>
        <span className="session-startup__progress" aria-hidden="true" />
      </div>
    </main>
  );
}

function RequireSession() {
  const { account, ready } = useSession();
  if (!ready) return <SessionStartup />;
  return account ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ role }: { role: Role }) {
  const { account, ready } = useSession();
  if (!ready) return <SessionStartup />;
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== role) {
    return <Navigate to={account.role === 'STUDENT' ? '/student' : '/teacher'} replace />;
  }
  return <Outlet />;
}

function WorkspaceHome() {
  const { account, ready } = useSession();
  if (!ready) return <SessionStartup />;
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

function AppContent() {
  const { account, ready } = useSession();

  return (
    <>
      <UpdatePrompt preWorkspace={!ready || account === null} />
      <Suspense
        fallback={<div className="page-loading" aria-label="Đang tải không gian làm việc" />}
      >
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
                <Route path="teacher/class/:groupId" element={<TeacherGroupDetailPage />} />
                <Route path="teacher/questions" element={<TeacherQuestionsPage />} />
                <Route path="teacher/assignments" element={<TeacherAssignmentsPage />} />
              </Route>
              <Route path="system" element={<SystemPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
