import { useEffect, useState } from 'react';
import { flushOutbox, useSyncStatus } from '../../services/sync';
import { DB_SCHEMA_VERSION } from '../../storage/db';
import { countEvents, resetDemoData } from '../../storage/event-repository';

interface StorageEstimateState {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return 'Không xác định';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function SystemPage() {
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimateState>({});
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle');
  const sync = useSyncStatus();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const count = await countEvents();
        if (!cancelled) setEventCount(count);
      } catch {
        if (!cancelled) setEventCount(null);
      }
      if (navigator.storage?.estimate) {
        try {
          const { usage, quota } = await navigator.storage.estimate();
          const persisted = navigator.storage.persisted
            ? await navigator.storage.persisted()
            : undefined;
          if (!cancelled) setEstimate({ usage, quota, persisted });
        } catch {
          // Unknown is an explicit UI state below.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resetState]);

  async function handleReset() {
    try {
      await resetDemoData();
      setResetState('done');
    } catch {
      setResetState('error');
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Thiết bị hiện tại</p>
        <h1>Dữ liệu &amp; ngoại tuyến</h1>
        <p>Kiểm tra dữ liệu đã lưu và khả năng tiếp tục học khi kết nối không ổn định.</p>
      </header>

      <section className="system-grid">
        <article className="summary-panel">
          <p className="eyebrow">Trạng thái</p>
          <h2>Sẵn sàng học ngoại tuyến</h2>
          <ul className="status-list">
            <li>
              <span>Sự kiện học tập</span>
              <strong>{eventCount ?? 'Không đọc được'}</strong>
            </li>
            <li>
              <span>Dung lượng đang dùng</span>
              <strong>{formatBytes(estimate.usage)}</strong>
            </li>
            <li>
              <span>Hạn mức trình duyệt</span>
              <strong>{formatBytes(estimate.quota)}</strong>
            </li>
            <li>
              <span>Lưu trữ bền vững</span>
              <strong>
                {estimate.persisted === undefined
                  ? 'Chưa rõ'
                  : estimate.persisted
                    ? 'Đã cấp'
                    : 'Chưa cấp'}
              </strong>
            </li>
          </ul>
          <details>
            <summary>Thông tin phiên bản</summary>
            <p>
              Schema dữ liệu cục bộ: <code>v{DB_SCHEMA_VERSION}</code>
            </p>
          </details>
        </article>

        <article className="summary-panel">
          <p className="eyebrow">Đồng bộ với máy chủ lớp học</p>
          <h2>
            {sync === undefined
              ? 'Đang đọc trạng thái…'
              : sync.pendingCount > 0
                ? `${sync.pendingCount} sự kiện đang chờ đồng bộ`
                : 'Không có sự kiện chờ'}
          </h2>
          <ul className="status-list">
            <li>
              <span>Lần đồng bộ gần nhất</span>
              <strong>
                {sync?.lastSyncedAt
                  ? new Date(sync.lastSyncedAt).toLocaleTimeString('vi-VN')
                  : 'Chưa đồng bộ trên thiết bị này'}
              </strong>
            </li>
            <li>
              <span>Cơ chế</span>
              <strong>Tự động khi có mạng; ID sự kiện chống trùng lặp</strong>
            </li>
          </ul>
          <button className="button-secondary" type="button" onClick={() => void flushOutbox()}>
            Đồng bộ ngay
          </button>
        </article>

        <article className="summary-panel danger-zone">
          <p className="eyebrow">Khôi phục môi trường dùng thử</p>
          <h2>Xóa tiến độ trên thiết bị này</h2>
          <p>Thao tác xóa các câu trả lời, ghi đè của giáo viên và hàng đợi đồng bộ cục bộ.</p>
          {resetState === 'idle' ? (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setResetState('confirm')}
            >
              Đặt lại dữ liệu…
            </button>
          ) : null}
          {resetState === 'confirm' ? (
            <div className="confirm-panel">
              <p>Bạn chắc chắn muốn xóa toàn bộ tiến độ dùng thử trên thiết bị này?</p>
              <div>
                <button className="button-danger" type="button" onClick={() => void handleReset()}>
                  Xác nhận xóa
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setResetState('idle')}
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : null}
          {resetState === 'done' ? (
            <p role="status" className="save-message">
              Đã đặt lại dữ liệu trên thiết bị.
            </p>
          ) : null}
          {resetState === 'error' ? (
            <p role="alert" className="error-message">
              Không thể đặt lại dữ liệu. Hãy thử lại.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
