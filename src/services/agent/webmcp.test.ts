import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerNekoPathWebMcpTools } from './webmcp';

afterEach(() => {
  Reflect.deleteProperty(document, 'modelContext');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('NekoPath WebMCP bridge', () => {
  it('registers the shared tool contracts and gates assignment creation with confirmation', async () => {
    const registered: {
      tool: {
        name: string;
        annotations?: { readOnlyHint?: boolean };
        execute(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      };
      signal?: AbortSignal;
    }[] = [];
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: vi.fn((tool, options) => {
          registered.push({ tool, signal: options?.signal });
        }),
      },
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchImpl = vi.fn(async () =>
      Response.json({ id: 'assignment-webmcp' }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchImpl);

    const unregister = registerNekoPathWebMcpTools();

    expect(registered.map(({ tool }) => tool.name)).toEqual([
      'tong_quan_lop',
      'chan_doan_hoc_sinh',
      'giai_thich_kien_thuc',
      'bai_duoc_giao',
      'de_xuat_bai_tap',
      'giao_bai',
    ]);
    const assignment = registered.find(({ tool }) => tool.name === 'giao_bai');
    expect(assignment?.tool.annotations?.readOnlyHint).toBe(false);
    const output = await assignment?.tool.execute({
      title: 'Luyện tập Phân số bằng nhau',
      question_ids: ['q-k02-1'],
      due_at: null,
      allow_retake: false,
      shuffle_answers: true,
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(output).toMatchObject({
      structuredContent: { ok: true, data: { id: 'assignment-webmcp' } },
      isError: false,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/assignments',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );

    unregister();
    expect(registered.every(({ signal }) => signal?.aborted)).toBe(true);
  });
});
