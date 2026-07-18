/**
 * Client-side video metadata probe, adapted from LMS_hohulili
 * (`core/utils/video-probe.util.ts`): read duration, frame size and a poster
 * frame from a local File BEFORE upload, so the teacher confirms what the
 * class will receive and students get a real thumbnail — with zero server-side
 * transcoding. Pure HTMLVideoElement + canvas; a failed probe returns null
 * fields and never blocks the upload.
 */

export interface VideoProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  posterDataUrl: string | null;
}

export const EMPTY_PROBE: VideoProbeResult = {
  durationSeconds: null,
  width: null,
  height: null,
  posterDataUrl: null,
};

const POSTER_CAPTURE_SECOND = 1.0;
const POSTER_MAX_WIDTH = 320;
const PROBE_TIMEOUT_MS = 8000;

export async function probeVideoFile(file: File): Promise<VideoProbeResult> {
  if (typeof document === 'undefined') return EMPTY_PROBE;
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  const result: VideoProbeResult = { ...EMPTY_PROBE };
  try {
    await waitForMetadata(video);
    result.durationSeconds = Number.isFinite(video.duration) ? video.duration : null;
    result.width = video.videoWidth || null;
    result.height = video.videoHeight || null;
    try {
      result.posterDataUrl = await capturePosterFrame(video);
    } catch {
      // Poster is best-effort; duration alone is already useful.
    }
  } catch {
    // Probe failed — caller falls back to filename-only presentation.
  } finally {
    try {
      video.src = '';
      video.load();
    } catch {
      // Detaching the element is best-effort cleanup.
    }
    URL.revokeObjectURL(objectUrl);
  }
  return result;
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('probe-timeout')), PROBE_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', done);
      video.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', done);
      video.removeEventListener('error', fail);
      reject(new Error('probe-error'));
    };
    video.addEventListener('loadedmetadata', done);
    video.addEventListener('error', fail);
  });
}

async function capturePosterFrame(video: HTMLVideoElement): Promise<string> {
  const seekTarget = Math.min(POSTER_CAPTURE_SECOND, (video.duration || 1) / 2);
  await seekTo(video, seekTarget);
  const canvas = document.createElement('canvas');
  const ratio =
    video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 9 / 16;
  canvas.width = Math.min(POSTER_MAX_WIDTH, video.videoWidth || POSTER_MAX_WIDTH);
  canvas.height = Math.round(canvas.width * ratio);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas-unavailable');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('seek-timeout')), 3000);
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    try {
      video.currentTime = seconds;
    } catch (error) {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error('seek-failed'));
    }
  });
}

/** "3:24" below an hour, "1:02:05" above — the compact form video players use. */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (!width || !height) return '';
  if (height >= 1080) return `${width}×${height} · 1080p`;
  if (height >= 720) return `${width}×${height} · 720p`;
  if (height >= 480) return `${width}×${height} · 480p`;
  return `${width}×${height}`;
}

/** "phan-so_bang nhau.final.mp4" → "phan so bang nhau final" — a usable title draft. */
export function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Resume decision: worth restoring only past 5s (an accidental tap is not
 * progress) and before 90% (a finished video restarts from the beginning).
 */
export function resumePositionFrom(
  positionSeconds: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null {
  if (!positionSeconds || !durationSeconds) return null;
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return null;
  if (positionSeconds <= 5) return null;
  if (positionSeconds >= durationSeconds * 0.9) return null;
  return positionSeconds;
}
