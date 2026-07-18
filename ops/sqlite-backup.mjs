import { backup, DatabaseSync } from 'node:sqlite';

const sourcePath = process.env.NEKOPATH_DB;
const targetPath = process.argv[2];

if (!sourcePath || !targetPath) {
  throw new Error('Usage: NEKOPATH_DB=/path/source.db node sqlite-backup.mjs /path/backup.db');
}

const source = new DatabaseSync(sourcePath, { readOnly: true });
try {
  await backup(source, targetPath);
} finally {
  source.close();
}

const snapshot = new DatabaseSync(targetPath, { readOnly: true });
try {
  const result = snapshot.prepare('PRAGMA quick_check').get();
  if (Object.values(result ?? {})[0] !== 'ok') {
    throw new Error('SQLite quick_check failed for the generated backup');
  }
} finally {
  snapshot.close();
}

process.stdout.write(`${JSON.stringify({ sourcePath, targetPath, integrity: 'ok' })}\n`);
