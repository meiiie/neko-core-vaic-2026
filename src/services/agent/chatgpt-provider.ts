import type { AgentChatMessage, AgentCompletion, AgentProvider } from './loop';
import { parseCapsule } from './context-manager';
import { routeRuleQuestion } from './rule-router';
import type { AgentTool } from './tools';

export interface ChatGptStatus {
  readonly available: boolean;
  readonly authenticated: boolean;
  readonly planType?: string | null;
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

function hasEvidenceAfterLatestUser(messages: readonly AgentChatMessage[]): boolean {
  const lastUser = messages.findLastIndex((message) => message.role === 'user');
  if (messages.slice(lastUser + 1).some((message) => message.role === 'tool')) return true;
  const latest = messages[lastUser]?.content.trim() ?? '';
  const isContextualFollowUp = /^(vì sao|tại sao|giải thích thêm)\??$/i.test(latest);
  return (
    isContextualFollowUp &&
    messages.some((message) => (parseCapsule(message)?.evidence.length ?? 0) > 0)
  );
}

function synthesisPrompt(messages: readonly AgentChatMessage[]): string {
  const transcript = messages
    .map((message) => {
      if (message.role === 'tool') {
        return `BẰNG CHỨNG (${message.toolName ?? 'không rõ'}): ${message.content}`;
      }
      return `${message.role.toUpperCase()}: ${message.content}`;
    })
    .join('\n\n');
  return (
    'Chỉ diễn giải bằng chứng deterministic bên dưới. Không dùng công cụ khác, không bịa số liệu. ' +
    'Nếu bằng chứng không đủ thì nói rõ. Trả lời tiếng Việt ngắn gọn cho giáo viên.\n\n' +
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
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async complete(
    messages: readonly AgentChatMessage[],
    _tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<AgentCompletion> {
    if (!hasEvidenceAfterLatestUser(messages)) {
      return routeRuleQuestion(messages);
    }
    const response = await this.fetchImpl('/api/ai/chatgpt/complete', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: synthesisPrompt(messages) }),
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
    await readSse(response, ({ event, data }) => {
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (event === 'delta' && typeof value.text === 'string') {
        content += value.text;
        onDelta?.(value.text);
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
    return {
      content: content || finalContent || null,
      toolCalls: [],
      finishReason: 'stop',
      usage,
      modelId,
    };
  }
}
