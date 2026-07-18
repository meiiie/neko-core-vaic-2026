import type { AgentChatMessage, AgentCompletion, AgentProvider } from './loop';
import { parseCapsule } from './context-manager';
import { routeRuleQuestion } from './rule-router';
import type { AgentTool } from './tools';

export interface ChatGptStatus {
  readonly available: boolean;
  readonly authenticated: boolean;
  readonly planType?: string | null;
}

export interface ChatGptDeviceLogin {
  readonly loginId: string;
  readonly verificationUrl: string;
  readonly userCode: string;
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

export function startChatGptLogin(fetchImpl: typeof fetch = fetch): Promise<ChatGptDeviceLogin> {
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

export class ChatGptAgentProvider implements AgentProvider {
  readonly id = 'chatgpt';
  readonly label = 'ChatGPT đã đăng nhập (Codex App Server)';
  readonly contextWindow = 128_000;
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async complete(
    messages: readonly AgentChatMessage[],
    _tools: readonly AgentTool[],
    signal?: AbortSignal,
  ): Promise<AgentCompletion> {
    if (!hasEvidenceAfterLatestUser(messages)) {
      return routeRuleQuestion(messages);
    }
    const body = await jsonRequest<{ content: string }>(
      this.fetchImpl,
      '/api/ai/chatgpt/complete',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: synthesisPrompt(messages) }),
        signal,
      },
    );
    return { content: body.content, toolCalls: [], finishReason: 'stop' };
  }
}
