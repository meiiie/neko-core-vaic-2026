import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../app/session';
import { registerAgentSession } from '../services/agent/agent-lifecycle';
import {
  readChatGptStatus,
  startChatGptLogin,
  type ChatGptDeviceLogin,
  type ChatGptStatus,
} from '../services/agent/chatgpt-provider';
import type { AgentTraceEvent } from '../services/agent/loop';
import { AGENT_PROVIDERS } from '../services/agent/providers';
import {
  AgentSessionController,
  type AgentSessionSnapshot,
} from '../services/agent/session-controller';
import { AgentSessionStore } from '../services/agent/session-store';
import { AGENT_TOOLS } from '../services/agent/tools';
import { isWebLlmCached, setWebLlmProgressListener } from '../services/agent/webllm-provider';
import { db } from '../storage/db';

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

interface ProviderAvailability {
  readonly openai: boolean;
  readonly chatgpt: ChatGptStatus;
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

function displayMessages(snapshot: AgentSessionSnapshot): ChatMessage[] {
  return snapshot.messages.flatMap((message): ChatMessage[] => {
    if (message.role === 'user') return [{ id: nextId(), role: 'user', text: message.content }];
    if (message.role === 'assistant' && !message.toolName) {
      return [{ id: nextId(), role: 'assistant', text: message.content }];
    }
    return [];
  });
}

export function NekoDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [controllerReady, setControllerReady] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [providerId, setProviderId] = useState('rule');
  const [availability, setAvailability] = useState<ProviderAvailability>({
    openai: false,
    chatgpt: { available: false, authenticated: false },
  });
  const [deviceLogin, setDeviceLogin] = useState<ChatGptDeviceLogin | null>(null);
  const controllerRef = useRef<AgentSessionController | null>(null);
  const stoppedRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useMemo(() => new AgentSessionStore(db), []);
  const provider =
    AGENT_PROVIDERS.find((candidate) => candidate.id === providerId) ?? AGENT_PROVIDERS[0];

  useEffect(() => {
    const log = logRef.current;
    if (log && typeof log.scrollTo === 'function') {
      log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, streamText]);

  useEffect(() => {
    setWebLlmProgressListener(({ progress }) => {
      setProgressNote(`Đang nạp Gemma trong trình duyệt… ${Math.round(progress * 100)}%`);
      if (progress >= 1) setProgressNote(null);
    });
    return () => setWebLlmProgressListener(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let openai = false;
      try {
        const response = await fetch('/api/ai/providers', { credentials: 'include' });
        if (response.ok) {
          const body = (await response.json()) as {
            providers: { id: string; available: boolean }[];
          };
          openai = body.providers.find((item) => item.id === 'openai')?.available ?? false;
        }
      } catch {
        // Remote providers remain unavailable; offline providers still work.
      }
      let chatgpt: ChatGptStatus = { available: false, authenticated: false };
      try {
        chatgpt = await readChatGptStatus();
      } catch {
        // Optional local/self-hosted provider.
      }
      if (!cancelled) setAvailability({ openai, chatgpt });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      unregister();
      if (controllerRef.current === controller) controllerRef.current = null;
      controller?.abort('scope changed');
      void controller?.dispose();
    };
  }, [account?.id, provider, store]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function refreshChatGpt(): Promise<boolean> {
    try {
      const chatgpt = await readChatGptStatus();
      setAvailability((current) => ({ ...current, chatgpt }));
      if (chatgpt.authenticated) {
        setDeviceLogin(null);
        setProviderId('chatgpt');
        return true;
      }
    } catch {
      // The message below is more useful than a raw transport error.
    }
    setProgressNote('ChatGPT chưa xác nhận đăng nhập. Hoàn tất mã thiết bị rồi kiểm tra lại.');
    return false;
  }

  async function switchProvider(id: string) {
    if (busy) controllerRef.current?.abort('provider switched');
    if (id === 'web' && !(await isWebLlmCached())) {
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: 'assistant',
          text: 'Gemma chưa được tải đủ. Vào «Dữ liệu & ngoại tuyến» để tải trước khi chọn chế độ này.',
        },
      ]);
      return;
    }
    if (id === 'openai' && !availability.openai) {
      setProgressNote('OpenAI Responses chưa được cấu hình ở máy chủ.');
      return;
    }
    if (id === 'chatgpt' && !availability.chatgpt.authenticated) {
      try {
        const login = await startChatGptLogin();
        setDeviceLogin(login);
        setProgressNote(null);
      } catch (error) {
        setProgressNote(
          error instanceof Error ? error.message : 'Không mở được đăng nhập ChatGPT.',
        );
      }
      return;
    }
    setProgressNote(null);
    setProviderId(id);
  }

  async function ask(raw: string) {
    const question = raw.trim();
    const controller = controllerRef.current;
    if (!question || busy || !controller) return;
    setMessages((previous) => [...previous, { id: nextId(), role: 'user', text: question }]);
    setBusy(true);
    stoppedRef.current = false;
    setStreamText('');
    const trace: TraceLine[] = [];
    const beforeCompactions = controller.snapshot().compactionCount;
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
      const result = await controller.run(question, {
        onTrace,
        onDelta: (delta) => setStreamText((current) => current + delta),
      });
      const snapshot = controller.snapshot();
      if (snapshot.compactionCount > beforeCompactions) {
        trace.push({
          kind: 'note',
          text: `Đã nén ngữ cảnh theo ngân sách token (lần ${snapshot.compactionCount}); không xóa theo số lượt.`,
        });
      }
      await store.save(snapshot, provider.id).catch(() => undefined);
      setMessages((previous) => [
        ...previous,
        { id: nextId(), role: 'assistant', text: result.text, trace },
      ]);
    } catch (error) {
      if (stoppedRef.current) {
        setMessages((previous) => [
          ...previous,
          { id: nextId(), role: 'assistant', text: 'Đã dừng lượt đang xử lý.' },
        ]);
      } else {
        setMessages((previous) => [
          ...previous,
          {
            id: nextId(),
            role: 'assistant',
            text: `Không xử lý được: ${error instanceof Error ? error.message : 'lỗi không rõ'}${provider.id === 'local' ? '. Ollama đã chạy chưa? (ollama serve)' : ''}`,
          },
        ]);
      }
    } finally {
      setStreamText('');
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function stop(): void {
    stoppedRef.current = true;
    controllerRef.current?.abort('user stopped');
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
            {message.trace && message.trace.length > 0 ? (
              <details className="neko-sources">
                <summary>
                  Nguồn dữ kiện ({message.trace.filter((item) => item.kind === 'call').length})
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

      {deviceLogin ? (
        <div className="neko-login" role="status">
          <span>
            Mở{' '}
            <a href={deviceLogin.verificationUrl} target="_blank" rel="noreferrer">
              trang xác nhận ChatGPT
            </a>{' '}
            và nhập mã <strong>{deviceLogin.userCode}</strong>.
          </span>
          <button type="button" className="button-secondary" onClick={() => void refreshChatGpt()}>
            Kiểm tra lại
          </button>
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
          Bộ não
          <select
            value={providerId}
            onChange={(event) => void switchProvider(event.target.value)}
            aria-label="Chọn bộ não cho Neko"
          >
            <option value="rule">Cục bộ tức thời</option>
            <option value="local">Ollama trên máy</option>
            <option value="web">Gemma trong trình duyệt</option>
            <option value="openai" disabled={!availability.openai}>
              OpenAI Responses{availability.openai ? '' : ' (chưa cấu hình)'}
            </option>
            <option value="chatgpt" disabled={!availability.chatgpt.available}>
              ChatGPT
              {availability.chatgpt.authenticated
                ? ' (đã đăng nhập)'
                : availability.chatgpt.available
                  ? ' (cần đăng nhập)'
                  : ' (local mode tắt)'}
            </option>
          </select>
        </label>
        <span className="muted">Mọi con số đều truy vết được về dữ liệu lớp.</span>
      </footer>
    </aside>
  );
}
