import { useEffect, useState } from 'react';
import { DB_SCHEMA_VERSION } from '../../storage/db';
import { countEvents, resetDemoData } from '../../storage/event-repository';

interface StorageEstimateState {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return 'không rõ';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * Quiet utility surface (§4): human-readable status first, technical
 * versions in expandable detail, reset explicit but never visually primary.
 */
export function SystemPage() {
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimateState>({});
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle');

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
          // Leave estimate unknown; the UI already says "không rõ".
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
    <>
      <section className="section">
        <h1>Hệ thống</h1>
        <ul>
          <li>Chế độ dữ liệu: mô phỏng, lưu trên thiết bị này — không gửi lên máy chủ.</li>
          <li>Số sự kiện học tập đã ghi cục bộ: {eventCount ?? 'không đọc được'}.</li>
          <li>
            Dung lượng lưu trữ (ước tính của trình duyệt): {formatBytes(estimate.usage)} /{' '}
            {formatBytes(estimate.quota)}.
          </li>
          <li>
            Lưu trữ bền vững:{' '}
            {estimate.persisted === undefined
              ? 'không rõ'
              : estimate.persisted
                ? 'đã được cấp'
                : 'chưa được cấp'}
            .
          </li>
        </ul>
        <details className="tech-details">
          <summary>Chi tiết kỹ thuật</summary>
          <ul>
            <li>
              Phiên bản schema cơ sở dữ liệu cục bộ: <code>v{DB_SCHEMA_VERSION}</code>
            </li>
          </ul>
        </details>
      </section>

      <section className="section">
        <h2>Đặt lại dữ liệu mô phỏng</h2>
        <p>
          Xóa toàn bộ sự kiện học tập, ghi đè của giáo viên và hàng đợi đồng bộ trên thiết bị này.
          Chỉ ảnh hưởng dữ liệu mô phỏng của NekoPath.
        </p>
        {resetState === 'idle' && (
          <button type="button" onClick={() => setResetState('confirm')}>
            Đặt lại dữ liệu demo…
          </button>
        )}
        {resetState === 'confirm' && (
          <>
            <p className="evidence-note">Bạn chắc chắn muốn xóa dữ liệu demo cục bộ?</p>
            <button type="button" className="danger" onClick={() => void handleReset()}>
              Xác nhận xóa
            </button>{' '}
            <button type="button" onClick={() => setResetState('idle')}>
              Hủy
            </button>
          </>
        )}
        {resetState === 'done' && <p role="status">Đã đặt lại dữ liệu demo.</p>}
        {resetState === 'error' && (
          <p role="alert" className="danger">
            Không đặt lại được dữ liệu. Bộ nhớ trình duyệt có thể không khả dụng.
          </p>
        )}
      </section>
    </>
  );
}
