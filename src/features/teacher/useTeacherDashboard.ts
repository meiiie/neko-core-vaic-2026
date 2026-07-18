import { useCallback, useEffect, useState } from 'react';
import {
  EMPTY_TEACHER_DASHBOARD,
  fetchTeacherDashboard,
  type TeacherDashboardDto,
} from './teacher-api';

export function useTeacherDashboard(classId?: string | null) {
  const [dashboard, setDashboard] = useState<TeacherDashboardDto>(EMPTY_TEACHER_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      if (classId === null) return null;
      const next = await fetchTeacherDashboard(classId);
      setDashboard(next);
      return next;
    } catch {
      setError('Không tải được dữ liệu lớp từ máy chủ.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    const controller = new AbortController();
    if (classId === null) {
      return () => controller.abort();
    }
    void fetchTeacherDashboard(classId, controller.signal)
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
  }, [classId]);

  return {
    dashboard: classId === null ? EMPTY_TEACHER_DASHBOARD : dashboard,
    overrides: classId === null ? EMPTY_TEACHER_DASHBOARD.overrides : dashboard.overrides,
    loading:
      classId === null ? false : loading || Boolean(classId && dashboard.classId !== classId),
    error,
    refresh,
  };
}
