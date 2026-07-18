import type { AgentChatMessage, AgentCompletion, AgentProvider } from './loop';
import { parseJsonToolEnvelope } from './protocol';
import type { AgentTool } from './tools';

export interface ChatGptModel {
  readonly id: string;
  readonly model: string;
  readonly displayName: string;
  readonly description: string;
  readonly isDefault: boolean;
}

export interface ChatGptStatus {
  readonly available: boolean;
  readonly authenticated: boolean;
  readonly planType?: string | null;
  readonly models?: readonly ChatGptModel[];
  readonly defaultModel?: string | null;
}

export interface ChatGptBrowserLogin {
  readonly loginId: string;
  readonly authUrl: string;
}

async function jsonRequest<T>(
  fetchImpl: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchImpl(url, { credentials: 'include', ...init });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `ChatGPT provider trả về ${response.status}`);
  }
  return (await response.json()) as T;
}

export function readChatGptStatus(fetchImpl: typeof fetch = fetch): Promise<ChatGptStatus> {
  return jsonRequest(fetchImpl, '/api/ai/chatgpt/status');
}

export function startChatGptLogin(fetchImpl: typeof fetch = fetch): Promise<ChatGptBrowserLogin> {
  return jsonRequest(fetchImpl, '/api/ai/chatgpt/login', { method: 'POST' });
}

export async function logoutChatGpt(fetchImpl: typeof fetch = fetch): Promise<void> {
  await jsonRequest(fetchImpl, '/api/ai/chatgpt/logout', { method: 'POST' });
}

function agentPrompt(messages: readonly AgentChatMessage[], tools: readonly AgentTool[]): string {
  const executedTools = new Set(
    messages.filter((message) => message.role === 'tool').map((message) => message.toolName),
  );
  const toolMenu = tools
    .map(
      (tool) => `- ${tool.name}: ${tool.description} args: ${JSON.stringify(tool.inputJsonSchema)}`,
    )
    .join('\n');
  const transcript = messages
    .map((message) => {
      if (message.role === 'tool') {
        return `BẰNG CHỨNG (${message.toolName ?? 'không rõ'}): ${message.content}`;
      }
      return `${message.role.toUpperCase()}: ${message.content}`;
    })
    .join('\n\n');
  return (
    'Bạn là NekoPath, trợ lý hội thoại cho giáo viên. Trả lời tự nhiên bằng tiếng Việt, chỉ dùng văn bản thuần, không Markdown. ' +
    'Với trò chuyện thông thường, hãy trả lời trực tiếp như một trợ lý thật. ' +
    'Khi câu hỏi cần dữ liệu lớp, học sinh, kiến thức hoặc bài đã giao mà chưa có kết quả công cụ, ' +
    'chỉ trả về đúng một JSON {"tool":"<tên>","args":{...}} và không thêm văn bản. ' +
    'Khi đã có BẰNG CHỨNG, không gọi lại công cụ đó; hãy tổng hợp câu trả lời từ bằng chứng và không bịa số liệu.\n\n' +
    `CÔNG CỤ KHẢ DỤNG:\n${toolMenu}\n\n` +
    (executedTools.size > 0
      ? `CÔNG CỤ ĐÃ CHẠY: ${[...executedTools].join(', ')}. Hãy trả lời từ kết quả, không xuất JSON gọi lại.\n\n`
      : '') +
    transcript
  );
}

interface SseRecord {
  readonly event: string;
  readonly data: string;
}

function parseRecord(raw: string): SseRecord | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null;
}

async function readSse(response: Response, onRecord: (record: SseRecord) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ChatGPT stream không có response body.');
  const decoder = new TextDecoder();
  let buffer = '';
  const drain = (final = false) => {
    const normalized = buffer.replace(/\r\n/g, '\n');
    const records = normalized.split('\n\n');
    buffer = final ? '' : (records.pop() ?? '');
    for (const raw of final ? records.filter(Boolean) : records) {
      const record = parseRecord(raw);
      if (record) onRecord(record);
    }
    if (final && buffer.trim()) {
      const record = parseRecord(buffer);
      if (record) onRecord(record);
      buffer = '';
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    drain();
  }
  buffer += decoder.decode();
  drain(true);
}

export class ChatGptAgentProvider implements AgentProvider {
  readonly id = 'chatgpt';
  readonly label = 'ChatGPT đã đăng nhập (Codex App Server)';
  readonly contextWindow = 128_000;
  private selectedModel: string | null = null;

  constructor(private readonly fetchImpl?: typeof fetch) {}

  setModel(model: string | null): void {
    this.selectedModel = model;
  }

  async complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<AgentCompletion> {
    const response = await (this.fetchImpl ?? fetch)('/api/ai/chatgpt/complete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: agentPrompt(messages, tools),
        ...(this.selectedModel ? { model: this.selectedModel } : {}),
      }),
      signal,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `ChatGPT provider trả về ${response.status}`);
    }

    let content = '';
    let finalContent = '';
    let modelId = 'chatgpt';
    let usage: AgentCompletion['usage'];
    let streamError: Error | null = null;
    let pendingVisibleText = '';
    let visibilityDecided = false;
    await readSse(response, ({ event, data }) => {
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (event === 'delta' && typeof value.text === 'string') {
        content += value.text;
        if (visibilityDecided) {
          onDelta?.(value.text);
        } else {
          pendingVisibleText += value.text;
          const first = pendingVisibleText.trimStart().charAt(0);
          if (first && first !== '{' && first !== '`') {
            visibilityDecided = true;
            onDelta?.(pendingVisibleText);
            pendingVisibleText = '';
          }
        }
      } else if (event === 'usage') {
        const inputTokens = Number(value.inputTokens);
        const outputTokens = Number(value.outputTokens);
        if (Number.isFinite(inputTokens) && Number.isFinite(outputTokens)) {
          const cachedInputTokens = Number(value.cachedInputTokens);
          usage = {
            inputTokens,
            outputTokens,
            ...(Number.isFinite(cachedInputTokens) ? { cachedInputTokens } : {}),
          };
        }
      } else if (event === 'done') {
        if (typeof value.content === 'string') finalContent = value.content;
        if (typeof value.modelId === 'string') modelId = value.modelId;
      } else if (event === 'error') {
        streamError = new Error(
          typeof value.message === 'string' ? value.message : 'ChatGPT completion failed.',
        );
      }
    });
    if (streamError) throw streamError;
    const answer = content || finalContent;
    const executedTools = new Set(
      messages.filter((message) => message.role === 'tool').map((message) => message.toolName),
    );
    const envelope = parseJsonToolEnvelope(answer);
    if (envelope && !executedTools.has(envelope.name)) {
      return {
        content: null,
        toolCalls: [envelope],
        finishReason: 'tool_call',
        usage,
        modelId,
      };
    }
    if (!visibilityDecided && answer) onDelta?.(answer);
    return {
      content: answer || null,
      toolCalls: [],
      finishReason: 'stop',
      usage,
      modelId,
    };
  }
}
