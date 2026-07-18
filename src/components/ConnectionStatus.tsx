import { useEffect, useState } from 'react';
import { flushOutbox, useSyncStatus } from '../services/sync';

function timeAgoVi(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.round(seconds / 60)} phút trước`;
  return `${Math.round(seconds / 3600)} giờ trước`;
}

/**
 * One quiet line that answers the only status question a learner has:
 * "is my work safe?". It replaces the former three-badge bar (environment,
 * sync, connectivity) that shouted three co-equal states on every screen.
 * Only the states needing attention take the review tone; the normal state
 * stays muted. Full detail lives on the Dữ liệu & ngoại tuyến page.
 */
export function ConnectionStatus({
  serverAuthoritative = false,
}: {
  serverAuthoritative?: boolean;
}) {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const sync = useSyncStatus();

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!online) {
    return (
      <p className="sidebar-status" data-tone="review" role="status">
        {serverAuthoritative
          ? 'Ngoại tuyến — chưa cập nhật dữ liệu lớp'
          : 'Ngoại tuyến — bài làm lưu trên thiết bị'}
      </p>
    );
  }

  if (serverAuthoritative) {
    return (
      <p className="sidebar-status" role="status">
        Dữ liệu lớp từ máy chủ
      </p>
    );
  }

  if (sync && sync.pendingCount > 0) {
    return (
      <button
        type="button"
        className="sidebar-status sidebar-status--action"
        data-tone="review"
        onClick={() => void flushOutbox()}
        title="Bấm để thử đồng bộ ngay"
      >
        {sync.pendingCount} thay đổi chờ đồng bộ
      </button>
    );
  }

  return (
    <p className="sidebar-status" role="status">
      {sync?.lastSyncedAt
        ? `Đã đồng bộ ${timeAgoVi(sync.lastSyncedAt)}`
        : 'Dữ liệu lưu trên thiết bị'}
    </p>
  );
}
