# Neko AI Streaming UX — Design Specification

Date: 2026-07-18

Status: approved direction; implementation pending

Scope: the teacher-facing Neko dock only. The adaptive domain core, learner flows, login page,
curriculum content, grouping rules and priority rules do not change.

## 1. Outcome

Neko exposes only three model choices to the teacher:

1. `local` — an OpenAI-compatible model running through local Ollama;
2. `web` — Gemma 3 running in the browser through WebLLM; and
3. `chatgpt` — an account-backed model provided by the official Codex App Server protocol.

The deterministic rule provider remains an internal safety fallback. It is not presented as a
model choice. The OpenAI Responses API provider is removed from this dock's visible and runtime
selection surface.

The dock streams visible answer text end to end, reports honest user-perceived latency, keeps
technical detail quiet by default, and never blocks the teacher on a dead navigation instruction.

## 2. Current failures

- ChatGPT/Codex receives `item/agentMessage/delta` notifications but the Fastify route waits for
  completion and returns one JSON object. Browser TTFT therefore measures the wrong boundary.
- Device-code OAuth can be disabled in a ChatGPT account's security settings. The current UI sends
  the teacher into that blocked flow and provides no useful recovery.
- Selecting uncached Gemma produces a message that points to a separate “Dữ liệu & ngoại tuyến”
  surface instead of completing the model task where the choice was made.
- Five visible provider choices mix implementation fallbacks, local models and remote account
  routes. This makes the footer harder to understand than the teacher's actual decision.
- Every stream delta causes React state and smooth-scroll work, which can create unnecessary
  rendering and motion during long answers.
- No shared contract measures TTFT, completion time, TPOT, throughput or inter-delta continuity.

## 3. Interaction contract

### 3.1 Provider selection

The label is “Mô hình”, not “Bộ não”. The select contains exactly:

- `Local · Ollama`
- `Gemma · Trên thiết bị`
- `ChatGPT · Tài khoản của bạn`

`Local · Ollama` is the initial default because local-server reachability cannot be known without
performing a request. All three choices remain visible. Gemma is selectable before its assets are
cached. ChatGPT is disabled only when the local Codex App Server itself is not enabled; selecting
it while signed out starts the official browser OAuth flow. A missing Ollama server is handled at
request time with a named recovery action and an explicitly marked deterministic fallback.

### 3.2 Gemma first use

Selecting Gemma never redirects. The first question initializes WebLLM in place. The existing
progress callback updates one quiet status line with download/load percentage. The input is locked
only while a turn is active and the Stop action remains available. Once cached, subsequent use can
work offline.

The product does not claim a fixed download size because the selected WebLLM artifact and browser
cache behavior may change. A failed initialization returns one concrete retry message and leaves
the other two providers usable.

### 3.3 ChatGPT login

The primary login method is Codex App Server `account/login/start` with `type: "chatgpt"`.
The selection gesture synchronously opens one blank tab so the browser does not classify the
eventual navigation as an unsolicited popup. Fastify then returns the official `authUrl` and the
UI navigates that tab to it. If login initialization fails, the blank tab is closed. The dock
shows one status and one “Kiểm tra đăng nhập” action until
`account/read` reports `authMode/account.type = chatgpt`.

Device-code is not used by the NekoPath UI. No private ChatGPT endpoint, browser token, copied
cookie or custom OAuth client is introduced. Codex owns token persistence and refresh in the
per-account isolated `CODEX_HOME` directory already implemented by NekoPath.

### 3.4 Streaming state

A turn uses these observable states:

```text
idle -> preparing -> [checking_evidence] -> streaming -> complete
          |                 |                 |
          +-----------------+-----------------+-> error | interrupted
```

- `preparing`: request accepted; no fake typing.
- `checking_evidence`: a deterministic tool is running.
- `streaming`: the first visible content delta has arrived.
- `complete`: final verified answer is committed once.
- `error`/`interrupted`: no late delta or answer can append after the generation is invalidated.

The live assistant message is one stable region. Content deltas are accumulated immediately for
measurement, then flushed to React at most once per animation frame. Smooth scrolling is disabled
during streaming and whenever reduced motion is requested.

## 4. Streaming transport

### 4.1 ChatGPT server route

`POST /api/ai/chatgpt/complete` responds as `text/event-stream` after authentication and request
validation. Its narrow event envelope is:

```text
event: meta
data: {"model":"..."}

event: delta
data: {"text":"..."}

event: usage
data: {"inputTokens":0,"outputTokens":0,"cachedInputTokens":0}

event: done
data: {"ok":true}
```

Errors that occur before the stream starts remain normal HTTP JSON errors. Errors after headers
are sent become `event: error` with a bounded public error code. Prompt, answer and OAuth material
are never logged. Closing the HTTP connection interrupts the Codex turn.

### 4.2 Codex App Server adapter

The adapter forwards `item/agentMessage/delta` immediately. It captures the current turn's latest
`thread/tokenUsage/updated` values and returns them with the final completion. `model/list` supplies
the signed-in account catalog.

The desired ChatGPT model is `gpt-5.5`. It is used only when the account catalog contains it.
Otherwise the catalog's `isDefault` model is used and displayed. Unsupported model identifiers
are rejected server-side rather than silently falling back.

### 4.3 Other providers

Ollama and WebLLM keep their existing streaming transports. Their output goes through the same
turn telemetry observer. Where actual output-token usage is absent, the UI does not invent TPOT or
tokens/second.

## 5. Telemetry contract

Telemetry is measured at the browser/session boundary with a monotonic clock. TTFT is the standard
arrival boundary; a separate first-flush value covers the React commit scheduling boundary without
claiming to observe the browser compositor's actual paint:

```ts
interface GenerationMetrics {
  totalMs: number;
  ttftMs: number | null;
  firstFlushMs: number | null;
  streamMs: number | null;
  outputTokens: number | null;
  tokensPerSecond: number | null;
  tpotMs: number | null;
  chunkCount: number;
  itlP50Ms: number | null;
  itlP99Ms: number | null;
  itlMaxMs: number | null;
  tokenSource: 'provider' | 'unavailable';
}
```

Definitions:

- TTFT = first content delta arrival time − user submission time.
- First flush = first animation-frame callback that commits streamed content − user submission time.
- Total = completion time − user submission time.
- Stream = last content-delta arrival time − first content-delta arrival time.
- TPOT = Stream / (`outputTokens - 1`) only when provider usage reports at least two output tokens.
- Tokens/s = (`outputTokens - 1`) / Stream seconds under the same conditions as TPOT.
- ITL values are computed from content-delta arrival intervals. They are labeled as stream rhythm,
  not token latency, because an SSE delta may contain more than one token.
- With fewer than two content deltas, all ITL values are null. Otherwise intervals are sorted;
  p50 uses the reviewed Grok reference's upper-median index `floor(n / 2)`, while p99 uses
  `min(n - 1, ceil(n * 0.99) - 1)`.

Only `TTFT · tokens/s · total` appears in the answer footer when available. First flush, TPOT,
token count, chunk count and ITL are inside the existing details disclosure. Deterministic/internal
fallback answers show total time only.

Telemetry is content-free. It contains no prompt, response, tool payload, learner name, OAuth
token, cookie or chain-of-thought. This implementation displays per-turn measurements locally; it
does not add analytics or remote reporting.

## 6. Visual direction

The dock follows the existing warm-paper NekoPath constitution. The refinement is restrained,
not decorative:

- one header, one transcript, one composer and one compact model row;
- no provider dashboard, model cards, glowing AI ornament or animated typing dots;
- lifecycle text uses plain Vietnamese and the current semantic evidence/review colors;
- tool calls are summarized as a small lifecycle line and remain inspectable after completion;
- metrics use tabular numerals and muted text;
- controls retain 44 px targets, visible focus and keyboard order;
- motion is limited to direct press feedback and a short opacity transition; reduced motion makes
  updates static.

## 7. Lifecycle and fallback

- Stop aborts provider work and prevents late UI/session writes.
- Switching model aborts the current generation before creating a new scoped controller.
- Logout aborts, disposes WebLLM/Codex, clears the account's persisted agent sessions and removes
  the isolated Codex account directory as already specified.
- A provider failure may use the deterministic renderer internally when evidence has already been
  collected. The answer is marked fallback; the UI does not silently switch the selected model.
- Closing the dock aborts only the active turn; it does not log the teacher out.

## 8. Verification

The smallest success checks are:

1. provider selector renders only Ollama, Gemma and ChatGPT;
2. uncached Gemma selection no longer emits the removed navigation message;
3. ChatGPT login starts browser OAuth and never requests device-code;
4. fragmented SSE, multi-line data, final records without a newline, usage and error events parse;
5. the first content delta sets TTFT once, the first scheduled flush sets first-flush once, and
   completion computes total, TPOT, throughput and the specified ITL ranks with a fake monotonic
   clock;
6. missing provider usage leaves TPOT/TPS absent rather than estimated;
7. ChatGPT delta reaches the browser before Codex turn completion;
8. abort/logout during streaming produces no late transcript or storage write;
9. the active account's catalog selects `gpt-5.5` only when listed;
10. NekoDock works at desktop and 390 px, keyboard-only, reduced motion and without console errors;
11. closing the dock interrupts only the turn and preserves account auth, while NekoPath logout
    disposes providers, removes that account's saved agent sessions and deletes its isolated Codex
    account directory;
12. the full format, lint, typecheck, unit, eval and production-build gates pass.

## 9. Non-goals

- changing the login page or broader teacher dashboard;
- student free-chat;
- exposing deterministic fallback as a selectable model;
- OpenAI API-key configuration in this dock;
- showing hidden reasoning or chain-of-thought;
- adding a UI framework, animation library, analytics SDK or remote telemetry;
- rewriting the agent loop, context compaction or deterministic educational core.
