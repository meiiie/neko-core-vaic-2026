import type { AgentChatMessage, AgentCompletion, AgentProvider } from './loop';
import { parseJsonToolEnvelope } from './protocol';
import type { AgentTool } from './tools';

/**
 * Gemma 3 1B runs inside a dedicated Web Worker. Model artifacts are fetched
 * only after an explicit preload and then remain in WebLLM's IndexedDB cache.
 */

export const WEBLLM_MODEL_ID = 'gemma3-1b-it-q4f16_1-MLC';
export const WEBLLM_MODEL_LABEL = 'Gemma 3 1B (trình duyệt, khoảng 600MB)';

type ProgressListener = (report: { progress: number; text: string }) => void;
let progressListener: ProgressListener | null = null;

export function setWebLlmProgressListener(listener: ProgressListener | null): void {
  progressListener = listener;
}

interface WebLlmChunk {
  readonly choices?: readonly { delta?: { content?: string } }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
}

interface WebLlmEngine {
  readonly chat: {
    readonly completions: {
      create(request: object): Promise<AsyncIterable<WebLlmChunk>>;
    };
  };
  interruptGenerate(): void;
  unload(): Promise<void>;
}

interface WebLlmModule {
  readonly prebuiltAppConfig: { readonly model_list: readonly unknown[] };
  CreateWebWorkerMLCEngine(
    worker: Worker,
    modelId: string,
    config: object,
  ): Promise<WebLlmEngine>;
  hasModelInCache(modelId: string, config: object): Promise<boolean>;
  deleteModelAllInfoInCache(modelId: string, config: object): Promise<void>;
}

let enginePromise: Promise<WebLlmEngine> | null = null;
let workerInstance: Worker | null = null;

async function loadModule(): Promise<WebLlmModule> {
  return (await import('@mlc-ai/web-llm')) as unknown as WebLlmModule;
}

function appConfig(module: WebLlmModule): object {
  return {
    ...module.prebuiltAppConfig,
    cacheBackend: 'indexeddb',
  };
}

export async function isWebLlmCached(): Promise<boolean> {
  try {
    const module = await loadModule();
    return await module.hasModelInCache(WEBLLM_MODEL_ID, appConfig(module));
  } catch {
    return false;
  }
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

async function engine(): Promise<WebLlmEngine> {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const module = await loadModule();
    const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
    workerInstance = worker;
    try {
      return await module.CreateWebWorkerMLCEngine(worker, WEBLLM_MODEL_ID, {
        appConfig: appConfig(module),
        initProgressCallback: (report: { progress: number; text: string }) => {
          progressListener?.(report);
        },
      });
    } catch (error) {
      worker.terminate();
      if (workerInstance === worker) workerInstance = null;
      throw error;
    }
  })().catch((error: unknown) => {
    // A rejected cached promise would make the model permanently unusable
    // until reload. Clearing it lets a resumed/partial download retry.
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}

export async function preloadWebLlm(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistence is best-effort; WebLLM cache remains usable without it.
  }
  await engine();
}

export async function disposeWebLlm(): Promise<void> {
  const pending = enginePromise;
  enginePromise = null;
  if (pending) {
    try {
      const loaded = await pending;
      await loaded.unload();
    } catch {
      // A failed load has already reset the promise and terminated its worker.
    }
  }
  workerInstance?.terminate();
  workerInstance = null;
}

export async function deleteWebLlmCache(): Promise<void> {
  await disposeWebLlm();
  const module = await loadModule();
  await module.deleteModelAllInfoInCache(WEBLLM_MODEL_ID, appConfig(module));
}

const ENVELOPE_INSTRUCTION =
  'Khi cần dữ kiện, trả lời DUY NHẤT một JSON {"tool":"<tên>","args":{...}}. ' +
  'Khi đã có kết quả công cụ, trả lời bằng văn bản thường dựa đúng trên các con số đó.';

export class WebLlmAgentProvider implements AgentProvider {
  readonly id = 'web';
  readonly label = 'Gemma 3 trong trình duyệt (offline sau lần tải đầu)';
  readonly contextWindow = 4_096;

  async complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<AgentCompletion> {
    const llm = await engine();
    const abort = () => llm.interruptGenerate();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      signal.removeEventListener('abort', abort);
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    const toolMenu = tools
      .map(
        (tool) =>
          `- ${tool.name}: ${tool.description} args: ${JSON.stringify(tool.inputJsonSchema)}`,
      )
      .join('\n');
    const executedTools = new Set(
      messages.filter((message) => message.role === 'tool').map((message) => message.toolName),
    );

    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const chunks = await llm.chat.completions.create({
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0,
        max_tokens: 384,
        messages: [
          { role: 'system', content: `${ENVELOPE_INSTRUCTION}\n${toolMenu}` },
          ...messages.map((message) =>
            message.role === 'tool'
              ? {
                  role: 'user' as const,
                  content: `[Kết quả công cụ ${message.toolName}]: ${message.content}`,
                }
              : {
                  role: message.role === 'system' ? ('system' as const) : message.role,
                  content: message.content,
                },
          ),
          ...(executedTools.size > 0
            ? [
                {
                  role: 'system' as const,
                  content:
                    'Kết quả công cụ đã có ở trên. KHÔNG xuất JSON nữa — trả lời bằng văn bản thường.',
                },
              ]
            : []),
        ],
      });

      for await (const chunk of chunks) {
        if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          onDelta?.(delta);
        }
        inputTokens = chunk.usage?.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage?.completion_tokens ?? outputTokens;
      }
    } finally {
      signal?.removeEventListener('abort', abort);
    }

    const envelope = parseJsonToolEnvelope(content);
    if (envelope && !executedTools.has(envelope.name)) {
      return {
        content: null,
        toolCalls: [envelope],
        usage: { inputTokens, outputTokens },
      };
    }
    if (envelope && content) {
      const stripped = content
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*\}/, '')
        .trim();
      return {
        content: stripped || null,
        toolCalls: [],
        usage: { inputTokens, outputTokens },
      };
    }
    return {
      content: content || null,
      toolCalls: [],
      usage: { inputTokens, outputTokens },
    };
  }

  async dispose(): Promise<void> {
    await disposeWebLlm();
  }
}
