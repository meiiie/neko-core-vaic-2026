import { beforeEach, describe, expect, it, vi } from 'vitest';

const createEngine = vi.fn();
const hasModel = vi.fn();
const deleteModel = vi.fn();

vi.mock('@mlc-ai/web-llm', () => ({
  CreateWebWorkerMLCEngine: createEngine,
  hasModelInCache: hasModel,
  deleteModelAllInfoInCache: deleteModel,
  prebuiltAppConfig: { model_list: [{ model_id: 'gemma3-1b-it-q4f16_1-MLC' }] },
}));

class FakeWorker {
  terminate = vi.fn();
}

vi.stubGlobal('Worker', FakeWorker);

function fakeEngine(content = 'Xin chào') {
  return {
    chat: {
      completions: {
        create: vi.fn(async () => ({
          async *[Symbol.asyncIterator]() {
            yield { choices: [{ delta: { content } }] };
          },
        })),
      },
    },
    interruptGenerate: vi.fn(),
    unload: vi.fn(async () => undefined),
  };
}

describe('WebLLM worker provider lifecycle', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('./webllm-provider');
    await module.disposeWebLlm();
  });

  it('uses the official model cache probe and deletion APIs', async () => {
    hasModel.mockResolvedValue(true);
    const module = await import('./webllm-provider');

    await expect(module.isWebLlmCached()).resolves.toBe(true);
    await module.deleteWebLlmCache();

    expect(hasModel).toHaveBeenCalledWith(
      'gemma3-1b-it-q4f16_1-MLC',
      expect.objectContaining({ cacheBackend: 'indexeddb' }),
    );
    expect(deleteModel).toHaveBeenCalledWith(
      'gemma3-1b-it-q4f16_1-MLC',
      expect.objectContaining({ cacheBackend: 'indexeddb' }),
    );
  });

  it('clears a rejected engine promise so preload can retry', async () => {
    createEngine.mockRejectedValueOnce(new Error('first load failed'));
    createEngine.mockResolvedValueOnce(fakeEngine());
    const module = await import('./webllm-provider');

    await expect(module.preloadWebLlm()).rejects.toThrow('first load failed');
    await expect(module.preloadWebLlm()).resolves.toBeUndefined();

    expect(createEngine).toHaveBeenCalledTimes(2);
  });

  it('interrupts generation on abort and unloads exactly once on dispose', async () => {
    const engine = fakeEngine();
    createEngine.mockResolvedValue(engine);
    const module = await import('./webllm-provider');
    const provider = new module.WebLlmAgentProvider();
    const controller = new AbortController();
    controller.abort('stop');

    await expect(provider.complete([], [], controller.signal)).rejects.toBe('stop');
    await provider.dispose();
    await provider.dispose();

    expect(engine.interruptGenerate).toHaveBeenCalledTimes(1);
    expect(engine.unload).toHaveBeenCalledTimes(1);
  });
});
