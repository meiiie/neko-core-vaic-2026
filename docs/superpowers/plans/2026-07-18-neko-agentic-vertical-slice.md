# Neko Agentic Vertical Slice — Implementation Plan

> **Execution mode:** inline in the approved `agent/neko-ai-harness-v2` branch. Implement each task test-first and stop only after the repository verification commands pass or a real external-auth blocker is documented.

**Goal:** Replace the stateless teacher assistant loop with a persistent, evidence-grounded agent session that compacts by token budget, works with rule/WebLLM/OpenAI Responses providers, and supports optional ChatGPT managed login through the public Codex App Server protocol.

**Architecture:** `AgentSessionController` owns canonical messages, compaction, lifecycle and persistence. `AgentLoop` owns per-turn budgets. `ToolRuntime` validates the session allowlist and strict Zod inputs before calling deterministic tools. Providers never read the domain or IndexedDB directly. Remote secrets stay behind Fastify; WebLLM runs in a worker. ChatGPT account mode is disabled unless explicitly enabled for local/self-hosted deployments.

**Tech stack:** React 19, TypeScript 6, Vite/Vitest, Zod 4, Dexie/IndexedDB, Fastify 5, native `fetch`, WebLLM 0.2.84, optional Codex App Server 0.144.x.

**Execution result (authoritative, completed 2026-07-18):** all acceptance criteria below are implemented and verified. Evidence normalization stays inside the existing loop instead of adding a one-use `evidence.ts` abstraction. ChatGPT managed mode deliberately uses the deterministic browser tool router and sends only bounded evidence to the official App Server for synthesis; it does not expose domain tools or browser IndexedDB to Codex. The task checklists below are the original execution record, not a live status board.

---

### Task 1: Freeze a clean verification baseline

- [ ] Add `ref/**`, `lab/**`, and `labs/**` to Vitest exclusions in `vite.config.ts` without changing production bundling.
- [ ] Restore dependencies from `package-lock.json` and verify the pinned Node/npm environment.
- [ ] Run the existing agent, session, server and domain tests before behavior changes.
- [ ] Commit the spec/plan and baseline test-scope change.

Commands:

```powershell
npm ci
npm exec vitest run src/services/agent/agent.test.ts src/app/session.test.tsx server/app.test.ts
npm run typecheck
```

### Task 2: Introduce strict provider/tool contracts

- [ ] Write failing tests for unknown tools, additional properties, wrong enum values, duplicate calls and abort.
- [ ] Replace flat descriptive params with a Zod runtime schema plus strict JSON Schema on every `AgentTool`.
- [ ] Add provider capabilities, finish reason, usage and `dispose()` to the provider contract without adding a second agent abstraction.
- [ ] Execute only the tools passed to the session; remove the global-registry lookup from the loop.
- [ ] Run focused tests and commit.

Files:

- `src/services/agent/protocol.ts`
- `src/services/agent/tools.ts`
- `src/services/agent/tool-runtime.ts`
- `src/services/agent/loop.ts`
- `src/services/agent/agent.test.ts`

### Task 3: Add persistent session memory and repeatable compaction

- [ ] Write a failing test that runs more than ten turns with a tiny context budget and verifies multiple compactions without a reset.
- [ ] Test that system contract, original task, user corrections, deterministic tool evidence and recent complete turns survive after 1, 2 and 5 compactions.
- [ ] Implement a conservative token estimator and `ContextManager`; trigger compaction from estimated/observed tokens, never turn count.
- [ ] Store a structured capsule and recent tail; merge a prior capsule on later compactions instead of summarizing the summary as free prose.
- [ ] Add an IndexedDB `agentSessions` table, scoped by account/role/class/provider, and reject cross-scope resume.
- [ ] Implement `abort()`, `reset()`, `dispose()` and generation guards for late events.
- [ ] Run focused tests and commit.

Files:

- `src/services/agent/context-manager.ts`
- `src/services/agent/session-controller.ts`
- `src/services/agent/session-store.ts`
- `src/storage/db.ts`
- `src/services/agent/session-controller.test.ts`

### Task 4: Make evidence verification deterministic

- [ ] Write failing tests for invented numbers, missing evidence anchors and multi-tool fact merging.
- [ ] Normalize successful tool results into a bounded evidence brief.
- [ ] Reject model summaries containing unsupported numeric claims; fall back to a deterministic rendering of all collected evidence, not only the final tool.
- [ ] Preserve honest `NEEDS_MORE_EVIDENCE`, `INTERRUPTED`, `FALLBACK` and provider error outcomes.
- [ ] Run focused tests and commit.

Files:

- `src/services/agent/evidence.ts`
- `src/services/agent/loop.ts`
- `src/services/agent/agent.test.ts`

### Task 5: Make browser Gemma actually offline-capable

- [ ] Mock WebLLM and write failing tests for rejected-load retry, cache detection, abort, unload and delete.
- [ ] Move inference to `src/services/agent/webllm.worker.ts` with `CreateWebWorkerMLCEngine`.
- [ ] Select `gemma3-1b-it-q4f16_1-MLC`, use the official cache APIs and persistent IndexedDB cache backend.
- [ ] Interrupt generation on abort, unload/dispose exactly once, and clear a rejected engine promise so a later attempt can retry.
- [ ] Update the system page to explain explicit preload and “offline after download”.
- [ ] Run focused tests/build and commit.

Files:

- `src/services/agent/webllm.worker.ts`
- `src/services/agent/webllm-provider.ts`
- `src/services/agent/webllm-provider.test.ts`
- `src/features/system/SystemPage.tsx`

### Task 6: Add the official OpenAI Responses server provider

- [ ] Write Fastify tests for teacher-only access, disabled/missing-key status, request limits, upstream auth/rate-limit errors and normalized tool calls.
- [ ] Add `/api/ai/providers` and `/api/ai/responses`; validate messages/tools, apply `store: false`, strict function schemas, request timeout and bounded retries.
- [ ] Keep `OPENAI_API_KEY` server-only and expose no secret in status/error responses.
- [ ] Add a browser `ResponsesAgentProvider`; support Responses SSE deltas/tool argument events and usage.
- [ ] Default to the resolver-confirmed `gpt-5.6-sol`, configurable through `NEKOPATH_OPENAI_MODEL`.
- [ ] Run server/provider tests and commit.

Files:

- `server/ai/responses.ts`
- `server/app.ts`
- `server/app.test.ts`
- `src/services/agent/responses-provider.ts`
- `src/services/agent/responses-provider.test.ts`

### Task 7: Add optional ChatGPT managed login safely

- [ ] Write protocol tests with a fake JSON-RPC child process for initialize, account status, device-code login, completion, logout and disposal.
- [ ] Implement the public Codex App Server JSON-RPC subset; never call private ChatGPT backend endpoints.
- [ ] Isolate Codex state under an exact per-account directory, use an empty working directory, `read-only` sandbox and `never` approval policy.
- [ ] Disable this provider unless `NEKOPATH_CODEX_APP_SERVER_ENABLED=1`; expose login/status/logout endpoints only to authenticated teachers.
- [ ] Bridge only the session’s strict read-only tools as bounded dynamic tools/evidence and return a redacted tool trace.
- [ ] On logout, call `account/logout`, terminate the process and remove only the resolved isolated directory.
- [ ] Run fake-process tests; perform a binary smoke test without initiating user auth and commit.

Files:

- `server/ai/codex-app-server.ts`
- `server/ai/codex-routes.ts`
- `server/ai/codex-app-server.test.ts`
- `src/services/agent/chatgpt-provider.ts`

### Task 8: Wire controller lifecycle into NekoDock

- [ ] Add component/session tests for follow-up, stop, provider switch and logout during an active turn.
- [ ] Own one controller per account/class/provider scope; recreate it on a scope change.
- [ ] Add Stop while busy, provider availability/login state and a quiet compaction trace note.
- [ ] Abort/dispose before NekoPath logout and ignore late completion events.
- [ ] Keep the existing visual design and deterministic source disclosure; do not start the separate UX redesign.
- [ ] Run component tests and commit.

Files:

- `src/components/NekoDock.tsx`
- `src/components/AppLayout.tsx`
- `src/app/session.tsx`
- associated tests

### Task 9: Verify and document the runnable slice

- [ ] Add a frozen eval covering “Chẩn đoán An?”, “Vì sao?”, repeated compaction, invented-number fallback, offline rule fallback and lifecycle races.
- [ ] Document environment flags, preload, ChatGPT local-mode limitation, security boundaries and troubleshooting.
- [ ] Run the complete repository test suite with ref/lab excluded.
- [ ] Run typecheck, production build and Docker configuration checks.
- [ ] Inspect `git diff --check`, status and commit history; keep unrelated untracked lab work untouched.

Final commands:

```powershell
npm test -- --run
npm run typecheck
npm run build
docker compose -f ops/compose.yml config --quiet
git diff --check
git status --short --branch
```

Acceptance:

- A session can run well beyond ten turns and compact repeatedly without losing its system contract, original task, corrections or grounded evidence.
- Follow-up questions use prior context; no fixed turn threshold clears memory.
- Tool arguments and allowlist are runtime-validated; unsupported factual claims fall back deterministically.
- Rule mode works with no network; WebLLM works after one explicit preload; Responses works when a server key is configured.
- ChatGPT managed login is available only in explicitly enabled local/self-hosted mode and keeps tokens out of the browser.
- Stop, provider switch and logout abort pending work and prevent late writes.
- Focused and full verification commands pass.
