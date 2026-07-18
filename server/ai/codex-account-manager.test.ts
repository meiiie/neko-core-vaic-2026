// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { CodexAccountManager } from './codex-account-manager.ts';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('CodexAccountManager isolation', () => {
  it('removes only the signed-out account directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nekopath-codex-manager-'));
    roots.push(root);
    const accountId = 'teacher-1';
    const accountKey = createHash('sha256').update(accountId).digest('hex').slice(0, 24);
    const accountDir = join(root, accountKey);
    const neighborDir = join(root, 'neighbor');
    mkdirSync(accountDir, { recursive: true });
    mkdirSync(neighborDir, { recursive: true });
    writeFileSync(join(accountDir, 'opaque-state'), 'test');
    writeFileSync(join(neighborDir, 'keep'), 'test');
    const manager = new CodexAccountManager({ enabled: false, rootDir: root });

    await manager.logout(accountId);

    expect(existsSync(accountDir)).toBe(false);
    expect(existsSync(join(neighborDir, 'keep'))).toBe(true);
  });
});
