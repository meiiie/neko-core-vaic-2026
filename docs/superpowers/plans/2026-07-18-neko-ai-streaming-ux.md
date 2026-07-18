# Neko AI Streaming UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a minimal teacher Neko dock with exactly three visible model routes, in-place Gemma loading, official browser ChatGPT OAuth, true end-to-end streaming and honest TTFT/TPOT telemetry.

**Architecture:** Keep the deterministic educational core and agent loop authoritative. Extend the existing provider port only with result metadata needed by the UI, stream Codex App Server deltas through a narrow Fastify SSE envelope, and measure browser-observed timing in one pure telemetry utility. The selectable providers are Ollama, WebLLM Gemma and managed ChatGPT; the rule provider becomes an internal fail-soft adapter.

**Tech Stack:** React 19, TypeScript, Fastify 5, Codex App Server JSON-RPC, Web Streams/SSE, WebLLM, Vitest, existing CSS variables.

**Design spec:** `docs/superpowers/specs/2026-07-18-neko-ai-streaming-ux-design.md`

---

## Chunk 1: Streaming and telemetry contracts

### Task 1: Add deterministic generation telemetry

**Files:**
- Create: `src/services/agent/generation-telemetry.ts`
- Create: `src/services/agent/generation-telemetry.test.ts`

- [ ] **Step 1: Write failing fake-clock tests**

Cover first-delta idempotence, first-flush idempotence, total/TTFT/stream duration, upper-median
p50, nearest-rank p99, max ITL, TPOT and throughput. Cover one/no delta and unavailable usage.

```ts
const clock = sequenceClock([0, 120, 150, 180, 300]);
const telemetry = new GenerationTelemetry(clock);
telemetry.recordDelta();
telemetry.recordFlush();
telemetry.recordDelta();
expect(telemetry.finish({ inputTokens: 10, outputTokens: 7 })).toMatchObject({
  ttftMs: 120,
  firstFlushMs: 150,
  streamMs: 60,
  outputTokens: 7,
  tpotMs: 10,
  tokensPerSecond: 100,
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/services/agent/generation-telemetry.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure observer**

Use `performance.now` by default and an injected `() => number` in tests. Store only numeric
timestamps/intervals. Return the exact `GenerationMetrics` contract from the design spec. Do not
estimate token counts.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- src/services/agent/generation-telemetry.test.ts`

Expected: PASS.

### Task 2: Carry visible-generation usage and fallback state through the agent loop

**Files:**
- Modify: `src/services/agent/loop.ts`
- Modify: `src/services/agent/session-controller.ts`
- Modify: `src/services/agent/session-controller.test.ts`
- Modify: `src/services/agent/providers.ts`
- Modify: `src/services/agent/agent.test.ts`
- Modify: `src/services/agent/webllm-provider.ts`
- Modify: `src/services/agent/webllm-provider.test.ts`

- [ ] **Step 1: Add failing provider/loop tests**

Verify that:

- aggregate session usage still includes every provider step;
- `displayUsage` comes only from the final visible completion;
- pre-evidence tool selection is performed deterministically and is not called a provider failure;
- after evidence exists, a non-abort synthesis-provider error delegates to `RuleBasedProvider`
  and marks the completion `fallback: true`;
- abort is never converted into fallback;
- local/WebLLM tool-envelope generation does not emit raw JSON to the visible delta hook.

- [ ] **Step 2: Run focused tests and verify the new assertions fail**

Run: `npm test -- src/services/agent/agent.test.ts src/services/agent/session-controller.test.ts src/services/agent/webllm-provider.test.ts`

- [ ] **Step 3: Make the smallest contract extension**

Add optional `modelId` and `fallback` to `AgentCompletion`; add `displayUsage`, `modelId` and
`fallback` to `AgentTurnResult`; return the same metadata from `AgentSessionController.run`.

Implement a thin `DeterministicFirstProvider` that uses the rule provider for pre-evidence tool
selection. It calls the selected model only after current-turn or compacted contextual evidence is
present. Only a post-evidence, non-abort model failure delegates to the rule renderer and marks
`fallback: true`. It preserves the selected provider's ID/label and disposes only the primary.

Expose deltas from OpenAI-compatible local and WebLLM providers only after tool evidence exists,
so a JSON tool envelope cannot flash in the transcript.

- [ ] **Step 4: Limit visible providers**

Export exactly three entries from `AGENT_PROVIDERS`: wrapped Ollama `local`, wrapped WebLLM `web`
and wrapped managed ChatGPT `chatgpt`. Keep one internal/exported rule fallback instance. Remove
the Responses provider import from this selection module without deleting the separately tested
server Responses endpoint.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/services/agent`

Expected: PASS.

---

## Chunk 2: Official ChatGPT browser OAuth and true SSE

### Task 3: Extend the Codex App Server adapter

**Files:**
- Modify: `server/ai/codex-app-server.ts`
- Modify: `server/ai/codex-app-server.test.ts`
- Modify: `server/ai/codex-account-manager.ts`
- Create: `server/ai/codex-account-manager.test.ts`
- Modify: `server/ai/codex-routes.ts`
- Modify: `server/app.test.ts`

- [ ] **Step 1: Rewrite the fake transport expectations first**

The fake App Server must support:

```ts
account/login/start -> { type: 'chatgpt', loginId, authUrl }
model/list -> { data: [{ id, model, displayName, hidden, isDefault }], nextCursor: null }
thread/tokenUsage/updated -> tokenUsage.last
item/agentMessage/delta -> two deltas before turn/completed
```

Assert browser OAuth is requested, `gpt-5.5` is selected only when catalogued, the default catalog
model is used otherwise, usage is returned, and abort still interrupts immediately.

In the account-manager test, create a temporary isolated root, reproduce the hashed account child,
call logout, and assert only that account directory is removed. Never create or inspect a real
Codex credential file.

- [ ] **Step 2: Run the Codex/server tests and verify failure**

Run: `npm test -- server/ai/codex-app-server.test.ts server/ai/codex-account-manager.test.ts server/app.test.ts`

- [ ] **Step 3: Implement browser OAuth and catalog selection**

Replace `startDeviceLogin` with `startBrowserLogin`. Add typed model-list parsing and a pure model
selector. With no explicit server override, select `gpt-5.5` when catalogued, otherwise the
catalog's `isDefault` model, then the first visible catalog model. If the operator explicitly sets
`NEKOPATH_CODEX_MODEL`, reject it when absent from the account catalog; never silently substitute
another model for an explicit request. Reject an empty catalog.

Keep login/token storage in the isolated account `CODEX_HOME`; do not read or expose credential
files.

- [ ] **Step 4: Capture usage per active turn**

Track the one active turn for an account client. On `thread/tokenUsage/updated`, copy only numeric
`last.inputTokens`, `last.outputTokens`, `last.cachedInputTokens`. Clear turn deltas, usage and
completion state in `finally`, abort and dispose paths.

- [ ] **Step 5: Stream Fastify SSE**

Change `POST /api/ai/chatgpt/complete` to validate and authenticate before hijacking the response.
Emit `meta`, `delta`, `usage`, `done`, or bounded `error` events. Set `Cache-Control: no-cache,
no-transform`, `Connection: keep-alive` and `X-Accel-Buffering: no`. Interrupt the Codex turn on
client disconnect.

Add one real-listener route test with a controllable fake manager: hold completion open, read the
first SSE `delta` from `fetch`, and assert it arrives before the completion promise is released.
Cancel the reader/connection and assert the manager's AbortSignal is aborted.

- [ ] **Step 6: Verify focused server tests**

Run: `npm test -- server/ai/codex-app-server.test.ts server/ai/codex-account-manager.test.ts server/app.test.ts`

Expected: PASS, including teacher-only access, browser OAuth, SSE order and logout disposal.

### Task 4: Parse the managed ChatGPT SSE stream in the browser

**Files:**
- Modify: `src/services/agent/chatgpt-provider.ts`
- Modify: `src/services/agent/chatgpt-provider.test.ts`

- [ ] **Step 1: Add failing parser tests**

Cover fragmented records, CRLF, multiple `data:` lines, final event without trailing newline,
delta ordering, usage, model metadata, post-header error and AbortSignal propagation.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/services/agent/chatgpt-provider.test.ts`

- [ ] **Step 3: Implement the narrow SSE reader**

Parse records incrementally with `TextDecoder`; never parse by network chunk. Forward only `delta`
text to `onDelta`, aggregate content, attach reported usage/model to `AgentCompletion`, and reject
bounded error events.

Replace the device login response with `{ loginId, authUrl }` and leave status polling unchanged.

- [ ] **Step 4: Run the focused test**

Run: `npm test -- src/services/agent/chatgpt-provider.test.ts`

Expected: PASS.

---

## Chunk 3: Minimal NekoDock interaction and visual refinement

### Task 5: Simplify the NekoDock lifecycle

**Files:**
- Modify: `src/components/NekoDock.tsx`
- Modify: `src/components/NekoDock.test.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/app/session.test.tsx`
- Modify: `src/services/agent/agent-lifecycle.test.ts`

- [ ] **Step 1: Add failing component assertions**

Verify:

- the select label is “Mô hình” and options are exactly Local/Ollama, Gemma/on-device and ChatGPT;
- “Cục bộ tức thời”, “OpenAI Responses” and the removed Gemma navigation message are absent;
- selecting uncached Gemma succeeds without a cache gate;
- selecting signed-out ChatGPT synchronously opens a placeholder, navigates it to `authUrl`, and
  offers one status plus “Kiểm tra đăng nhập”;
- a failed login request closes the placeholder;
- completion renders the compact metric line and fallback renders total only;
- raw tool args/result JSON are absent from the trace disclosure.
- closing the dock aborts an active turn without calling ChatGPT/NekoPath logout;
- NekoPath logout aborts/disposes controllers and clears that account's saved sessions.
- a deferred delta/completion released after Stop, provider switch, dock close or logout cannot
  append transcript text or write a saved session.

- [ ] **Step 2: Run the component test and verify failure**

Run: `npm test -- src/components/NekoDock.test.tsx src/app/session.test.tsx src/services/agent/agent-lifecycle.test.ts`

- [ ] **Step 3: Implement the three-choice model flow**

Default to `local`. Remove the WebLLM cache-selection guard and let its existing progress listener
report initialization in place. Use browser OAuth with a synchronously opened placeholder and a
manual auth link only when popup navigation is unavailable.

Reduce suggestions to three high-value teacher questions. Replace raw trace strings with neutral
tool labels and success/error lifecycle text.

- [ ] **Step 4: Add frame-batched visible streaming**

Create a per-turn `GenerationTelemetry`, record arrival before buffering, and flush the buffered
text at most once per `requestAnimationFrame`. Flush pending text only on successful completion.
Abort, provider switch, logout, dock close and unmount cancel the frame and discard buffered text.
Late deltas cannot update the transcript or storage. Do not smooth-scroll while busy or when
reduced motion is requested.

Commit final message, trace and metrics once; clear the live region after commit. Use lifecycle
copy for preparing, evidence checking, streaming, error and interruption.

- [ ] **Step 5: Refine CSS without new dependencies**

Use the existing warm-paper tokens. Remove decorative assistant bubbles and redundant footer copy;
use one quiet assistant surface, one compact model row, tabular metric numerals, 44 px controls,
visible focus and static reduced-motion behavior. Keep desktop and mobile panel geometry intact.

- [ ] **Step 6: Run component and accessibility-adjacent tests**

Run: `npm test -- src/components/NekoDock.test.tsx src/app/session.test.tsx src/services/agent/agent-lifecycle.test.ts src/services/agent/generation-telemetry.test.ts`

Expected: PASS.

---

## Chunk 4: Integration verification

### Task 6: Run the complete automated gate

**Files:**
- Modify only if a check exposes a defect directly caused by this plan.

- [ ] **Step 1: Format owned changes**

Run: `npx prettier --write src/components/NekoDock.tsx src/components/NekoDock.test.tsx src/services/agent server/ai server/app.test.ts src/styles/global.css docs/superpowers/specs/2026-07-18-neko-ai-streaming-ux-design.md docs/superpowers/plans/2026-07-18-neko-ai-streaming-ux.md`

- [ ] **Step 2: Run repository gates**

Run, in order:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval
npm run build
```

Expected: all pass; existing deterministic An/Bình/Chi/Minh outcomes remain unchanged.

- [ ] **Step 3: Inspect the final diff and secret surface**

Run:

```powershell
git diff --check
git diff --stat origin/main...HEAD
rg -n "sk-[A-Za-z0-9]|accessToken|refreshToken|chatgpt.com/backend-api" src server docs/superpowers
```

Expected: no whitespace errors, no credential value, no private ChatGPT endpoint.

### Task 7: Verify the real local experience

**Files:**
- No source change unless the walkthrough finds a reproducible defect.

- [ ] **Step 1: Restart local services with managed ChatGPT enabled**

Run the existing Fastify service with `NEKOPATH_CODEX_APP_SERVER_ENABLED=1`, then Vite on
`127.0.0.1:5173`. Keep credentials out of command output.

- [ ] **Step 2: Browser walkthrough**

At `/teacher`:

1. open Neko and confirm exactly three model options;
2. use Local with Ollama absent and verify the pre-evidence route remains deterministic, then the
   post-evidence synthesis failure is visibly marked as a deterministic fallback;
3. select Gemma uncached and verify in-place load progress with no dead navigation message;
4. select ChatGPT and verify browser OAuth opens without the device-code security error;
5. after the user completes OAuth, ask a grounded question and observe text before completion;
6. inspect TTFT/total and expanded TPOT/ITL only when usage exists;
7. stop a turn and confirm no late text;
8. close/reopen the dock and confirm auth remains;
9. log out of NekoPath and confirm agent session cleanup.

- [ ] **Step 3: Responsive/reduced-motion check**

Repeat the core dock flow at 390×844 and with reduced motion. Confirm no horizontal overflow,
hidden primary control, repeated smooth-scroll animation or console error.

- [ ] **Step 4: Commit implementation intentionally**

Stage only plan-owned source/tests/docs and commit with:

```powershell
git commit -m "feat(ai): streamline Neko streaming experience"
```

Do not stage `lab/` or `labs/ux-audit/live-site-2026-07-18/`.
