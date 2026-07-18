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
  FAILED: 'Không tải lên được. Kiểm tra mạng rồi thử lại.',
};

export function TeacherResourcePanel({ kcId }: { readonly kcId: string }) {
  const resources = useResourcesForKc(kcId);
  const [title, setTitle] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || state === 'uploading') return;
    setState('uploading');
    setMessage('');
    const result = await uploadResource(kcId, title.trim() || file.name, file);
    if (result === 'UPLOADED') {
      setState('done');
      setTitle('');
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
                    {resource.kind === 'VIDEO' ? 'Video' : 'PDF'} · {formatBytes(resource.byteSize)}
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
          Tên hiển thị (tuỳ chọn)
          <input
            maxLength={120}
            placeholder="Ví dụ: Video 3 phút — Phân số bằng nhau"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Chọn tệp (PDF, MP4, WebM · tối đa 60 MB)
          <input ref={fileRef} required type="file" accept="application/pdf,video/mp4,video/webm" />
        </label>
        <div className="inline-actions">
          <button className="button-primary" type="submit" disabled={state === 'uploading'}>
            {state === 'uploading' ? 'Đang tải lên…' : 'Tải lên và phát cho lớp'}
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
