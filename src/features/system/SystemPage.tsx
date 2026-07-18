import { useEffect, useState } from 'react';
import { useSession } from '../../app/session';
import {
  deleteWebLlmCache,
  isWebGpuAvailable,
  isWebLlmCached,
  preloadWebLlm,
  setWebLlmProgressListener,
  WEBLLM_MODEL_LABEL,
} from '../../services/agent/webllm-provider';
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

type ModelState =
  | { phase: 'checking' }
  | { phase: 'unsupported' }
  | { phase: 'not-downloaded' }
  | { phase: 'downloading'; percent: number; note: string }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

export function SystemPage() {
  const { account } = useSession();
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<StorageEstimateState>({});
  const [resetState, setResetState] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle');
  const [model, setModel] = useState<ModelState>({ phase: 'checking' });
  const sync = useSyncStatus();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isWebGpuAvailable()) {
        if (!cancelled) setModel({ phase: 'unsupported' });
        return;
      }
      const cached = await isWebLlmCached();
      if (!cancelled) setModel(cached ? { phase: 'ready' } : { phase: 'not-downloaded' });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function downloadModel() {
    setModel({ phase: 'downloading', percent: 0, note: 'Đang chuẩn bị…' });
    setWebLlmProgressListener(({ progress, text }) => {
      setModel({ phase: 'downloading', percent: Math.round(progress * 100), note: text });
    });
    try {
      await preloadWebLlm();
      setModel({ phase: 'ready' });
    } catch (error) {
      setModel({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Tải không thành công.',
      });
    } finally {
      setWebLlmProgressListener(null);
    }
  }

  async function removeModel() {
    await deleteWebLlmCache();
    setModel({ phase: 'not-downloaded' });
  }

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
              Ứng dụng: <code>v{__APP_VERSION__}</code> — bản dựng: <code>{__BUILD_COMMIT__}</code>
            </p>
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

        {account?.role === 'TEACHER' ? (
          <article className="summary-panel">
            <p className="eyebrow">Trợ lý AI trên thiết bị</p>
            <h2>{WEBLLM_MODEL_LABEL}</h2>
            <p>
              Tải một lần khi có mạng tốt; sau khi tải đủ, Neko chạy model trong Web Worker và có
              thể dùng ngoại tuyến. Chọn “Gemma trong trình duyệt” ở cuối bảng Neko.
            </p>
            {model.phase === 'checking' ? <p>Đang kiểm tra…</p> : null}
            {model.phase === 'unsupported' ? (
              <p role="status">
                Trình duyệt này chưa hỗ trợ WebGPU — Neko vẫn hoạt động với bộ điều phối cục bộ
                (không cần model) hoặc Ollama trên máy.
              </p>
            ) : null}
            {model.phase === 'not-downloaded' ? (
              <button className="button-primary" type="button" onClick={() => void downloadModel()}>
                Tải model (~600MB, một lần)
              </button>
            ) : null}
            {model.phase === 'downloading' ? (
              <div role="status">
                <p>
                  Đang tải: <strong>{model.percent}%</strong>
                </p>
                <div
                  style={{
                    height: '0.5rem',
                    borderRadius: '0.25rem',
                    background: 'var(--rule, #e4e7ec)',
                    overflow: 'hidden',
                    maxWidth: '20rem',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${model.percent}%`,
                      background: 'var(--primary, #155eef)',
                    }}
                  />
                </div>
                <p className="muted">{model.note.slice(0, 90)}</p>
                <p className="muted">Nếu gián đoạn, bấm tải lại — phần đã tải được giữ nguyên.</p>
              </div>
            ) : null}
            {model.phase === 'ready' ? (
              <>
                <p role="status">
                  <strong>Sẵn sàng — hoạt động không cần mạng.</strong>
                </p>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void removeModel()}
                >
                  Xóa model khỏi thiết bị
                </button>
              </>
            ) : null}
            {model.phase === 'error' ? (
              <>
                <p role="alert" className="error-message">
                  {model.message}
                </p>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void downloadModel()}
                >
                  Thử tải lại
                </button>
              </>
            ) : null}
          </article>
        ) : null}

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
