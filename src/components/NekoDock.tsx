import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../app/session';
import { registerAgentSession } from '../services/agent/agent-lifecycle';
import {
  readChatGptStatus,
  startChatGptLogin,
  type ChatGptBrowserLogin,
  type ChatGptStatus,
} from '../services/agent/chatgpt-provider';
import {
  GenerationTelemetry,
  type GenerationMetrics,
} from '../services/agent/generation-telemetry';
import type { AgentTraceEvent } from '../services/agent/loop';
import { AGENT_PROVIDERS, CHATGPT_PROVIDER } from '../services/agent/providers';
import {
  AgentSessionController,
  type AgentSessionSnapshot,
} from '../services/agent/session-controller';
import { AgentSessionStore } from '../services/agent/session-store';
import { AGENT_TOOLS } from '../services/agent/tools';
import { setWebLlmProgressListener } from '../services/agent/webllm-provider';
import { db } from '../storage/db';

interface TraceLine {
  readonly kind: 'source' | 'note';
  readonly text: string;
}

interface ChatMessage {
  readonly id: number;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly trace?: readonly TraceLine[];
  readonly metrics?: GenerationMetrics;
  readonly fallback?: boolean;
}

const SUGGESTIONS = [
  'Hôm nay nên dạy lại gì cho lớp?',
  'Chẩn đoán của bạn An thế nào?',
  'Tiến độ các bài đã giao?',
];

const TOOL_LABELS: Readonly<Record<string, string>> = {
  tong_quan_lop: 'Tổng quan lớp',
  chan_doan_hoc_sinh: 'Hồ sơ học sinh',
  giai_thich_kien_thuc: 'Bản đồ kiến thức',
  bai_duoc_giao: 'Bài đã giao',
};

let messageId = 0;
function nextId(): number {
  messageId += 1;
  return messageId;
}

function displayMessages(snapshot: AgentSessionSnapshot): ChatMessage[] {
  return snapshot.messages.flatMap((message): ChatMessage[] => {
    if (message.role === 'user') return [{ id: nextId(), role: 'user', text: message.content }];
    if (message.role === 'assistant' && !message.toolName) {
      return [{ id: nextId(), role: 'assistant', text: message.content }];
    }
    return [];
  });
}

function duration(value: number): string {
  return value < 1_000 ? `${Math.round(value)} ms` : `${(value / 1_000).toFixed(1)} s`;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function Metrics({ metrics, fallback }: { metrics: GenerationMetrics; fallback?: boolean }) {
  const compact = fallback
    ? `Dự phòng cục bộ · Tổng ${duration(metrics.totalMs)}`
    : [
        metrics.ttftMs === null ? null : `TTFT ${duration(metrics.ttftMs)}`,
        metrics.tokensPerSecond === null ? null : `${metrics.tokensPerSecond.toFixed(1)} tok/s`,
        `Tổng ${duration(metrics.totalMs)}`,
      ]
        .filter(Boolean)
        .join(' · ');
  return (
    <div className="neko-metrics">
      <span>{compact}</span>
      {!fallback && metrics.outputTokens !== null ? (
        <details>
          <summary>Chi tiết</summary>
          <dl>
            <div>
              <dt>Token đầu hiển thị</dt>
              <dd>{metrics.firstFlushMs === null ? '—' : duration(metrics.firstFlushMs)}</dd>
            </div>
            <div>
              <dt>Token đầu ra</dt>
              <dd>{metrics.outputTokens}</dd>
            </div>
            <div>
              <dt>TPOT</dt>
              <dd>{metrics.tpotMs === null ? '—' : duration(metrics.tpotMs)}</dd>
            </div>
            <div>
              <dt>ITL p50 / p99 / max</dt>
              <dd>
                {metrics.interTokenLatencyMs
                  ? `${duration(metrics.interTokenLatencyMs.p50)} / ${duration(metrics.interTokenLatencyMs.p99)} / ${duration(metrics.interTokenLatencyMs.max)}`
                  : '—'}
              </dd>
            </div>
          </dl>
        </details>
      ) : null}
    </div>
  );
}

export function NekoDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [controllerReady, setControllerReady] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [providerId, setProviderId] = useState('local');
  const [chatGpt, setChatGpt] = useState<ChatGptStatus>({
    available: false,
    authenticated: false,
  });
  const [chatGptModel, setChatGptModel] = useState('');
  const [browserLogin, setBrowserLogin] = useState<ChatGptBrowserLogin | null>(null);
  const controllerRef = useRef<AgentSessionController | null>(null);
  const turnGenerationRef = useRef(0);
  const stoppedByUserRef = useRef(false);
  const bufferedTextRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useMemo(() => new AgentSessionStore(db), []);
  const provider =
    AGENT_PROVIDERS.find((candidate) => candidate.id === providerId) ?? AGENT_PROVIDERS[0];

  const applyChatGptStatus = useCallback((status: ChatGptStatus): void => {
    setChatGpt(status);
    setChatGptModel((current) => {
      const models = status.models ?? [];
      const next =
        models.find((model) => model.model === current)?.model ??
        status.defaultModel ??
        models[0]?.model ??
        '';
      CHATGPT_PROVIDER.setModel(next || null);
      return next;
    });
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (!log || typeof log.scrollTo !== 'function') return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    log.scrollTo({
      top: log.scrollHeight,
      behavior: busy || reduceMotion ? 'auto' : 'smooth',
    });
  }, [busy, messages, streamText]);

  useEffect(() => {
    setWebLlmProgressListener(({ progress }) => {
      setActivity(`Đang tải Gemma trên thiết bị… ${Math.round(progress * 100)}%`);
      if (progress >= 1) setActivity('Gemma đã sẵn sàng trên thiết bị.');
    });
    return () => setWebLlmProgressListener(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readChatGptStatus()
      .then((status) => {
        if (!cancelled) applyChatGptStatus(status);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applyChatGptStatus]);

  useEffect(() => {
    const accountId = account?.id;
    if (!accountId) return;
    let cancelled = false;
    let controller: AgentSessionController | null = null;
    let unregister: () => void = () => undefined;
    setControllerReady(false);
    setMessages([]);
    void (async () => {
      const next = new AgentSessionController({
        provider,
        tools: AGENT_TOOLS,
        scope: { accountId, role: 'teacher', classId: '7A' },
      });
      const saved = await store
        .load({ accountId, role: 'teacher', classId: '7A' }, provider.id)
        .catch(() => null);
      if (saved) {
        try {
          next.restore(saved);
        } catch {
          await store
            .remove({ accountId, role: 'teacher', classId: '7A' }, provider.id)
            .catch(() => undefined);
        }
      }
      if (cancelled) {
        await next.dispose();
        return;
      }
      controller = next;
      controllerRef.current = next;
      unregister = registerAgentSession(accountId, next);
      if (saved) setMessages(displayMessages(next.snapshot()));
      setControllerReady(true);
    })();
    return () => {
      cancelled = true;
      turnGenerationRef.current += 1;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      bufferedTextRef.current = '';
      unregister();
      if (controllerRef.current === controller) controllerRef.current = null;
      controller?.abort('scope changed');
      void controller?.dispose();
    };
  }, [account?.id, provider, store]);

  useEffect(() => {
    if (!open) {
      turnGenerationRef.current += 1;
      controllerRef.current?.abort('dock closed');
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      bufferedTextRef.current = '';
      setStreamText('');
      setBusy(false);
      return;
    }
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function refreshChatGpt(): Promise<boolean> {
    try {
      const status = await readChatGptStatus();
      applyChatGptStatus(status);
      if (status.authenticated) {
        setBrowserLogin(null);
        setActivity('ChatGPT đã kết nối.');
        setProviderId('chatgpt');
        return true;
      }
    } catch {
      // A concise status below is more useful than transport details.
    }
    setActivity('Chưa hoàn tất đăng nhập ChatGPT. Hãy hoàn tất trong cửa sổ vừa mở.');
    return false;
  }

  function abandonTurn(reason: string): void {
    turnGenerationRef.current += 1;
    stoppedByUserRef.current = false;
    controllerRef.current?.abort(reason);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    bufferedTextRef.current = '';
    setStreamText('');
    setBusy(false);
  }

  async function switchProvider(id: string): Promise<void> {
    if (busy) abandonTurn('provider switched');
    if (id === 'chatgpt' && !chatGpt.authenticated) {
      const popup = window.open('', '_blank');
      if (popup) popup.opener = null;
      setActivity('Đang tạo phiên đăng nhập ChatGPT…');
      try {
        const login = await startChatGptLogin();
        setBrowserLogin(login);
        if (popup && !popup.closed) popup.location.assign(login.authUrl);
        setActivity('Hoàn tất đăng nhập trong cửa sổ ChatGPT, rồi kiểm tra lại.');
      } catch (error) {
        popup?.close();
        setActivity(error instanceof Error ? error.message : 'Không thể mở đăng nhập ChatGPT.');
      }
      return;
    }
    setBrowserLogin(null);
    setActivity(id === 'web' ? 'Gemma sẽ được tải tại đây khi bạn gửi câu hỏi đầu tiên.' : null);
    setProviderId(id);
  }

  async function ask(raw: string): Promise<void> {
    const question = raw.trim();
    const controller = controllerRef.current;
    if (!question || busy || !controller) return;
    const generation = ++turnGenerationRef.current;
    const telemetry = new GenerationTelemetry();
    stoppedByUserRef.current = false;
    bufferedTextRef.current = '';
    setMessages((previous) => [...previous, { id: nextId(), role: 'user', text: question }]);
    setBusy(true);
    setStreamText('');
    setActivity('Đang chuẩn bị…');
    const trace: TraceLine[] = [];
    const beforeCompactions = controller.snapshot().compactionCount;
    const onTrace = (event: AgentTraceEvent) => {
      if (generation !== turnGenerationRef.current) return;
      if (event.kind === 'tool_call') {
        setActivity('Đang kiểm tra dữ liệu lớp…');
        trace.push({
          kind: 'source',
          text: `Kiểm tra ${TOOL_LABELS[event.name] ?? 'dữ liệu hệ thống'}`,
        });
      } else if (event.kind === 'tool_result') {
        trace.push({
          kind: event.ok ? 'source' : 'note',
          text: `${TOOL_LABELS[event.name] ?? 'Dữ liệu hệ thống'} · ${event.ok ? 'đã đối chiếu' : 'không khả dụng'}`,
        });
      } else if (event.kind === 'note') {
        trace.push({ kind: 'note', text: event.text });
      }
    };
    try {
      const result = await controller.run(question, {
        onTrace,
        onDelta: (delta) => {
          if (generation !== turnGenerationRef.current || stoppedByUserRef.current) return;
          telemetry.recordDelta();
          bufferedTextRef.current += delta;
          setActivity('Đang trả lời…');
          if (frameRef.current !== null) return;
          frameRef.current = window.requestAnimationFrame(() => {
            frameRef.current = null;
            if (generation !== turnGenerationRef.current || stoppedByUserRef.current) return;
            telemetry.recordFlush();
            setStreamText(bufferedTextRef.current);
          });
        },
      });
      if (generation !== turnGenerationRef.current || stoppedByUserRef.current) return;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      if (bufferedTextRef.current && !result.fallback) {
        telemetry.recordFlush();
        setStreamText(bufferedTextRef.current);
      }
      const snapshot = controller.snapshot();
      if (snapshot.compactionCount > beforeCompactions) {
        trace.push({
          kind: 'note',
          text: `Đã nén ngữ cảnh theo ngân sách token · lần ${snapshot.compactionCount}.`,
        });
      }
      await store.save(snapshot, provider.id).catch(() => undefined);
      if (generation !== turnGenerationRef.current) return;
      const metrics = telemetry.finish(result.displayUsage);
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'assistant',
          text: result.text,
          trace,
          metrics,
          fallback: result.fallback,
        },
      ]);
      setActivity(result.fallback ? 'Đã trả lời bằng dữ liệu cục bộ.' : null);
    } catch (error) {
      if (generation !== turnGenerationRef.current) return;
      if (stoppedByUserRef.current) {
        setMessages((previous) => [
          ...previous,
          { id: nextId(), role: 'assistant', text: 'Đã dừng lượt đang xử lý.' },
        ]);
        setActivity('Đã dừng.');
      } else if (!isAbortError(error)) {
        setMessages((previous) => [
          ...previous,
          {
            id: nextId(),
            role: 'assistant',
            text: `Không thể xử lý: ${error instanceof Error ? error.message : 'lỗi không rõ'}`,
          },
        ]);
        setActivity('Có lỗi khi xử lý.');
      }
    } finally {
      if (generation === turnGenerationRef.current) {
        if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        bufferedTextRef.current = '';
        setStreamText('');
        setBusy(false);
        inputRef.current?.focus();
      }
    }
  }

  function stop(): void {
    stoppedByUserRef.current = true;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    bufferedTextRef.current = '';
    setStreamText('');
    controllerRef.current?.abort(new DOMException('Stopped', 'AbortError'));
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
          <small>Trợ lý lớp học · dựa trên dữ liệu hệ thống</small>
        </div>
        <button type="button" className="dock-close" onClick={onClose} aria-label="Đóng (Esc)">
          ×
        </button>
      </header>

      <div className="neko-scroll" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="neko-hello">
            <h2>Chào {greetName}</h2>
            <p>Hỏi về lớp 7A, từng học sinh hoặc bài đã giao.</p>
            <div className="neko-chips">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
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
            {message.metrics ? (
              <Metrics metrics={message.metrics} fallback={message.fallback} />
            ) : null}
            {message.trace && message.trace.length > 0 ? (
              <details className="neko-sources">
                <summary>Nguồn dữ liệu</summary>
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
          <div className="neko-msg neko-msg--assistant neko-msg--live">
            <p>{streamText || activity || 'Đang kiểm tra dữ liệu lớp…'}</p>
          </div>
        ) : null}
        {!busy && activity ? (
          <p className="neko-progress" role="status">
            {activity}
          </p>
        ) : null}
      </div>

      {browserLogin ? (
        <div className="neko-login" role="status">
          <span>Phiên đăng nhập ChatGPT đang chờ hoàn tất.</span>
          <div>
            <a href={browserLogin.authUrl} target="_blank" rel="noreferrer">
              Mở lại trang đăng nhập
            </a>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void refreshChatGpt()}
            >
              Kiểm tra đăng nhập
            </button>
          </div>
        </div>
      ) : null}

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
          disabled={busy || !controllerReady}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Hỏi về lớp học…"
          aria-label="Câu hỏi cho Neko"
        />
        {busy ? (
          <button className="button-secondary" type="button" onClick={stop}>
            Dừng
          </button>
        ) : (
          <button
            className="button-primary"
            type="submit"
            disabled={!controllerReady || !input.trim()}
          >
            Gửi
          </button>
        )}
      </form>

      <footer className="neko-foot">
        <label>
          <span>Nguồn AI</span>
          <select
            value={providerId}
            onChange={(event) => void switchProvider(event.target.value)}
            aria-label="Chọn nguồn AI cho Neko"
          >
            <option value="local">Local · Ollama</option>
            <option value="web">Gemma · trên thiết bị</option>
            <option value="chatgpt">ChatGPT{chatGpt.authenticated ? ' · đã kết nối' : ''}</option>
          </select>
        </label>
        {providerId === 'chatgpt' && chatGpt.authenticated && (chatGpt.models?.length ?? 0) > 0 ? (
          <label>
            <span>Mô hình ChatGPT</span>
            <select
              value={chatGptModel}
              onChange={(event) => {
                const model = event.target.value;
                setChatGptModel(model);
                CHATGPT_PROVIDER.setModel(model);
                setActivity(`Đã chọn ${event.target.selectedOptions[0]?.textContent ?? model}.`);
              }}
              aria-label="Chọn mô hình ChatGPT"
            >
              {chatGpt.models?.map((model) => (
                <option key={model.id} value={model.model} title={model.description}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </footer>
    </aside>
  );
}
