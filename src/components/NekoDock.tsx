import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../app/session';
import { registerAgentSession } from '../services/agent/agent-lifecycle';
import {
  completeChatGptLogin,
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
import { AGENT_TOOLS, type AgentTool } from '../services/agent/tools';
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

interface PendingApproval {
  readonly tool: AgentTool;
  readonly args: Readonly<Record<string, unknown>>;
  readonly resolve: (approved: boolean) => void;
}

interface SessionNotice {
  readonly kind: 'info' | 'warning';
  readonly text: string;
}

const SUGGESTIONS = [
  'Hôm nay nên dạy lại gì cho lớp?',
  'Chẩn đoán của bạn An thế nào?',
  'Sinh biến thể câu hỏi cho K02',
];

const TOOL_LABELS: Readonly<Record<string, string>> = {
  tong_quan_lop: 'Tổng quan lớp',
  chan_doan_hoc_sinh: 'Hồ sơ học sinh',
  giai_thich_kien_thuc: 'Bản đồ kiến thức',
  bai_duoc_giao: 'Bài đã giao',
  de_xuat_bai_tap: 'Đề xuất bài tập',
  sinh_bien_the_bai_tap: 'Sinh biến thể bài tập',
  giao_bai: 'Giao bài cho lớp',
};

const TOOL_ERROR_LABELS: Readonly<Record<string, string>> = {
  TOOL_TIMEOUT: 'quá thời gian',
  TOOL_ABORTED: 'đã dừng',
  TOOL_DENIED: 'không được xác nhận',
  TOOL_APPROVAL_REQUIRED: 'cần xác nhận',
  INVALID_TOOL_ARGS: 'yêu cầu chưa hợp lệ',
  TOOL_NOT_ALLOWED: 'không được phép trong phiên',
  TOOL_ERROR: 'không khả dụng',
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

function toolContext(name: string, args: Readonly<Record<string, unknown>>): string {
  if (name === 'chan_doan_hoc_sinh' && typeof args.hoc_sinh === 'string') {
    return ` · ${args.hoc_sinh.slice(0, 80)}`;
  }
  if (name === 'giai_thich_kien_thuc' && typeof args.kc === 'string') {
    return ` · ${args.kc.slice(0, 16)}`;
  }
  if (name === 'giao_bai' && typeof args.title === 'string') {
    return ` · ${args.title.slice(0, 80)}`;
  }
  return '';
}

function draftStorageKey(accountId: string): string {
  return `nekopath:neko-draft:${encodeURIComponent(accountId)}`;
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

function isReachableTabStop(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  const closedDisclosure = element.closest<HTMLDetailsElement>('details:not([open])');
  return (
    !closedDisclosure ||
    (element.tagName === 'SUMMARY' && element.parentElement === closedDisclosure)
  );
}

export function NekoDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyElapsed, setBusyElapsed] = useState(0);
  const [controllerReady, setControllerReady] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [liveTrace, setLiveTrace] = useState<TraceLine[]>([]);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [providerId, setProviderId] = useState('local');
  const [chatGpt, setChatGpt] = useState<ChatGptStatus>({
    available: false,
    authenticated: false,
  });
  const [chatGptModel, setChatGptModel] = useState('');
  const [browserLogin, setBrowserLogin] = useState<ChatGptBrowserLogin | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [completingLogin, setCompletingLogin] = useState(false);
  const [mobileModal, setMobileModal] = useState(false);
  const controllerRef = useRef<AgentSessionController | null>(null);
  const turnGenerationRef = useRef(0);
  const stoppedByUserRef = useRef(false);
  const skipQueueDrainRef = useRef(false);
  const busyRef = useRef(false);
  const queuedPromptsRef = useRef<string[]>([]);
  const bufferedTextRef = useRef('');
  const frameRef = useRef<number | null>(null);
  const turnStartedAtRef = useRef(0);
  const approvalRef = useRef<PendingApproval | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const store = useMemo(() => new AgentSessionStore(db), []);
  const provider =
    AGENT_PROVIDERS.find((candidate) => candidate.id === providerId) ?? AGENT_PROVIDERS[0];
  const providerLabel =
    providerId === 'local'
      ? 'Tự động · ưu tiên cục bộ'
      : providerId === 'web'
        ? 'Gemma · trên thiết bị'
        : (chatGpt.models?.find((model) => model.model === chatGptModel)?.displayName ?? 'ChatGPT');

  const replaceQueuedPrompts = useCallback((next: string[]): void => {
    queuedPromptsRef.current = next;
    setQueuedPrompts(next);
  }, []);

  useEffect(() => {
    const accountId = account?.id;
    setDraftReady(false);
    replaceQueuedPrompts([]);
    if (!accountId) {
      setInput('');
      return;
    }
    try {
      setInput(window.sessionStorage.getItem(draftStorageKey(accountId)) ?? '');
    } catch {
      setInput('');
    }
    setDraftReady(true);
  }, [account?.id, replaceQueuedPrompts]);

  useEffect(() => {
    const accountId = account?.id;
    if (!accountId || !draftReady) return;
    try {
      if (input) window.sessionStorage.setItem(draftStorageKey(accountId), input);
      else window.sessionStorage.removeItem(draftStorageKey(accountId));
    } catch {
      // The draft remains in React state when browser storage is unavailable.
    }
  }, [account?.id, draftReady, input]);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 136)}px`;
  }, [input]);

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 34rem)');
    if (!media) return;
    const update = () => setMobileModal(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open || !mobileModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileModal, open]);

  useEffect(() => {
    if (!open) return;
    if (controllerReady) inputRef.current?.focus();
    else if (mobileModal) closeButtonRef.current?.focus();
  }, [controllerReady, mobileModal, open]);

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

  const stop = useCallback((): void => {
    if (!busyRef.current) return;
    stoppedByUserRef.current = true;
    skipQueueDrainRef.current = true;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    bufferedTextRef.current = '';
    approvalRef.current?.resolve(false);
    approvalRef.current = null;
    setApproval(null);
    setStreamText('');
    setAnnouncement('Đang dừng lượt hiện tại.');
    controllerRef.current?.abort(new DOMException('Stopped', 'AbortError'));
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
    if (!busy) return;
    const update = () =>
      setBusyElapsed(
        Math.max(0, Math.floor((performance.now() - turnStartedAtRef.current) / 1_000)),
      );
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [busy]);

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
    setSessionNotice(null);
    void (async () => {
      const next = new AgentSessionController({
        provider,
        tools: AGENT_TOOLS,
        scope: { accountId, role: 'teacher', classId: '7A' },
      });
      let saved: AgentSessionSnapshot | null = null;
      try {
        saved = await store.load({ accountId, role: 'teacher', classId: '7A' }, provider.id);
      } catch {
        if (!cancelled) {
          setSessionNotice({
            kind: 'warning',
            text: 'Không thể đọc phiên trước trên thiết bị. Bạn vẫn có thể bắt đầu phiên mới.',
          });
        }
      }
      if (saved) {
        try {
          next.restore(saved);
        } catch {
          saved = null;
          if (!cancelled) {
            setSessionNotice({
              kind: 'info',
              text: 'Neko đã bắt đầu phiên mới vì phiên cũ dùng hợp đồng dữ liệu khác.',
            });
          }
          try {
            await store.remove({ accountId, role: 'teacher', classId: '7A' }, provider.id);
          } catch {
            if (!cancelled) {
              setSessionNotice({
                kind: 'warning',
                text: 'Phiên cũ không hợp lệ và chưa thể dọn khỏi thiết bị.',
              });
            }
          }
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
      approvalRef.current?.resolve(false);
      approvalRef.current = null;
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
      skipQueueDrainRef.current = true;
      controllerRef.current?.abort('dock closed');
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      bufferedTextRef.current = '';
      setStreamText('');
      approvalRef.current?.resolve(false);
      approvalRef.current = null;
      setApproval(null);
      busyRef.current = false;
      setBusy(false);
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (busyRef.current) stop();
        else onClose();
        return;
      }
      if (event.key !== 'Tab' || !window.matchMedia?.('(max-width: 34rem)').matches) return;
      const panel = panelRef.current;
      if (!panel) return;
      const tabbable = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary',
        ),
      ].filter(isReachableTabStop);
      const first = tabbable[0];
      const last = tabbable.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, stop]);

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
    skipQueueDrainRef.current = true;
    controllerRef.current?.abort(reason);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    bufferedTextRef.current = '';
    approvalRef.current?.resolve(false);
    approvalRef.current = null;
    setApproval(null);
    setStreamText('');
    setLiveTrace([]);
    busyRef.current = false;
    setBusy(false);
  }

  async function switchProvider(id: string): Promise<void> {
    if (busyRef.current) abandonTurn('provider switched');
    if (id === 'chatgpt' && !chatGpt.available) {
      // Honest state instead of a raw CHATGPT_NOT_ENABLED code: the public
      // deployment keeps this provider off by policy (ops/RUNBOOK.md).
      setActivity(
        'ChatGPT chỉ bật trên bản tự vận hành của nhà trường. Trên bản công khai, cô dùng ' +
          '"Gemma · trên thiết bị" — chạy ngay trong trình duyệt, không gửi dữ liệu ra ngoài.',
      );
      return;
    }
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
        setActivity(
          error instanceof Error && error.message !== 'CHATGPT_NOT_ENABLED'
            ? error.message
            : 'Không thể mở đăng nhập ChatGPT trên bản này.',
        );
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
    if (!question || !controller) return;
    if (busyRef.current) {
      if (queuedPromptsRef.current.length >= 3) {
        setSessionNotice({
          kind: 'warning',
          text: 'Hàng đợi đã có 3 câu. Hãy chờ hoặc bỏ một câu trước khi thêm.',
        });
        setAnnouncement('Hàng đợi Neko đã đầy.');
        return;
      }
      replaceQueuedPrompts([...queuedPromptsRef.current, question]);
      setSessionNotice({
        kind: 'info',
        text: 'Đã xếp câu hỏi. Neko sẽ xử lý ngay sau lượt hiện tại.',
      });
      setAnnouncement('Đã xếp câu hỏi vào hàng đợi.');
      return;
    }
    const generation = ++turnGenerationRef.current;
    const telemetry = new GenerationTelemetry();
    stoppedByUserRef.current = false;
    skipQueueDrainRef.current = false;
    busyRef.current = true;
    bufferedTextRef.current = '';
    turnStartedAtRef.current = performance.now();
    setBusyElapsed(0);
    setMessages((previous) => [...previous, { id: nextId(), role: 'user', text: question }]);
    setBusy(true);
    setStreamText('');
    setLiveTrace([]);
    setSessionNotice((current) => (current?.kind === 'warning' ? current : null));
    const selectedChatGptModel = chatGpt.models?.find(
      (model) => model.model === chatGptModel,
    )?.displayName;
    setActivity(
      providerId === 'chatgpt'
        ? `Đang kết nối ${selectedChatGptModel ?? 'ChatGPT'}…`
        : 'Đang khởi động mô hình…',
    );
    const trace: TraceLine[] = [];
    const beforeCompactions = controller.snapshot().compactionCount;
    const onTrace = (event: AgentTraceEvent) => {
      if (generation !== turnGenerationRef.current) return;
      if (event.kind === 'step') {
        setActivity(
          event.index === 1
            ? 'Đang xác định dữ liệu cần kiểm tra…'
            : `Đang đối chiếu thêm dữ liệu · bước ${event.index}/${event.max}`,
        );
      } else if (event.kind === 'tool_call') {
        setActivity('Đang kiểm tra dữ liệu lớp…');
        trace.push({
          kind: 'source',
          text: `Kiểm tra ${TOOL_LABELS[event.name] ?? 'dữ liệu hệ thống'}${toolContext(event.name, event.args)}`,
        });
        setLiveTrace([...trace].slice(-4));
      } else if (event.kind === 'tool_result') {
        const resultLabel = event.ok
          ? 'đã đối chiếu'
          : (TOOL_ERROR_LABELS[event.errorCode ?? ''] ?? 'không khả dụng');
        trace.push({
          kind: event.ok ? 'source' : 'note',
          text: `${TOOL_LABELS[event.name] ?? 'Dữ liệu hệ thống'} · ${resultLabel} · ${duration(event.durationMs)}`,
        });
        setLiveTrace([...trace].slice(-4));
      } else if (event.kind === 'note') {
        trace.push({ kind: 'note', text: event.text });
        setLiveTrace([...trace].slice(-4));
      }
    };
    try {
      const result = await controller.run(question, {
        onTrace,
        approveTool: (tool, args) =>
          new Promise<boolean>((resolve) => {
            if (generation !== turnGenerationRef.current || stoppedByUserRef.current) {
              resolve(false);
              return;
            }
            approvalRef.current?.resolve(false);
            const pending = { tool, args, resolve };
            approvalRef.current = pending;
            setApproval(pending);
            setActivity('Cần giáo viên xác nhận trước khi thay đổi dữ liệu.');
          }),
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
      try {
        await store.save(snapshot, provider.id);
        setSessionNotice(null);
      } catch {
        setSessionNotice({
          kind: 'warning',
          text: 'Neko đã trả lời nhưng chưa lưu được phiên trên thiết bị.',
        });
      }
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
      setActivity(null);
      setAnnouncement('Neko đã trả lời.');
    } catch (error) {
      if (generation !== turnGenerationRef.current) return;
      if (stoppedByUserRef.current) {
        setMessages((previous) => [
          ...previous,
          { id: nextId(), role: 'assistant', text: 'Đã dừng lượt đang xử lý.' },
        ]);
        setActivity('Đã dừng.');
        setAnnouncement('Đã dừng lượt hiện tại.');
      } else if (!isAbortError(error)) {
        skipQueueDrainRef.current = true;
        setMessages((previous) => [
          ...previous,
          {
            id: nextId(),
            role: 'assistant',
            text: `Không thể xử lý: ${error instanceof Error ? error.message : 'lỗi không rõ'}`,
          },
        ]);
        setActivity('Có lỗi khi xử lý.');
        setAnnouncement('Neko gặp lỗi khi xử lý.');
      }
    } finally {
      if (generation === turnGenerationRef.current) {
        approvalRef.current?.resolve(false);
        approvalRef.current = null;
        setApproval(null);
        if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        bufferedTextRef.current = '';
        setStreamText('');
        setLiveTrace([]);
        busyRef.current = false;
        setBusy(false);
        inputRef.current?.focus();
        if (!skipQueueDrainRef.current && queuedPromptsRef.current.length > 0) {
          window.setTimeout(runNextQueued, 0);
        }
      }
    }
  }

  function runNextQueued(): void {
    if (busyRef.current || queuedPromptsRef.current.length === 0) return;
    const [next, ...remaining] = queuedPromptsRef.current;
    replaceQueuedPrompts(remaining);
    void ask(next);
  }

  if (!open) return null;
  const greetName = account?.shortName ?? 'bạn';

  return (
    <aside
      ref={panelRef}
      className="neko-panel"
      role={mobileModal ? 'dialog' : 'complementary'}
      aria-modal={mobileModal || undefined}
      aria-label="Neko — trợ lý lớp học"
    >
      <header className="neko-panel-head">
        <span className="neko-mark" aria-hidden="true">
          ✦
        </span>
        <div>
          <strong>Neko</strong>
          <small>Lớp 7A · dữ liệu hệ thống là nguồn sự thật</small>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="dock-close"
          onClick={onClose}
          aria-label="Đóng (Esc)"
        >
          ×
        </button>
      </header>

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div
        className="neko-scroll"
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) inputRef.current?.focus();
        }}
      >
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
            <span className="neko-role">{message.role === 'user' ? 'Bạn' : 'Neko'}</span>
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
            <div className="neko-live-status">
              <span className="neko-pulse" aria-hidden="true" />
              <span role="status" aria-live="polite" aria-atomic="true">
                {activity || 'Đang kiểm tra dữ liệu lớp…'}
              </span>
              {busyElapsed > 0 ? <time>{busyElapsed}s</time> : null}
            </div>
            {liveTrace.length > 0 ? (
              <ul className="neko-live-trace" aria-label="Các bước vừa thực hiện">
                {liveTrace.map((line, index) => (
                  <li key={`${line.text}-${index}`} data-kind={line.kind}>
                    {line.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {streamText ? <p className="neko-stream-text">{streamText}</p> : null}
          </div>
        ) : null}
        {approval ? (
          <section className="neko-approval" aria-labelledby="neko-approval-title">
            <p className="eyebrow">Xác nhận thao tác</p>
            <h3 id="neko-approval-title">
              {typeof approval.args.title === 'string'
                ? approval.args.title
                : TOOL_LABELS[approval.tool.name]}
            </h3>
            <p>
              Giao{' '}
              {Array.isArray(approval.args.question_ids) ? approval.args.question_ids.length : 0}{' '}
              câu cho lớp 7A
              {typeof approval.args.due_at === 'string'
                ? ` · hạn ${new Date(approval.args.due_at).toLocaleString('vi-VN')}`
                : ' · không đặt hạn'}
              .
            </p>
            <div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  const pending = approvalRef.current;
                  approvalRef.current = null;
                  setApproval(null);
                  setActivity('Đã hủy thao tác giao bài.');
                  pending?.resolve(false);
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  const pending = approvalRef.current;
                  approvalRef.current = null;
                  setApproval(null);
                  setActivity('Đang giao bài cho lớp…');
                  pending?.resolve(true);
                }}
              >
                Xác nhận giao bài
              </button>
            </div>
          </section>
        ) : null}
        {!busy && activity ? (
          <p className="neko-progress" role="status">
            {activity}
          </p>
        ) : null}
      </div>

      {sessionNotice ? (
        <p
          className="neko-notice"
          data-kind={sessionNotice.kind}
          role={sessionNotice.kind === 'warning' ? 'alert' : 'status'}
        >
          {sessionNotice.text}
        </p>
      ) : null}

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
          <p className="neko-login-hint">
            Sau khi đăng nhập, trình duyệt sẽ mở một trang <strong>localhost báo lỗi</strong> — đó
            là bước cuối bình thường. Hãy sao chép địa chỉ của trang đó và dán vào đây:
          </p>
          <div className="neko-login-complete">
            <input
              value={callbackUrl}
              placeholder="http://localhost:1455/auth/callback?code=…"
              aria-label="Địa chỉ trang localhost sau đăng nhập"
              onChange={(event) => setCallbackUrl(event.target.value)}
            />
            <button
              type="button"
              className="button-primary"
              disabled={completingLogin || !callbackUrl.includes('/auth/callback')}
              onClick={() => {
                setCompletingLogin(true);
                void completeChatGptLogin(callbackUrl.trim())
                  .then(async (result) => {
                    setCallbackUrl('');
                    if (result.authenticated) {
                      await refreshChatGpt();
                    } else {
                      setActivity(
                        'Máy chủ chưa xác nhận được đăng nhập. Thử đăng nhập lại từ đầu.',
                      );
                    }
                  })
                  .catch(() => {
                    setActivity(
                      'Địa chỉ dán vào không được chấp nhận (mã có thể đã hết hạn). Bấm "Mở lại trang đăng nhập" và thử lại.',
                    );
                  })
                  .finally(() => setCompletingLogin(false));
              }}
            >
              {completingLogin ? 'Đang xác nhận…' : 'Hoàn tất đăng nhập'}
            </button>
          </div>
        </div>
      ) : null}

      {queuedPrompts.length > 0 ? (
        <section className="neko-queue" aria-label="Câu hỏi đang chờ">
          <div>
            <strong>{queuedPrompts.length}/3 câu đang chờ</strong>
            {!busy ? (
              <button type="button" onClick={runNextQueued}>
                Tiếp tục
              </button>
            ) : null}
          </div>
          <ol>
            {queuedPrompts.map((prompt, index) => (
              <li key={`${prompt}-${index}`}>
                <span>{prompt}</span>
                <button
                  type="button"
                  aria-label={`Bỏ câu hỏi chờ: ${prompt}`}
                  onClick={() =>
                    replaceQueuedPrompts(
                      queuedPromptsRef.current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <form
        className="neko-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = input.trim();
          if (!value) return;
          if (busyRef.current && queuedPromptsRef.current.length >= 3) {
            setSessionNotice({
              kind: 'warning',
              text: 'Hàng đợi đã có 3 câu. Nội dung bạn đang gõ vẫn được giữ lại.',
            });
            return;
          }
          setInput('');
          void ask(value);
        }}
      >
        <textarea
          ref={inputRef}
          autoComplete="off"
          disabled={!controllerReady}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          placeholder={busy ? 'Nhập câu tiếp theo để xếp hàng…' : 'Hỏi về lớp học…'}
          aria-label="Câu hỏi cho Neko"
          rows={1}
        />
        <div className="neko-input-actions">
          {busy ? (
            <button className="button-secondary" type="button" onClick={stop}>
              Dừng
            </button>
          ) : null}
          <button
            className="button-primary"
            type="submit"
            disabled={!controllerReady || !input.trim()}
          >
            {busy ? 'Xếp hàng' : 'Gửi'}
          </button>
        </div>
      </form>

      <footer className="neko-foot">
        <details className="neko-settings">
          <summary>
            <span>Tùy chọn AI</span>
            <small>{providerLabel}</small>
          </summary>
          <div>
            <label>
              <span>Nguồn AI</span>
              <select
                value={providerId}
                onChange={(event) => void switchProvider(event.target.value)}
                aria-label="Chọn nguồn AI cho Neko"
              >
                <option value="local">Tự động · ưu tiên cục bộ</option>
                <option value="web">Gemma · trên thiết bị</option>
                <option value="chatgpt" disabled={!chatGpt.available}>
                  ChatGPT
                  {chatGpt.authenticated
                    ? ' · đã kết nối'
                    : chatGpt.available
                      ? ''
                      : ' · chỉ bản tự vận hành'}
                </option>
              </select>
            </label>
            {providerId === 'chatgpt' &&
            chatGpt.authenticated &&
            (chatGpt.models?.length ?? 0) > 0 ? (
              <label>
                <span>Mô hình ChatGPT</span>
                <select
                  value={chatGptModel}
                  onChange={(event) => {
                    const model = event.target.value;
                    setChatGptModel(model);
                    CHATGPT_PROVIDER.setModel(model);
                    setActivity(
                      `Đã chọn ${event.target.selectedOptions[0]?.textContent ?? model}.`,
                    );
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
          </div>
        </details>
      </footer>
    </aside>
  );
}
