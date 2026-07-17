import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { PathPage } from '../features/evidence-path/PathPage';
import { LearnPage } from '../features/student/LearnPage';
import { SystemPage } from '../features/system/SystemPage';
import { TeacherPage } from '../features/teacher/TeacherPage';
import { DemoSessionProvider } from './demo-session';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <DemoSessionProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn/:learnerId" element={<LearnPage />} />
          <Route path="/path/:learnerId" element={<PathPage />} />
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route
            path="*"
            element={
              <section className="section">
                <h1>Không tìm thấy trang</h1>
                <p className="evidence-note">Đường dẫn này không tồn tại trong bản demo.</p>
              </section>
            }
          />
        </Route>
      </Routes>
    </DemoSessionProvider>
  );
}
