import type { AgentChatMessage, AgentCompletion, AgentProvider } from './loop';
import { parseJsonToolEnvelope } from './providers';
import type { AgentTool } from './tools';

/**
 * Gemma RIGHT IN THE BROWSER via WebLLM (WebGPU, OpenAI-style API).
 * Offline-first by construction: weights (~1.6GB, gemma-2-2b 1k-context)
 * download ONCE while connectivity exists, are cached by the browser, then
 * inference runs with zero network — the exact story remote-area schools
 * need. The heavy library is dynamically imported so the app shell pays
 * nothing until a teacher actually switches to this brain.
 */

const MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC-1k';

type ProgressListener = (report: { progress: number; text: string }) => void;
let progressListener: ProgressListener | null = null;

/** The dock registers here to show first-download progress honestly. */
export function setWebLlmProgressListener(listener: ProgressListener | null): void {
  progressListener = listener;
}

interface WebLlmEngine {
  chat: {
    completions: {
      create(request: object): Promise<
        AsyncIterable<{
          choices?: { delta?: { content?: string } }[];
        }>
      >;
    };
  };
}

let enginePromise: Promise<WebLlmEngine> | null = null;

async function engine(): Promise<WebLlmEngine> {
  enginePromise ??= (async () => {
    const webllm = await import('@mlc-ai/web-llm');
    const created = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report: { progress: number; text: string }) => {
        progressListener?.(report);
      },
    });
    return created as unknown as WebLlmEngine;
  })();
  return enginePromise;
}

const ENVELOPE_INSTRUCTION =
  'Khi cần dữ kiện, trả lời DUY NHẤT một JSON {"tool":"<tên>","args":{...}}. ' +
  'Khi đã có kết quả công cụ, trả lời bằng văn bản thường dựa đúng trên các con số đó.';

export class WebLlmAgentProvider implements AgentProvider {
  readonly id = 'web';
  readonly label = 'Gemma trong trình duyệt (WebLLM — offline sau lần tải đầu)';

  async complete(
    messages: readonly AgentChatMessage[],
    tools: readonly AgentTool[],
    _signal?: AbortSignal,
    onDelta?: (text: string) => void,
  ): Promise<AgentCompletion> {
    const llm = await engine();
    const toolMenu = tools
      .map((tool) => `- ${tool.name}: ${tool.description} args: ${JSON.stringify(tool.parameters)}`)
      .join('\n');
    const executedTools = new Set(
      messages.filter((message) => message.role === 'tool').map((message) => message.toolName),
    );
    const chunks = await llm.chat.completions.create({
      stream: true,
      temperature: 0,
      messages: [
        { role: 'system', content: `${ENVELOPE_INSTRUCTION}\n${toolMenu}` },
        // WebLLM has no tool role; fold tool results into user turns.
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

    let content = '';
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        content += delta;
        onDelta?.(delta);
      }
    }

    const envelope = parseJsonToolEnvelope(content);
    if (envelope && !executedTools.has(envelope.name)) {
      return { content: null, toolCalls: [envelope] };
    }
    if (envelope && content) {
      const stripped = content
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*\}/, '')
        .trim();
      return { content: stripped || null, toolCalls: [] };
    }
    return { content: content || null, toolCalls: [] };
  }
}
