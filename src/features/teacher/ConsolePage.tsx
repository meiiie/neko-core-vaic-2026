import { useEffect, useRef, useState } from 'react';
import { runAgent, type AgentProvider, type AgentTraceEvent } from '../../services/agent/loop';
import { AGENT_PROVIDERS } from '../../services/agent/providers';
import { AGENT_TOOLS, toolByName } from '../../services/agent/tools';

interface ConsoleLine {
  readonly id: number;
  readonly type: 'input' | 'trace' | 'result' | 'answer' | 'error' | 'info';
  readonly text: string;
}

const BANNER = [
  'NekoCore Console — trợ lý lớp học (thử nghiệm)',
  'Mọi con số đều đến từ công cụ deterministic; model chỉ diễn đạt.',
  'Gõ /help để xem lệnh, hoặc hỏi tự nhiên: "Chẩn đoán của bạn An?"',
];

const HELP_TEXT = [
  '/lop            — tổng quan lớp (nhóm, ưu tiên, lỗ hổng)',
  '/hocsinh <id>   — chẩn đoán an | binh | chi | minh',
  '/kc <mã>        — vị trí kiến thức trong đồ thị, vd /kc K02',
  '/baigiao        — bài đã giao và tiến độ nộp (cần mạng)',
  '/model <id>     — đổi bộ não: rule | local (Ollama/Gemma)',
  '/clear          — xóa màn hình',
  'Câu hỏi tự nhiên sẽ chạy vòng lặp agent: gọi công cụ → quan sát → trả lời.',
];

let lineId = 0;
function line(type: ConsoleLine['type'], text: string): ConsoleLine {
  lineId += 1;
  return { id: lineId, type, text };
}

export function ConsolePage() {
  const [lines, setLines] = useState<ConsoleLine[]>(BANNER.map((text) => line('info', text)));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<AgentProvider>(AGENT_PROVIDERS[0]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  function append(...next: ConsoleLine[]) {
    setLines((previous) => [...previous, ...next]);
  }

  function onTrace(event: AgentTraceEvent) {
    if (event.kind === 'tool_call') {
      append(line('trace', `→ gọi ${event.name}(${JSON.stringify(event.args)})`));
    } else if (event.kind === 'tool_result') {
      append(line(event.ok ? 'result' : 'error', `← ${event.name}: ${event.summary}`));
    } else if (event.kind === 'answer') {
      append(line('answer', event.text));
    } else {
      append(line('info', event.text));
    }
  }

  async function runTool(name: string, args: Record<string, string>) {
    const tool = toolByName(name);
    if (!tool) {
      append(line('error', `Không có công cụ ${name}.`));
      return;
    }
    append(line('trace', `→ gọi ${name}(${JSON.stringify(args)})`));
    const result = await tool.run(args);
    append(
      line(
        result.ok ? 'result' : 'error',
        result.ok ? `← ${JSON.stringify(result.data)}` : `← ${result.error}`,
      ),
    );
  }

  async function execute(raw: string) {
    const command = raw.trim();
    if (!command) return;
    append(line('input', `neko> ${command}`));
    setHistory((previous) => [command, ...previous].slice(0, 50));
    setHistoryIndex(-1);
    setBusy(true);
    try {
      if (command === '/clear') {
        setLines([]);
      } else if (command === '/help') {
        append(...HELP_TEXT.map((text) => line('info', text)));
      } else if (command === '/lop') {
        await runTool('tong_quan_lop', {});
      } else if (command.startsWith('/hocsinh')) {
        await runTool('chan_doan_hoc_sinh', { hoc_sinh: command.split(/\s+/)[1] ?? '' });
      } else if (command.startsWith('/kc')) {
        await runTool('giai_thich_kien_thuc', { kc: command.split(/\s+/)[1] ?? '' });
      } else if (command === '/baigiao') {
        await runTool('bai_duoc_giao', {});
      } else if (command.startsWith('/model')) {
        const requested = command.split(/\s+/)[1];
        const next = AGENT_PROVIDERS.find((candidate) => candidate.id === requested);
        if (next) {
          setProvider(next);
          append(line('info', `Đã chuyển bộ não: ${next.label}`));
        } else {
          append(
            line(
              'info',
              `Bộ não hiện tại: ${provider.label}. Khả dụng: ${AGENT_PROVIDERS.map((p) => p.id).join(', ')}`,
            ),
          );
        }
      } else if (command.startsWith('/')) {
        append(line('error', `Lệnh không hợp lệ: ${command}. Gõ /help.`));
      } else {
        await runAgent(command, provider, AGENT_TOOLS, onTrace);
      }
    } catch (error) {
      append(
        line(
          'error',
          `Lỗi: ${error instanceof Error ? error.message : 'không rõ'}${provider.id === 'local' ? ' — model cục bộ đã chạy chưa? (ollama serve)' : ''}`,
        ),
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(historyIndex + 1, history.length - 1);
      if (history[next] !== undefined) {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next >= 0 ? (history[next] ?? '') : '');
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Thử nghiệm</p>
        <h1>Neko Console</h1>
        <p>
          Trợ lý lớp học kiểu terminal: hỏi tự nhiên hoặc dùng lệnh. Bộ não hiện tại:{' '}
          <strong>{provider.label}</strong>. Mọi số liệu lấy từ công cụ deterministic — model không
          được phép bịa.
        </p>
      </header>

      <section className="neko-console" aria-label="Neko Console">
        <div className="console-titlebar" aria-hidden="true">
          <span className="console-dot" />
          <span className="console-dot" />
          <span className="console-dot" />
          <span className="console-title">neko@7a — trợ lý lớp học</span>
        </div>
        <div className="console-log" ref={logRef} role="log" aria-live="polite">
          {lines.map((entry) => (
            <p key={entry.id} className={`console-line console-line--${entry.type}`}>
              {entry.text}
            </p>
          ))}
          {busy ? <p className="console-line console-line--info">…</p> : null}
        </div>
        <form
          className="console-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = input;
            setInput('');
            void execute(value);
          }}
        >
          <label className="console-prompt" htmlFor="console-input">
            neko&gt;
          </label>
          <input
            id="console-input"
            ref={inputRef}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder='thử: "Hôm nay nên dạy lại gì?" hoặc /help'
          />
          <button className="button-primary" type="submit" disabled={busy || !input.trim()}>
            Chạy
          </button>
        </form>
      </section>

      <p className="muted">
        Console chỉ đọc dữ liệu (không sửa điểm, không đổi nhóm). Bộ não «local» trỏ vào
        Ollama/Gemma trên máy — cùng cổng OpenAI-compatible với WebLLM chạy ngay trong trình duyệt.
      </p>
    </div>
  );
}
