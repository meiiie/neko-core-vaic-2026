import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../app/session';
import {
  cachedResourceObjectUrl,
  formatBytes,
  removeResourceOffline,
  resourceFileUrl,
  saveResourceOffline,
  saveResourceProgress,
  useResourceProgress,
  useResourcesForKc,
} from '../../services/resources';
import { formatDuration, resumePositionFrom } from '../../services/video-probe';
import type { ResourceRecord } from '../../storage/db';

/**
 * Multimedia attachments of a lesson: micro-learning video and PDF summary.
 * Files stream online (HTTP Range); "Lưu ngoại tuyến" pins the full file into
 * the device cache so watching/reading survives a dead network. Downloads are
 * always explicit with the size shown — nothing heavy rides in silently.
 *
 * Video UX follows the LMS_hohulili player: poster + duration before any
 * bytes stream, per-learner resume position ("Tiếp tục từ 3:24"), and one
 * silent retry that preserves the position when a flaky stream errors out.
 */

const PROGRESS_SAVE_INTERVAL_SECONDS = 5;

interface OfflineState {
  readonly cached: boolean;
  readonly url: string | null;
}

function VideoPlayer({
  resource,
  mediaUrl,
  streaming,
}: {
  readonly resource: ResourceRecord;
  readonly mediaUrl: string;
  readonly streaming: boolean;
}) {
  const { account } = useSession();
  const learnerId = account?.learnerId ?? account?.id ?? null;
  const progress = useResourceProgress(learnerId, resource.id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedAtRef = useRef(0);
  const retriedRef = useRef(false);
  const resumeAt = resumePositionFrom(progress?.positionSeconds, progress?.durationSeconds);

  function persistPosition() {
    const video = videoRef.current;
    if (!video || !learnerId || !Number.isFinite(video.duration) || video.duration <= 0) return;
    void saveResourceProgress(learnerId, resource.id, video.currentTime, video.duration);
  }

  return (
    <figure className="video-card">
      <video
        ref={videoRef}
        className="resource-video"
        controls
        preload="none"
        playsInline
        src={mediaUrl}
        poster={resource.posterDataUrl ?? undefined}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (video && resumeAt !== null && video.currentTime < 1) {
            video.currentTime = resumeAt;
          }
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video || video.paused) return;
          if (video.currentTime - lastSavedAtRef.current >= PROGRESS_SAVE_INTERVAL_SECONDS) {
            lastSavedAtRef.current = video.currentTime;
            persistPosition();
          }
        }}
        onPause={persistPosition}
        onEnded={() => {
          const video = videoRef.current;
          if (video && learnerId && Number.isFinite(video.duration)) {
            void saveResourceProgress(learnerId, resource.id, video.duration, video.duration);
          }
        }}
        onError={() => {
          // One silent reload preserving the position covers the common
          // dropped-connection case; a second failure surfaces the native
          // player error instead of looping.
          const video = videoRef.current;
          if (!video || !streaming || retriedRef.current) return;
          retriedRef.current = true;
          const position = video.currentTime;
          video.load();
          if (position > 0) video.currentTime = position;
        }}
      />
      {resumeAt !== null ? (
        <figcaption className="video-resume">
          <button
            className="text-link"
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.currentTime = resumeAt;
              void video.play();
            }}
          >
            Tiếp tục từ {formatDuration(resumeAt)}
          </button>
        </figcaption>
      ) : null}
    </figure>
  );
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
  const roleLabel =
    resource.role === 'EXPLAIN'
      ? 'Giải thích'
      : resource.role === 'WORKED_EXAMPLE'
        ? 'Ví dụ có lời giải'
        : 'Tóm tắt';
  const metaLine = [
    resource.kind === 'VIDEO' ? 'Video bài giảng' : 'Tài liệu PDF',
    roleLabel,
    formatDuration(resource.durationSeconds),
    formatBytes(resource.byteSize),
    resource.uploadedByName ?? '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="resource-row">
      <div className="resource-row-head">
        <span className="resource-copy">
          <strong>{resource.title}</strong>
          <small>{metaLine}</small>
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
          <VideoPlayer resource={resource} mediaUrl={mediaUrl} streaming={offline.url === null} />
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
