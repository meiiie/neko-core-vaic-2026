import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { BrandMark } from '../components/BrandMark';
import { SessionProvider, useSession, type Role } from './session';
import { UpdatePrompt } from '../features/pwa-status/UpdatePrompt';
import { LandingPage } from './pages/LandingPage';
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
const LessonPage = lazy(() =>
  import('../features/student/LessonPage').then(({ LessonPage }) => ({ default: LessonPage })),
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
const TeacherStudentsPage = lazy(() =>
  import('../features/teacher/TeacherStudentsPage').then(({ TeacherStudentsPage }) => ({
    default: TeacherStudentsPage,
  })),
);
const TeacherStudentDetailPage = lazy(() =>
  import('../features/teacher/TeacherStudentDetailPage').then(({ TeacherStudentDetailPage }) => ({
    default: TeacherStudentDetailPage,
  })),
);
const TeacherLessonsPage = lazy(() =>
  import('../features/teacher/TeacherLessonsPage').then(({ TeacherLessonsPage }) => ({
    default: TeacherLessonsPage,
  })),
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

/**
 * "/" introduces the product to signed-out visitors; an existing session goes
 * straight to its workspace so the installed PWA (start_url "/") still opens
 * on work, not marketing.
 */
function RootRoute() {
  const { account, ready } = useSession();
  if (!ready) return <SessionStartup />;
  if (account) {
    return <Navigate to={account.role === 'STUDENT' ? '/student' : '/teacher'} replace />;
  }
  return <LandingPage />;
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
          <Route index element={<RootRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireSession />}>
            <Route element={<AppLayout />}>
              <Route element={<RequireRole role="STUDENT" />}>
                <Route path="student" element={<StudentDashboardPage />} />
                <Route path="student/check-in" element={<LearnPage />} />
                <Route path="student/practice" element={<PracticePage />} />
                <Route path="student/assignments" element={<AssignmentsPage />} />
                <Route path="student/assignments/:assignmentId" element={<AssignmentTakePage />} />
                <Route path="student/path" element={<PathPage />} />
                <Route path="student/lesson/:kcId" element={<LessonPage />} />
              </Route>
              <Route element={<RequireRole role="TEACHER" />}>
                <Route path="teacher" element={<TeacherPage />} />
                <Route path="teacher/students" element={<TeacherStudentsPage />} />
                <Route path="teacher/students/:studentId" element={<TeacherStudentDetailPage />} />
                <Route path="teacher/class" element={<TeacherClassPage />} />
                <Route path="teacher/class/:groupId" element={<TeacherGroupDetailPage />} />
                <Route path="teacher/questions" element={<TeacherQuestionsPage />} />
                <Route path="teacher/lessons" element={<TeacherLessonsPage />} />
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
