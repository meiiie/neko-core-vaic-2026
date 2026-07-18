// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('SQLite deployment backup', () => {
  it('creates a readable snapshot with the source data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nekopath-backup-'));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, 'source.db');
    const targetPath = join(directory, 'snapshot.db');

    const source = new DatabaseSync(sourcePath);
    source.exec(
      "CREATE TABLE evidence (id TEXT PRIMARY KEY, answer TEXT NOT NULL); INSERT INTO evidence VALUES ('e-1', '3/4');",
    );
    source.close();

    const scriptPath = fileURLToPath(new URL('./sqlite-backup.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [scriptPath, targetPath], {
      encoding: 'utf8',
      env: { ...process.env, NEKOPATH_DB: sourcePath },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ integrity: 'ok' });

    const snapshot = new DatabaseSync(targetPath, { readOnly: true });
    expect(snapshot.prepare('SELECT * FROM evidence').get()).toEqual({
      id: 'e-1',
      answer: '3/4',
    });
    snapshot.close();
  });
});
