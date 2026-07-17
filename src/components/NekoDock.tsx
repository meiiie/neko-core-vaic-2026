import { useEffect, useRef, useState } from 'react';
import { useSession } from '../app/session';
import { runAgent, type AgentProvider, type AgentTraceEvent } from '../services/agent/loop';
import { AGENT_PROVIDERS } from '../services/agent/providers';
import { AGENT_TOOLS } from '../services/agent/tools';
import { isWebLlmCached, setWebLlmProgressListener } from '../services/agent/webllm-provider';

/**
 * Neko — the classroom assistant as a calm product panel (not a terminal).
 * Same tool-grounded loop underneath; transparency lives in a quiet
 * expandable "Nguồn dữ kiện" per answer instead of raw JSON walls.
 */

interface TraceLine {
  readonly kind: 'call' | 'result' | 'note';
  readonly text: string;
}

interface ChatMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly trace?: readonly TraceLine[];
}

const SUGGESTIONS = [
  'Hôm nay nên dạy lại gì cho lớp?',
  'Chẩn đoán của bạn An thế nào?',
  'Tiến độ các bài đã giao?',
  'Giải thích kiến thức K02',
];

let messageId = 0;
function nextId(): number {
  messageId += 1;
  return messageId;
}

export function NekoDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [provider, setProvider] = useState<AgentProvider>(AGENT_PROVIDERS[0]);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText]);

  useEffect(() => {
    setWebLlmProgressListener(({ progress }) => {
      setProgressNote(`Đang nạp Gemma trong trình duyệt… ${Math.round(progress * 100)}%`);
      if (progress >= 1) setProgressNote(null);
    });
    return () => setWebLlmProgressListener(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function switchProvider(id: string) {
    if (id === 'web' && !(await isWebLlmCached())) {
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'assistant',
          text: 'Model Gemma trong trình duyệt chưa được tải. Vào «Dữ liệu & ngoại tuyến» và bấm «Tải model» khi có mạng tốt — tải một lần, sau đó dùng không cần mạng.',
        },
      ]);
      return;
    }
    const next = AGENT_PROVIDERS.find((candidate) => candidate.id === id);
    if (next) setProvider(next);
  }

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    setMessages((previous) => [...previous, { id: nextId(), role: 'user', text: question }]);
    setBusy(true);
    setStreamText('');
    const trace: TraceLine[] = [];
    const onTrace = (event: AgentTraceEvent) => {
      if (event.kind === 'tool_call') {
        trace.push({
          kind: 'call',
          text: `Kiểm tra: ${event.name}(${JSON.stringify(event.args)})`,
        });
      } else if (event.kind === 'tool_result') {
        trace.push({ kind: 'result', text: `${event.name} → ${event.summary}` });
      } else if (event.kind === 'note') {
        trace.push({ kind: 'note', text: event.text });
      }
    };
    try {
      const answer = await runAgent(question, provider, AGENT_TOOLS, onTrace, undefined, (delta) =>
        setStreamText((current) => current + delta),
      );
      setMessages((previous) => [
        ...previous,
        { id: nextId(), role: 'assistant', text: answer, trace },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'assistant',
          text: `Không xử lý được: ${error instanceof Error ? error.message : 'lỗi không rõ'}${provider.id === 'local' ? '. Model cục bộ đã chạy chưa? (ollama serve)' : ''}`,
        },
      ]);
    } finally {
      setStreamText('');
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (!open) return null;

  const greetName = account?.shortName ?? 'bạn';

  return (
    <aside className="neko-panel" role="complementary" aria-label="Neko — trợ lý lớp học">
      <header className="neko-panel-head">
        <span className="neko-mark" aria-hidden="true">
          ✦
        </span>
        <div>
          <strong>Neko</strong>
          <small>Trợ lý lớp học · dữ kiện từ hệ thống</small>
        </div>
        <button type="button" className="dock-close" onClick={onClose} aria-label="Đóng (Esc)">
          ✕
        </button>
      </header>

      <div className="neko-scroll" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="neko-hello">
            <h2>
              Chào {greetName} <span aria-hidden="true">👋</span>
            </h2>
            <p>
              Tôi nắm dữ liệu lớp 7A — hỏi tôi về nhóm cần giúp, từng học sinh, hay bài đã giao.
            </p>
            <div className="neko-chips" role="list">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  role="listitem"
                  type="button"
                  className="neko-chip"
                  onClick={() => void ask(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`neko-msg neko-msg--${message.role}`}>
            <p>{message.text}</p>
            {message.trace && message.trace.length > 0 ? (
              <details className="neko-sources">
                <summary>
                  Nguồn dữ kiện ({message.trace.filter((t) => t.kind === 'call').length})
                </summary>
                <ul>
                  {message.trace.map((line, index) => (
                    <li key={index} data-kind={line.kind}>
                      {line.text}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div className="neko-msg neko-msg--assistant">
            <p>{streamText || 'Đang kiểm tra dữ liệu lớp…'}</p>
          </div>
        ) : null}
        {progressNote ? <p className="neko-progress">{progressNote}</p> : null}
      </div>

      <form
        className="neko-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = input;
          setInput('');
          void ask(value);
        }}
      >
        <input
          ref={inputRef}
          autoComplete="off"
          disabled={busy}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Hỏi về lớp học…"
          aria-label="Câu hỏi cho Neko"
        />
        <button className="button-primary" type="submit" disabled={busy || !input.trim()}>
          Gửi
        </button>
      </form>

      <footer className="neko-foot">
        <label>
          Bộ não
          <select
            value={provider.id}
            onChange={(event) => void switchProvider(event.target.value)}
            aria-label="Chọn bộ não cho Neko"
          >
            <option value="rule">Cục bộ tức thời (không cần model)</option>
            <option value="local">Ollama trên máy (Gemma 3)</option>
            <option value="web">Gemma trong trình duyệt</option>
          </select>
        </label>
        <span className="muted">Mọi con số đều truy vết được về dữ liệu lớp.</span>
      </footer>
    </aside>
  );
}
