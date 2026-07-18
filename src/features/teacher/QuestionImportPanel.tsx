import { useMemo, useRef, useState } from 'react';
import { CheckCircleIcon } from '@phosphor-icons/react/CheckCircle';
import { FileDocIcon } from '@phosphor-icons/react/FileDoc';
import { FileXlsIcon } from '@phosphor-icons/react/FileXls';
import { UploadSimpleIcon } from '@phosphor-icons/react/UploadSimple';
import { WarningCircleIcon } from '@phosphor-icons/react/WarningCircle';
import { HERO_GRAPH } from '../../content';
import { DIFFICULTY_LABELS } from './teacher-presentation';

interface ImportedChoice {
  id: string;
  label: string;
}

interface ImportedQuestionDraft {
  sourceIndex: number;
  prompt: string;
  choices: ImportedChoice[];
  correctChoiceId: string;
  hints: string[];
  explanation: string;
  difficulty: string;
  valid: boolean;
  issues: string[];
}

interface ImportPreview {
  fileName: string;
  format: 'DOCX' | 'XLSX';
  totalCount: number;
  validCount: number;
  invalidCount: number;
  questions: ImportedQuestionDraft[];
}

interface QuestionImportPanelProps {
  initialKcId?: string;
  onClose: () => void;
  onImported: (kcId: string, count: number) => void | Promise<void>;
}

type BusyState = 'idle' | 'previewing' | 'importing';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function responseMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function QuestionImportPanel({
  initialKcId,
  onClose,
  onImported,
}: QuestionImportPanelProps) {
  const [kcId, setKcId] = useState(initialKcId && initialKcId !== 'ALL' ? initialKcId : 'K02');
  const [difficulty, setDifficulty] = useState('UNSPECIFIED');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<BusyState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedQuestions = useMemo(
    () =>
      preview?.questions.filter((question, index) => question.valid && selected.has(index)) ?? [],
    [preview, selected],
  );
  const selectedKcName = HERO_GRAPH.nodes.find((node) => node.id === kcId)?.name ?? kcId;

  function chooseFile(nextFile: File | null) {
    setError(null);
    setPreview(null);
    setSelected(new Set());
    setImportedCount(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const extension = nextFile.name.toLocaleLowerCase('vi').split('.').at(-1);
    if (extension !== 'docx' && extension !== 'xlsx') {
      setFile(null);
      setError('Chỉ hỗ trợ file Word .docx hoặc Excel .xlsx.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('File lớn hơn 5 MB. Hãy chia thành file nhỏ hơn rồi thử lại.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(nextFile);
  }

  async function previewFile(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Cô hãy chọn một file Word hoặc Excel trước.');
      return;
    }

    setBusy('previewing');
    setError(null);
    const formData = new FormData();
    formData.append('kcId', kcId);
    formData.append('difficulty', difficulty);
    formData.append('file', file);

    try {
      const response = await fetch('/api/questions/import/preview', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const body = (await response.json().catch(() => null)) as ImportPreview | null;
      if (!response.ok || !body || !Array.isArray(body.questions)) {
        throw new Error(
          responseMessage(body, 'Không đọc được file. Hãy kiểm tra đúng mẫu rồi thử lại.'),
        );
      }
      setPreview(body);
      setSelected(
        new Set(body.questions.flatMap((question, index) => (question.valid ? [index] : []))),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đọc được file. Hãy thử lại.');
    } finally {
      setBusy('idle');
    }
  }

  async function confirmImport() {
    if (selectedQuestions.length === 0) {
      setError('Cô hãy chọn ít nhất một câu hợp lệ để thêm vào gói.');
      return;
    }

    setBusy('importing');
    setError(null);
    try {
      const response = await fetch('/api/questions/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kcId,
          questions: selectedQuestions.map((question) => ({
            kcId,
            difficulty: question.difficulty,
            prompt: question.prompt,
            choices: question.choices,
            correctChoiceId: question.correctChoiceId,
            hints: question.hints,
            explanation: question.explanation,
          })),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        importedCount?: number;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(responseMessage(body, 'Không thêm được câu hỏi. Hãy thử lại.'));
      }
      const count = body?.importedCount ?? selectedQuestions.length;
      setImportedCount(count);
      await onImported(kcId, count);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thêm được câu hỏi. Hãy thử lại.');
    } finally {
      setBusy('idle');
    }
  }

  function toggleQuestion(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (importedCount !== null) {
    return (
      <section
        className="summary-panel question-import-panel"
        aria-labelledby="import-success-title"
      >
        <div className="question-import-success">
          <CheckCircleIcon size={32} weight="fill" aria-hidden="true" />
          <div>
            <h2 id="import-success-title">
              Đã thêm {importedCount} câu vào nhóm {selectedKcName}
            </h2>
            <p>Các câu mới đang ở trạng thái bản nháp để cô kiểm tra trước khi giao bài.</p>
          </div>
          <button className="button-primary" type="button" onClick={onClose}>
            Xem câu vừa thêm
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="summary-panel question-import-panel"
      aria-labelledby="question-import-title"
    >
      <header className="panel-heading question-import-heading">
        <div>
          <p className="eyebrow">Thêm nhiều câu cùng lúc</p>
          <h2 id="question-import-title">Nhập câu hỏi từ Word hoặc Excel</h2>
          <p>Chọn nhóm nhận câu hỏi trước, sau đó kiểm tra từng câu rồi mới lưu.</p>
        </div>
        <button className="text-link" type="button" onClick={onClose}>
          Đóng
        </button>
      </header>

      <ol className="question-import-steps" aria-label="Các bước nhập câu hỏi">
        <li className="is-current">
          <span>1</span> Chọn nhóm và file
        </li>
        <li className={preview ? 'is-current' : ''}>
          <span>2</span> Kiểm tra câu hỏi
        </li>
        <li>
          <span>3</span> Thêm vào gói
        </li>
      </ol>

      {!preview ? (
        <form className="question-import-form" onSubmit={(event) => void previewFile(event)}>
          <div className="question-import-destination">
            <label>
              <span>
                <strong>Nhóm câu hỏi / chủ đề của file</strong>
                <small>Tất cả câu hợp lệ trong file sẽ được thêm vào nhóm này.</small>
              </span>
              <select value={kcId} onChange={(event) => setKcId(event.target.value)}>
                {HERO_GRAPH.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="question-import-settings">
            <label>
              Độ khó mặc định
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label
            className={`question-import-dropzone${file ? ' has-file' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0] ?? null);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.xlsx"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            <UploadSimpleIcon size={28} weight="duotone" aria-hidden="true" />
            <span>
              <strong>{file ? file.name : 'Chọn file Word hoặc Excel'}</strong>
              <small>
                {file
                  ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                  : 'Hoặc kéo thả file vào đây · tối đa 5 MB'}
              </small>
            </span>
          </label>

          <details className="question-import-format-guide">
            <summary>Xem cách trình bày file đúng mẫu</summary>
            <div className="question-import-guide" aria-label="Mẫu file được hỗ trợ">
              <article>
                <FileDocIcon size={24} weight="duotone" aria-hidden="true" />
                <div>
                  <strong>File Word (.docx)</strong>
                  <p>
                    Mỗi câu bắt đầu bằng số; đáp án ghi A, B, C, D. Đặt dấu * trước đáp án đúng hoặc
                    thêm dòng “Đáp án: B”.
                  </p>
                </div>
              </article>
              <article>
                <FileXlsIcon size={24} weight="duotone" aria-hidden="true" />
                <div>
                  <strong>File Excel (.xlsx)</strong>
                  <p>Dòng đầu gồm: Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng.</p>
                </div>
              </article>
            </div>
          </details>

          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}
          <div className="inline-actions">
            <button className="button-primary" type="submit" disabled={!file || busy !== 'idle'}>
              {busy === 'previewing' ? 'Đang đọc file…' : 'Đọc file và kiểm tra'}
            </button>
            <button className="button-secondary" type="button" onClick={onClose}>
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <div className="question-import-preview">
          <div className="question-import-preview-summary">
            <div>
              <strong>{preview.fileName}</strong>
              <p>
                Nhóm {selectedKcName} · {preview.totalCount} câu được tìm thấy
              </p>
            </div>
            <span className="status-label status-label--evidence">
              {preview.validCount} câu sẵn sàng
            </span>
            {preview.invalidCount > 0 ? (
              <span className="status-label status-label--review">
                {preview.invalidCount} câu cần sửa
              </span>
            ) : null}
          </div>

          {preview.invalidCount > 0 ? (
            <p className="question-import-notice">
              <WarningCircleIcon size={20} weight="fill" aria-hidden="true" />
              Câu cần sửa sẽ không được thêm. Cô có thể sửa trong file rồi chọn lại file.
            </p>
          ) : null}

          <ul className="question-import-list">
            {preview.questions.map((question, index) => (
              <li
                key={`${question.sourceIndex}-${index}`}
                className={question.valid ? '' : 'is-invalid'}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={question.valid && selected.has(index)}
                    disabled={!question.valid}
                    onChange={() => toggleQuestion(index)}
                    aria-label={`Chọn câu ${question.sourceIndex}: ${question.prompt}`}
                  />
                  <span className="question-import-item-content">
                    <small>
                      {preview.format === 'XLSX'
                        ? `Dòng ${question.sourceIndex}`
                        : `Câu ${question.sourceIndex}`}
                    </small>
                    <strong>{question.prompt || 'Chưa có nội dung câu hỏi'}</strong>
                    {question.valid ? (
                      <span>
                        Đáp án đúng:{' '}
                        {
                          question.choices.find((choice) => choice.id === question.correctChoiceId)
                            ?.label
                        }
                      </span>
                    ) : (
                      <span className="error-message">{question.issues.join(' ')}</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {error ? (
            <p className="error-message" role="alert">
              {error}
            </p>
          ) : null}
          <div className="question-import-preview-actions">
            <button
              className="button-secondary"
              type="button"
              onClick={() => {
                setPreview(null);
                setSelected(new Set());
                setError(null);
              }}
            >
              Chọn file khác
            </button>
            <button
              className="button-primary"
              type="button"
              disabled={selectedQuestions.length === 0 || busy !== 'idle'}
              onClick={() => void confirmImport()}
            >
              {busy === 'importing'
                ? 'Đang thêm câu hỏi…'
                : `Thêm ${selectedQuestions.length} câu vào gói`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
