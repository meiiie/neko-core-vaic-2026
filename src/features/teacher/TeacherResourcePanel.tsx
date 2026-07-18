import { useRef, useState } from 'react';
import {
  deleteResource,
  formatBytes,
  uploadResource,
  useResourcesForKc,
  type UploadResult,
} from '../../services/resources';
import {
  EMPTY_PROBE,
  formatDuration,
  formatResolution,
  probeVideoFile,
  titleFromFileName,
  type VideoProbeResult,
} from '../../services/video-probe';

/**
 * Teacher attachments for one skill, following the LMS_hohulili
 * video-upload flow: drag-drop or pick a file, probe video metadata on this
 * device (duration, frame size, poster) so the teacher confirms what the
 * class receives, then upload with real byte progress. Curated metadata
 * (role, grade band, review state) rides along; students only ever see
 * resources that are both published and review-accepted.
 */

const UPLOAD_MESSAGES: Record<Exclude<UploadResult, 'UPLOADED'>, string> = {
  TOO_LARGE: 'Tệp vượt 60 MB — hãy nén video ngắn hơn rồi thử lại.',
  UNSUPPORTED: 'Chỉ nhận PDF, MP4 hoặc WebM.',
  INVALID: 'Metadata chưa hợp lệ. Bản xuất bản phải được duyệt và video cần có thời lượng.',
  FAILED: 'Không tải lên được. Kiểm tra mạng rồi thử lại.',
};

const ACCEPTED_TYPES = new Set(['application/pdf', 'video/mp4', 'video/webm']);

interface SelectedFile {
  readonly file: File;
  readonly isVideo: boolean;
  /** null while the probe is still running; EMPTY_PROBE when it failed. */
  readonly probe: VideoProbeResult | null;
}

type PanelState = 'idle' | 'selected' | 'uploading' | 'done' | 'error';

export function TeacherResourcePanel({ kcId }: { readonly kcId: string }) {
  const resources = useResourcesForKc(kcId);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<'EXPLAIN' | 'WORKED_EXAMPLE' | 'SUMMARY'>('SUMMARY');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [transcriptVi, setTranscriptVi] = useState('');
  const [gradeMin, setGradeMin] = useState('5');
  const [gradeMax, setGradeMax] = useState('7');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [reviewState, setReviewState] = useState<'UNREVIEWED' | 'ACCEPTED' | 'REVISE' | 'REJECTED'>(
    'UNREVIEWED',
  );
  const [state, setState] = useState<PanelState>('idle');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function takeFile(file: File | undefined) {
    if (!file || state === 'uploading') return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setState('error');
      setMessage(UPLOAD_MESSAGES.UNSUPPORTED);
      return;
    }
    const isVideo = file.type.startsWith('video/');
    setSelected({ file, isVideo, probe: isVideo ? null : EMPTY_PROBE });
    setTitle((current) => current.trim() || titleFromFileName(file.name));
    setState('selected');
    setMessage('');
    if (isVideo) {
      void probeVideoFile(file).then((probe) => {
        setSelected((current) =>
          current && current.file === file ? { ...current, probe } : current,
        );
        // The probe fills the duration for the teacher; the field stays
        // editable as a fallback for files the browser cannot decode.
        if (probe.durationSeconds) {
          setDurationSeconds(String(Math.round(probe.durationSeconds)));
        }
      });
    }
  }

  function clearSelection() {
    setSelected(null);
    setState('idle');
    setMessage('');
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || state === 'uploading') return;
    setState('uploading');
    setMessage('');
    setProgress(0);
    const result = await uploadResource(
      kcId,
      {
        title: title.trim(),
        role,
        durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
        transcriptVi: transcriptVi.trim(),
        sortOrder: 0,
        status,
        reviewState,
        gradeMin: Number(gradeMin),
        gradeMax: Number(gradeMax),
      },
      selected.file,
      {
        probe: selected.probe ?? undefined,
        onProgress: setProgress,
      },
    );
    if (result === 'UPLOADED') {
      clearSelection();
      setTitle('');
      setDurationSeconds('');
      setTranscriptVi('');
      setState('done');
    } else {
      setState('error');
      setMessage(UPLOAD_MESSAGES[result]);
    }
  }

  const probe = selected?.probe;
  const probeMeta = [
    selected ? formatBytes(selected.file.size) : '',
    formatDuration(probe?.durationSeconds),
    formatResolution(probe?.width, probe?.height),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="summary-panel resource-admin" aria-labelledby="resource-admin-heading">
      <h2 id="resource-admin-heading">Video và PDF đính kèm</h2>

      {resources && resources.length > 0 ? (
        <ul className="resource-list">
          {resources.map((resource) => (
            <li key={resource.id} className="resource-row">
              <div className="resource-row-head">
                <span className={`resource-kind resource-kind-${resource.kind.toLowerCase()}`}>
                  {resource.kind === 'VIDEO' ? 'Video' : 'PDF'}
                </span>
                <span className="resource-copy">
                  <strong>{resource.title}</strong>
                  <small>
                    {[
                      formatBytes(resource.byteSize),
                      formatDuration(resource.durationSeconds),
                      resource.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp',
                      resource.reviewState === 'ACCEPTED' ? 'đã duyệt' : 'chưa duyệt xong',
                      resource.uploadedByName ?? '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void deleteResource(resource.id)}
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Chưa có tệp đính kèm cho kỹ năng này. Video ngắn đã nén (MP4/WebM, tối đa 60 MB) hoặc PDF
          tóm tắt sẽ được phát tới thiết bị học sinh.
        </p>
      )}

      <form className="resource-upload" onSubmit={(event) => void submit(event)}>
        {!selected && state !== 'uploading' ? (
          <div
            className={dragOver ? 'upload-zone upload-zone-active' : 'upload-zone'}
            role="button"
            tabIndex={0}
            aria-label="Chọn hoặc kéo thả tệp PDF, MP4, WebM"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              takeFile(event.dataTransfer.files?.[0]);
            }}
          >
            <p className="upload-zone-title">
              Kéo thả tệp vào đây hoặc <span className="text-link">chọn tệp</span>
            </p>
            <p className="upload-zone-hint">PDF, MP4 hoặc WebM · tối đa 60 MB</p>
          </div>
        ) : null}
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="application/pdf,video/mp4,video/webm"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => takeFile(event.target.files?.[0])}
        />

        {selected ? (
          <div className="upload-preview">
            {selected.isVideo && probe?.posterDataUrl ? (
              <img className="upload-poster" src={probe.posterDataUrl} alt="" />
            ) : null}
            <div className="resource-copy">
              <strong>{selected.file.name}</strong>
              <small>
                {selected.isVideo && probe === null
                  ? `${formatBytes(selected.file.size)} · đang đọc thông tin video…`
                  : probeMeta}
              </small>
            </div>
            {state !== 'uploading' ? (
              <button className="button-secondary" type="button" onClick={clearSelection}>
                Chọn tệp khác
              </button>
            ) : null}
          </div>
        ) : null}

        <label>
          Tên hiển thị
          <input
            required
            maxLength={120}
            placeholder="Ví dụ: Video 3 phút — Phân số bằng nhau"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Vai trò học liệu
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="EXPLAIN">Giải thích ngắn</option>
            <option value="WORKED_EXAMPLE">Ví dụ có lời giải</option>
            <option value="SUMMARY">Tóm tắt</option>
          </select>
        </label>
        <div className="form-row">
          <label>
            Từ lớp
            <input
              required
              min={1}
              max={12}
              type="number"
              value={gradeMin}
              onChange={(event) => setGradeMin(event.target.value)}
            />
          </label>
          <label>
            Đến lớp
            <input
              required
              min={1}
              max={12}
              type="number"
              value={gradeMax}
              onChange={(event) => setGradeMax(event.target.value)}
            />
          </label>
        </div>
        {selected?.isVideo ? (
          <>
            <label>
              Thời lượng video (giây — tự đọc từ tệp, sửa được nếu cần)
              <input
                required
                min={1}
                type="number"
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(event.target.value)}
              />
            </label>
            <label>
              Transcript tiếng Việt (để trống sẽ được ghi rõ là còn thiếu)
              <textarea
                value={transcriptVi}
                onChange={(event) => setTranscriptVi(event.target.value)}
              />
            </label>
          </>
        ) : null}
        <div className="form-row">
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Xuất bản</option>
            </select>
          </label>
          <label>
            Duyệt chuyên môn
            <select
              value={reviewState}
              onChange={(event) => setReviewState(event.target.value as typeof reviewState)}
            >
              <option value="UNREVIEWED">Chưa duyệt</option>
              <option value="ACCEPTED">Chấp nhận</option>
              <option value="REVISE">Cần sửa</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </label>
        </div>

        {state === 'uploading' ? (
          <div
            className="upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="upload-progress-bar"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
            <small>Đang tải lên… {Math.round(progress * 100)}%</small>
          </div>
        ) : null}

        <div className="inline-actions">
          <button
            className="button-primary"
            type="submit"
            disabled={!selected || state === 'uploading'}
          >
            {state === 'uploading'
              ? 'Đang tải lên…'
              : status === 'PUBLISHED'
                ? 'Tải lên và xuất bản'
                : 'Lưu bản nháp'}
          </button>
          {state === 'done' ? (
            <span role="status">Đã tải lên — học sinh nhận ở lần đồng bộ tới.</span>
          ) : null}
          {state === 'error' ? <span role="alert">{message}</span> : null}
        </div>
      </form>
    </section>
  );
}
