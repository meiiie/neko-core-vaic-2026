import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  CodexAppServerClient,
  NodeCodexTransport,
  type CodexAccountResult,
  type CodexDeviceLogin,
} from './codex-app-server.ts';
import type { CodexManagerPort } from './codex-routes.ts';

export interface CodexAccountManagerOptions {
  readonly enabled: boolean;
  readonly rootDir: string;
  readonly codexBin?: string;
  readonly model?: string;
}

function accountKey(accountId: string): string {
  return createHash('sha256').update(accountId).digest('hex').slice(0, 24);
}

function assertChild(root: string, child: string): void {
  const pathFromRoot = relative(root, child);
  if (!pathFromRoot || pathFromRoot.startsWith('..') || resolve(root, pathFromRoot) !== child) {
    throw new Error('Codex account path nằm ngoài isolated root.');
  }
}

export class CodexAccountManager implements CodexManagerPort {
  private readonly root: string;
  private readonly clients = new Map<string, CodexAppServerClient>();
  private readonly options: CodexAccountManagerOptions;

  constructor(options: CodexAccountManagerOptions) {
    this.options = options;
    this.root = resolve(options.rootDir);
  }

  isEnabled(): boolean {
    if (!this.options.enabled) return false;
    if (this.options.codexBin) return existsSync(this.options.codexBin);
    return existsSync(
      resolve(process.cwd(), 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    );
  }

  async status(accountId: string): Promise<CodexAccountResult> {
    return this.client(accountId).account();
  }

  async startLogin(accountId: string): Promise<CodexDeviceLogin> {
    return this.client(accountId).startDeviceLogin();
  }

  async complete(accountId: string, prompt: string, signal?: AbortSignal): Promise<string> {
    return this.client(accountId).complete(prompt, undefined, signal);
  }

  async logout(accountId: string): Promise<void> {
    const directory = resolve(this.root, accountKey(accountId));
    assertChild(this.root, directory);
    const client =
      this.clients.get(accountId) ??
      (this.isEnabled() && existsSync(directory) ? this.client(accountId) : undefined);
    let logoutError: unknown;
    if (client) {
      try {
        await client.logout();
      } catch (error) {
        logoutError = error;
      } finally {
        client.dispose();
        this.clients.delete(accountId);
      }
    }
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
    if (logoutError) throw logoutError;
  }

  disposeAll(): void {
    for (const client of this.clients.values()) client.dispose();
    this.clients.clear();
  }

  private client(accountId: string): CodexAppServerClient {
    if (!this.isEnabled()) throw new Error('ChatGPT managed provider chưa được bật.');
    const existing = this.clients.get(accountId);
    if (existing) return existing;
    const accountRoot = resolve(this.root, accountKey(accountId));
    assertChild(this.root, accountRoot);
    const codexHome = resolve(accountRoot, 'codex-home');
    const workspace = resolve(accountRoot, 'empty-workspace');
    mkdirSync(codexHome, { recursive: true });
    mkdirSync(workspace, { recursive: true });
    const client = new CodexAppServerClient(
      new NodeCodexTransport({ codexHome, codexBin: this.options.codexBin }),
      { cwd: workspace, model: this.options.model },
    );
    this.clients.set(accountId, client);
    return client;
  }
}
