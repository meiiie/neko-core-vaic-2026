import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentProvider } from './loop';
import { AgentSessionController } from './session-controller';
import { RuleBasedProvider } from './providers';
import { AGENT_TOOLS } from './tools';
import type { AgentTool } from './tools';

const factTool: AgentTool = {
  name: 'fact',
  description: 'Return the frozen diagnosis fixture.',
  inputSchema: z.object({ learner: z.literal('an') }).strict(),
  inputJsonSchema: {
    type: 'object',
    properties: { learner: { type: 'string', enum: ['an'] } },
    required: ['learner'],
    additionalProperties: false,
  },
  readOnly: true,
  parallelSafe: true,
  timeoutMs: 1_000,
  async run() {
    return {
      ok: true,
      data: { hocSinh: 'an', kienThucGoc: 'Phân số bằng nhau', soBangChung: 7 },
    };
  },
};

function contextualProvider(): AgentProvider {
  return {
    id: 'contextual-test',
    label: 'contextual-test',
    contextWindow: 512,
    async complete(messages) {
      const last = messages.at(-1);
      if (last?.role === 'tool') {
        return {
          content: 'An cần củng cố Phân số bằng nhau dựa trên 7 bằng chứng.',
          toolCalls: [],
        };
      }
      const lastUser = [...messages].reverse().find((message) => message.role === 'user')?.content;
      if (lastUser?.includes('Chẩn đoán')) {
        return { content: null, toolCalls: [{ name: 'fact', args: { learner: 'an' } }] };
      }
      if (lastUser === 'Vì sao?') {
        const hasPriorEvidence = messages.some((message) =>
          message.content.includes('Phân số bằng nhau'),
        );
        return {
          content: hasPriorEvidence
            ? 'Vì bằng chứng đã xác nhận khoảng trống Phân số bằng nhau.'
            : 'Tôi đã mất ngữ cảnh.',
          toolCalls: [],
        };
      }
      return { content: 'Đã ghi nhận.', toolCalls: [] };
    },
  };
}

describe('AgentSessionController memory', () => {
  it('lets the real offline rule provider answer a contextual follow-up', async () => {
    const session = new AgentSessionController({
      provider: new RuleBasedProvider(),
      tools: AGENT_TOOLS,
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
    });

    await session.run('Chẩn đoán An thế nào?');
    const followUp = await session.run('Vì sao?');

    expect(followUp.text).toContain('Phân số bằng nhau');
  });

  it('keeps grounded context for a follow-up', async () => {
    const session = new AgentSessionController({
      provider: contextualProvider(),
      tools: [factTool],
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
    });

    await session.run('Chẩn đoán An thế nào?');
    const followUp = await session.run('Vì sao?');

    expect(followUp.text).toContain('Phân số bằng nhau');
  });

  it('compacts repeatedly by token budget without a ten-turn reset', async () => {
    const session = new AgentSessionController({
      provider: contextualProvider(),
      tools: [factTool],
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
      contextPolicy: {
        maxInputTokens: 260,
        compactAtRatio: 0.55,
        outputReserveTokens: 40,
        recentTurns: 2,
      },
    });

    await session.run('Chẩn đoán An thế nào?');
    await session.run('Chỉ dùng dữ kiện deterministic, không suy đoán ngoài bằng chứng.');
    for (let turn = 0; turn < 16; turn += 1) {
      await session.run(`Ghi nhận yêu cầu tiếp theo số ${turn}: giữ câu trả lời ngắn và có nguồn.`);
    }

    const snapshot = session.snapshot();
    expect(snapshot.compactionCount).toBeGreaterThanOrEqual(5);
    expect(snapshot.turnCount).toBe(18);
    expect(snapshot.capsule?.originalTask).toBe('Chẩn đoán An thế nào?');
    expect(snapshot.capsule?.constraints.join(' ')).toContain('Chỉ dùng dữ kiện deterministic');
    expect(JSON.stringify(snapshot.capsule?.evidence)).toContain('Phân số bằng nhau');
    expect(snapshot.messages.some((message) => message.content.includes('số 15'))).toBe(true);
  });

  it('lets the offline rule provider retrieve evidence from a compacted capsule', async () => {
    const session = new AgentSessionController({
      provider: new RuleBasedProvider(),
      tools: AGENT_TOOLS,
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
      contextPolicy: {
        maxInputTokens: 300,
        compactAtRatio: 0.55,
        outputReserveTokens: 40,
        recentTurns: 2,
      },
    });
    await session.run('Chẩn đoán An thế nào?');
    for (let turn = 0; turn < 12; turn += 1) {
      await session.run(`Ghi chú ngắn cho lượt ${turn}.`);
    }
    expect(session.snapshot().compactionCount).toBeGreaterThan(1);

    const followUp = await session.run('Vì sao?');

    expect(followUp.text).toContain('Phân số bằng nhau');
  });

  it('rejects an invented number in a follow-up and renders prior evidence deterministically', async () => {
    const provider: AgentProvider = {
      id: 'lying-follow-up',
      label: 'lying-follow-up',
      async complete(messages) {
        const last = messages.at(-1);
        if (last?.role === 'tool') {
          return { content: 'Đã nhận bằng chứng.', toolCalls: [] };
        }
        const question = [...messages]
          .reverse()
          .find((message) => message.role === 'user')?.content;
        if (question?.includes('Chẩn đoán')) {
          return {
            content: null,
            toolCalls: [{ name: 'chan_doan_hoc_sinh', args: { hoc_sinh: 'an' } }],
          };
        }
        return { content: 'Vì có 999 bằng chứng về Phân số bằng nhau.', toolCalls: [] };
      },
    };
    const session = new AgentSessionController({
      provider,
      tools: AGENT_TOOLS,
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
    });
    await session.run('Chẩn đoán An thế nào?');

    const followUp = await session.run('Vì sao?');

    expect(followUp.text).toContain('Phân số bằng nhau');
    expect(followUp.text).not.toContain('999');
  });

  it('aborts the active provider and disposes it exactly once', async () => {
    const dispose = vi.fn();
    const provider: AgentProvider = {
      id: 'slow',
      label: 'slow',
      dispose,
      complete: (_messages, _tools, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    };
    const session = new AgentSessionController({
      provider,
      tools: [],
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
    });

    const running = session.run('Đợi').catch((error: unknown) => error);
    session.abort('test');
    await running;
    await session.dispose();
    await session.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(session.snapshot().messages.some((message) => message.content === 'Đợi')).toBe(false);
  });

  it('resets canonical memory without disposing the reusable provider', async () => {
    const dispose = vi.fn();
    const provider = contextualProvider();
    provider.dispose = dispose;
    const session = new AgentSessionController({
      provider,
      tools: [factTool],
      scope: { accountId: 'teacher-1', role: 'teacher', classId: '7A' },
    });
    await session.run('Chẩn đoán An thế nào?');

    session.reset();

    const snapshot = session.snapshot();
    expect(snapshot.turnCount).toBe(0);
    expect(snapshot.compactionCount).toBe(0);
    expect(snapshot.capsule).toBeNull();
    expect(snapshot.messages).toHaveLength(1);
    expect(dispose).not.toHaveBeenCalled();
  });
});
