import { useEffect, useState } from 'react';
import {
  cachedResourceObjectUrl,
  formatBytes,
  removeResourceOffline,
  resourceFileUrl,
  saveResourceOffline,
  useResourcesForKc,
} from '../../services/resources';
import type { ResourceRecord } from '../../storage/db';

/**
 * Multimedia attachments of a lesson: micro-learning video and PDF summary.
 * Files stream online; "Lưu ngoại tuyến" pins the full file into the device
 * cache so watching/reading survives a dead network. The download is always
 * explicit with the size shown — nothing heavy rides in silently.
 */

interface OfflineState {
  readonly cached: boolean;
  readonly url: string | null;
}

function ResourceRow({ resource }: { readonly resource: ResourceRecord }) {
  const [offline, setOffline] = useState<OfflineState>({ cached: false, url: null });
  const [busy, setBusy] = useState(false);

  // One async read on mount: is this file already pinned on the device?
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void cachedResourceObjectUrl(resource.id).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setOffline({ cached: url !== null, url });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resource.id]);

  async function toggleOffline() {
    setBusy(true);
    if (offline.cached) {
      await removeResourceOffline(resource.id);
      if (offline.url) URL.revokeObjectURL(offline.url);
      setOffline({ cached: false, url: null });
    } else {
      const saved = await saveResourceOffline(resource.id, resource.sha256);
      const url = saved === 'SAVED' ? await cachedResourceObjectUrl(resource.id) : null;
      setOffline({ cached: url !== null, url });
    }
    setBusy(false);
  }

  const mediaUrl = offline.url ?? resourceFileUrl(resource.id);

  return (
    <li className="resource-row">
      <div className="resource-row-head">
        <span className="resource-copy">
          <strong>{resource.title}</strong>
          <small>
            {resource.kind === 'VIDEO' ? 'Video bài giảng' : 'Tài liệu PDF'} ·{' '}
            {resource.role === 'EXPLAIN'
              ? 'Giải thích'
              : resource.role === 'WORKED_EXAMPLE'
                ? 'Ví dụ có lời giải'
                : 'Tóm tắt'}{' '}
            · {formatBytes(resource.byteSize)}
            {resource.durationSeconds ? ` · ${Math.ceil(resource.durationSeconds / 60)} phút` : ''}
            {resource.uploadedByName ? ` · ${resource.uploadedByName}` : ''}
          </small>
        </span>
        <span className="resource-actions">
          {resource.kind === 'PDF' ? (
            <a
              className="button-secondary"
              href={mediaUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Mở tài liệu
            </a>
          ) : null}
          <button
            className="button-secondary"
            type="button"
            disabled={busy}
            onClick={() => void toggleOffline()}
          >
            {busy ? 'Đang xử lý…' : offline.cached ? 'Đã lưu ✓ · Xoá' : 'Lưu ngoại tuyến'}
          </button>
        </span>
      </div>
      {resource.kind === 'VIDEO' ? (
        <>
          <video className="resource-video" controls preload="none" src={mediaUrl} />
          <details>
            <summary>Transcript video</summary>
            <p>
              {resource.transcriptVi ??
                'Video này chưa có transcript. Giáo viên cần bổ sung trước khi tuyên bố hỗ trợ tiếp cận đầy đủ.'}
            </p>
          </details>
        </>
      ) : null}
    </li>
  );
}

export function LessonResources({ kcId }: { readonly kcId: string }) {
  const resources = useResourcesForKc(kcId);
  const visibleResources = resources?.filter(
    (resource) => resource.status === 'PUBLISHED' && resource.reviewState === 'ACCEPTED',
  );
  if (!visibleResources || visibleResources.length === 0) {
    return (
      <section className="summary-panel lesson-panel" aria-labelledby="lesson-resources-empty">
        <h2 id="lesson-resources-empty">Video và tài liệu PDF</h2>
        <p>Chưa có video/PDF đã duyệt cho bước này. Em vẫn có thể học bằng tóm tắt chữ ở trên.</p>
      </section>
    );
  }

  return (
    <section className="summary-panel lesson-panel" aria-labelledby="lesson-resources">
      <h2 id="lesson-resources">Video và tài liệu của bài</h2>
      <ul className="resource-list">
        {visibleResources.map((resource) => (
          <ResourceRow key={resource.id} resource={resource} />
        ))}
      </ul>
      <p className="data-footnote">
        Bấm "Lưu ngoại tuyến" khi có mạng để xem lại được cả khi mất kết nối.
      </p>
    </section>
  );
}
