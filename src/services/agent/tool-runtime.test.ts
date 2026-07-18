import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentTool } from './tools';
import { executeToolCalls } from './tool-runtime';

function learnerTool(run = vi.fn(async () => ({ ok: true, data: { learner: 'an' } }))): AgentTool {
  return {
    name: 'learner',
    description: 'Read a learner fixture.',
    inputSchema: z.object({ learner: z.enum(['an', 'binh']) }).strict(),
    inputJsonSchema: {
      type: 'object',
      properties: { learner: { type: 'string', enum: ['an', 'binh'] } },
      required: ['learner'],
      additionalProperties: false,
    },
    readOnly: true,
    parallelSafe: true,
    timeoutMs: 1_000,
    run,
  };
}

function mutationTool(
  run: AgentTool['run'] = vi.fn(async () => ({ ok: true, data: { id: 'assignment-1' } })),
): AgentTool {
  return {
    ...learnerTool(),
    name: 'assign',
    description: 'Create an assignment.',
    readOnly: false,
    parallelSafe: false,
    run,
  };
}

describe('strict agent tool runtime', () => {
  it('rejects tools outside the session allowlist without executing anything', async () => {
    const run = vi.fn(async () => ({ ok: true, data: { learner: 'an' } }));
    const results = await executeToolCalls([{ name: 'not_allowed', args: {} }], [learnerTool(run)]);

    expect(results[0]).toMatchObject({ ok: false, errorCode: 'TOOL_NOT_ALLOWED' });
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects missing, invalid and additional properties before the executor', async () => {
    const run = vi.fn(async () => ({ ok: true, data: { learner: 'an' } }));
    const tool = learnerTool(run);

    const results = await executeToolCalls(
      [
        { name: 'learner', args: {} },
        { name: 'learner', args: { learner: 'unknown' } },
        { name: 'learner', args: { learner: 'an', hidden: 'no' } },
      ],
      [tool],
    );

    expect(results.every((result) => result.errorCode === 'INVALID_TOOL_ARGS')).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('passes parsed arguments to an allowed executor', async () => {
    const run = vi.fn(async () => ({ ok: true, data: { learner: 'an' } }));
    const results = await executeToolCalls(
      [{ name: 'learner', args: { learner: 'an' } }],
      [learnerTool(run)],
    );

    expect(results[0]).toMatchObject({ ok: true, name: 'learner' });
    expect(run).toHaveBeenCalledWith(
      { learner: 'an' },
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('fails closed for mutations and executes only after explicit approval', async () => {
    const run = vi.fn(async () => ({ ok: true, data: { id: 'assignment-1' } }));
    const tool = mutationTool(run);
    const call = { name: 'assign', args: { learner: 'an' } };

    const withoutGate = await executeToolCalls([call], [tool]);
    expect(withoutGate[0]).toMatchObject({
      ok: false,
      errorCode: 'TOOL_APPROVAL_REQUIRED',
    });
    expect(run).not.toHaveBeenCalled();

    const denied = await executeToolCalls([call], [tool], undefined, async () => false);
    expect(denied[0]).toMatchObject({ ok: false, errorCode: 'TOOL_DENIED' });
    expect(run).not.toHaveBeenCalled();

    const approved = await executeToolCalls([call], [tool], undefined, async () => true);
    expect(approved[0]).toMatchObject({ ok: true, data: { id: 'assignment-1' } });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('returns after the deadline even when an executor ignores the abort signal', async () => {
    const never = vi.fn(() => new Promise<never>(() => undefined));
    const tool = { ...learnerTool(never), timeoutMs: 5 };

    const startedAt = performance.now();
    const results = await executeToolCalls([{ name: 'learner', args: { learner: 'an' } }], [tool]);

    expect(results[0]).toMatchObject({ ok: false, errorCode: 'TOOL_TIMEOUT' });
    expect(performance.now() - startedAt).toBeLessThan(250);
  });

  it('returns an abort result even when an executor ignores the parent signal', async () => {
    const never = vi.fn(() => new Promise<never>(() => undefined));
    const controller = new AbortController();
    const running = executeToolCalls(
      [{ name: 'learner', args: { learner: 'an' } }],
      [learnerTool(never)],
      controller.signal,
    );

    controller.abort('test');

    await expect(running).resolves.toEqual([
      expect.objectContaining({ ok: false, errorCode: 'TOOL_ABORTED' }),
    ]);
  });
});
