import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CodexAppServerClient, NodeCodexTransport } from './codex-app-server.ts';

const root = resolve(process.env.NEKOPATH_CODEX_SMOKE_HOME ?? 'lab/codex-app-server-smoke');
const codexHome = resolve(root, 'codex-home');
const workspace = resolve(root, 'empty-workspace');
mkdirSync(codexHome, { recursive: true });
mkdirSync(workspace, { recursive: true });

const client = new CodexAppServerClient(new NodeCodexTransport({ codexHome }), { cwd: workspace });
try {
  await client.initialize();
  const state = await client.account();
  console.log(
    JSON.stringify({
      appServer: 'ok',
      accountType: state.account?.type ?? null,
      planType: state.account?.planType ?? null,
      requiresOpenaiAuth: state.requiresOpenaiAuth,
    }),
  );
} finally {
  client.dispose();
}
