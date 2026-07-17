import { flushOutbox, useSyncStatus } from '../services/sync';

function timeAgoVi(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.round(seconds / 60)} phút trước`;
  return `${Math.round(seconds / 3600)} giờ trước`;
}

/**
 * Honest sync state (LMS pattern: show queued count + last result, never
 * pretend "synced" while items wait). Click retries immediately.
 */
export function SyncBadge() {
  const status = useSyncStatus();
  if (!status) return null;

  if (status.pendingCount > 0) {
    return (
      <button
        type="button"
        className="status-label status-label--review sync-badge"
        onClick={() => void flushOutbox()}
        title="Bấm để thử đồng bộ ngay"
      >
        {status.pendingCount} sự kiện chờ đồng bộ
      </button>
    );
  }
  return (
    <span className="status-label status-label--neutral" role="status">
      {status.lastSyncedAt ? `Đã đồng bộ ${timeAgoVi(status.lastSyncedAt)}` : 'Lưu trên thiết bị'}
    </span>
  );
}
