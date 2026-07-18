import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { NekoPathDb } from '../../storage/db';
import type { AgentSessionSnapshot } from './session-controller';
import { AgentSessionStore } from './session-store';

const databases: NekoPathDb[] = [];

function createStore(): AgentSessionStore {
  const database = new NekoPathDb(`nekopath-agent-${crypto.randomUUID()}`);
  databases.push(database);
  return new AgentSessionStore(database);
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

function snapshot(accountId: string, classId: string): AgentSessionSnapshot {
  return {
    scope: { accountId, role: 'teacher', classId },
    messages: [
      { role: 'system', content: 'contract' },
      { role: 'user', content: 'Chẩn đoán An' },
    ],
    capsule: {
      version: 1,
      originalTask: 'Chẩn đoán An',
      constraints: ['chỉ dùng bằng chứng'],
      evidence: [{ toolName: 'fact', payload: '{"ok":true}' }],
      compactionCount: 3,
    },
    compactionCount: 3,
    turnCount: 14,
    usage: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 10 },
  };
}

describe('AgentSessionStore scope isolation', () => {
  it('round-trips a compacted session only for the exact account/class/provider scope', async () => {
    const store = createStore();
    await store.save(snapshot('teacher-1', '7A'), 'rule');

    expect(await store.load({ accountId: 'teacher-1', role: 'teacher', classId: '7A' }, 'rule'))
      .toMatchObject({ turnCount: 14, compactionCount: 3 });
    expect(
      await store.load({ accountId: 'teacher-2', role: 'teacher', classId: '7A' }, 'rule'),
    ).toBeNull();
    expect(
      await store.load({ accountId: 'teacher-1', role: 'teacher', classId: '7B' }, 'rule'),
    ).toBeNull();
    expect(await store.load({ accountId: 'teacher-1', role: 'teacher', classId: '7A' }, 'web'))
      .toBeNull();
  });

  it('clears every provider session for one account without touching another account', async () => {
    const store = createStore();
    await store.save(snapshot('teacher-1', '7A'), 'rule');
    await store.save(snapshot('teacher-1', '7A'), 'web');
    await store.save(snapshot('teacher-2', '7A'), 'rule');

    await store.clearAccount('teacher-1');

    expect(await store.load({ accountId: 'teacher-1', role: 'teacher', classId: '7A' }, 'rule'))
      .toBeNull();
    expect(await store.load({ accountId: 'teacher-2', role: 'teacher', classId: '7A' }, 'rule'))
      .not.toBeNull();
  });
});
