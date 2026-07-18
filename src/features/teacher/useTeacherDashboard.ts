import { useCallback, useEffect, useState } from 'react';
import {
  EMPTY_TEACHER_DASHBOARD,
  fetchTeacherDashboard,
  type TeacherDashboardDto,
} from './teacher-api';

export function useTeacherDashboard() {
  const [dashboard, setDashboard] = useState<TeacherDashboardDto>(EMPTY_TEACHER_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchTeacherDashboard();
      setDashboard(next);
      return next;
    } catch {
      setError('Không tải được dữ liệu lớp từ máy chủ.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTeacherDashboard(controller.signal)
      .then((next) => setDashboard(next))
      .catch((fetchError: unknown) => {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setError('Không tải được dữ liệu lớp từ máy chủ.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return {
    dashboard,
    overrides: dashboard.overrides,
    loading,
    error,
    refresh,
  };
}
