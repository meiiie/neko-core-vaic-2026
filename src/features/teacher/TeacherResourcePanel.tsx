import { useRef, useState } from 'react';
import {
  deleteResource,
  formatBytes,
  uploadResource,
  useResourcesForKc,
  type UploadResult,
} from '../../services/resources';

/**
 * Teacher attachments for one skill: upload a compressed micro-learning
 * video (mp4/webm) or a PDF summary; students receive it on their next
 * refresh and can pin it offline. Size and type limits are enforced
 * server-side; this panel just reports them honestly.
 */

const UPLOAD_MESSAGES: Record<Exclude<UploadResult, 'UPLOADED'>, string> = {
  TOO_LARGE: 'Tệp vượt 60 MB — hãy nén video ngắn hơn rồi thử lại.',
  UNSUPPORTED: 'Chỉ nhận PDF, MP4 hoặc WebM.',
  INVALID: 'Metadata chưa hợp lệ. Bản xuất bản phải được duyệt và video cần có thời lượng.',
  FAILED: 'Không tải lên được. Kiểm tra mạng rồi thử lại.',
};

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
  const [isVideo, setIsVideo] = useState(false);
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || state === 'uploading') return;
    setState('uploading');
    setMessage('');
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
      file,
    );
    if (result === 'UPLOADED') {
      setState('done');
      setTitle('');
      setDurationSeconds('');
      setTranscriptVi('');
      if (fileRef.current) fileRef.current.value = '';
    } else {
      setState('error');
      setMessage(UPLOAD_MESSAGES[result]);
    }
  }

  return (
    <section className="summary-panel resource-admin" aria-labelledby="resource-admin-heading">
      <h2 id="resource-admin-heading">Video và PDF đính kèm</h2>

      {resources && resources.length > 0 ? (
        <ul className="resource-list">
          {resources.map((resource) => (
            <li key={resource.id} className="resource-row">
              <div className="resource-row-head">
                <span className="resource-copy">
                  <strong>{resource.title}</strong>
                  <small>
                    {resource.kind === 'VIDEO' ? 'Video' : 'PDF'} · {resource.role} ·{' '}
                    {formatBytes(resource.byteSize)} · {resource.status} · {resource.reviewState}
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
        {isVideo ? (
          <>
            <label>
              Thời lượng video (giây)
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
        <label>
          Chọn tệp (PDF, MP4, WebM · tối đa 60 MB)
          <input
            ref={fileRef}
            required
            type="file"
            accept="application/pdf,video/mp4,video/webm"
            onChange={(event) =>
              setIsVideo(event.target.files?.[0]?.type.startsWith('video/') ?? false)
            }
          />
        </label>
        <div className="inline-actions">
          <button className="button-primary" type="submit" disabled={state === 'uploading'}>
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
