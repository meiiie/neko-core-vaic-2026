import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleBasedProvider } from '../../src/services/agent/providers';
import { AgentSessionController } from '../../src/services/agent/session-controller';
import { AGENT_TOOLS } from '../../src/services/agent/tools';
import { installApiStub } from '../../src/test/api-stub';

beforeEach(() => installApiStub('co.ha@nekopath.edu.vn'));
afterEach(() => vi.unstubAllGlobals());

describe('frozen teacher agent harness eval', () => {
  it('keeps An diagnosis grounded and retrievable after repeated token compaction', async () => {
    const session = new AgentSessionController({
      provider: new RuleBasedProvider(),
      tools: AGENT_TOOLS,
      scope: { accountId: 'eval-teacher', role: 'teacher', classId: '7A' },
      contextPolicy: {
        maxInputTokens: 300,
        compactAtRatio: 0.55,
        outputReserveTokens: 40,
        recentTurns: 2,
      },
    });
    await session.run('Chẩn đoán An thế nào?');
    for (let turn = 0; turn < 12; turn += 1) await session.run(`Ghi chú lượt ${turn}.`);

    const answer = await session.run('Vì sao?');
    const snapshot = session.snapshot();

    expect(snapshot.turnCount).toBe(14);
    expect(snapshot.compactionCount).toBeGreaterThanOrEqual(3);
    expect(snapshot.capsule?.originalTask).toBe('Chẩn đoán An thế nào?');
    expect(answer.text).toContain('Phân số bằng nhau');
    expect(answer.text).toMatch(/bằng chứng/i);
  });
});
