# NekoPath login startup resilience design

**Date:** 2026-07-18
**Status:** Approved
**Base:** `origin/main@233abdc` (`v0.4.0`)

## 1. Problem

NekoPath blocks protected routes while `SessionProvider` waits for
`GET /api/auth/me`. The request has no deadline. If the browser, edge, origin, or
network leaves that request pending, `ready` never becomes `true` and the user
remains on “Đang khôi phục phiên làm việc” indefinitely. The class directory and
login request have the same unbounded-request failure mode.

This is a tail-latency and recovery defect, not a consistently slow backend.
Ten production samples on 2026-07-18 measured approximately:

| Request | Observed p95 total time |
|---|---:|
| document `/` | 616 ms |
| edge `/api/auth/me` | 386 ms |
| edge `/api/auth/directory` | 565 ms |
| origin `/api/auth/me` | 468 ms |

The normal path is already fast enough for this MVP. The missing invariant is
that every startup dependency must settle into a usable product state within a
bounded time.

## 2. Goals

1. No authentication or directory request can hold the UI indefinitely.
2. A user sees a meaningful NekoPath startup state immediately instead of a
   visually empty shimmer.
3. A failed session check preserves the offline-first contract without showing
   a stale cached identity after an authoritative `401`.
4. Login recovery is local and explicit: keep the selected account, explain the
   failure, and offer one deliberate retry.
5. A stale service-worker shell can update before the user enters a workspace.
6. The behavior is proven by deterministic tests that include never-settling
   network requests.

## 3. Non-goals

- No authentication redesign, JWT, OAuth provider, or new backend service.
- No data-fetching framework or router migration.
- No visual redesign of the login card, typography, colors, or navigation.
- No automatic retry loop, background polling, or cached API response in the
  service worker.
- No immediate cache-first workspace rendering that could expose the previous
  account on a shared device.

## 4. Considered approaches

### A. Bounded startup state machine — selected

Give session restoration, directory loading, and login explicit deadlines and
recovery states. Abort obsolete work on unmount. Preserve cached identity only
for timeout, network failure, or server failure; an authoritative `401` clears
it. This keeps the current PWA and server architecture while bounding the bad
tail.

### B. Cache-first session restoration — rejected

Rendering the cached workspace before server verification is faster, but a
shared classroom device could briefly show the previous account. That privacy
and correctness risk is not justified by the measured normal latency.

### C. Server-bootstrapped identity — rejected

Embedding identity into the HTML or making the edge redirect by session would
remove one client request, but it couples the static app shell to online auth,
complicates Workbox caching, and weakens the offline-first boundary.

## 5. Architecture

### 5.1 Bounded request primitive

Add one small request helper under `src/services/` because the same cancellation
contract is used by session restoration, directory loading, and login.

The helper:

- accepts the normal `fetch` input/options plus a deadline;
- combines the deadline with an optional caller cancellation signal;
- aborts the underlying request when either condition fires;
- clears timers and listeners in every completion path;
- preserves the native response and error rather than inventing a transport
  result abstraction.

The implementation must remain compatible with the project's supported modern
PWA browsers. Tests use fake timers and an abort-aware fetch stub so they do not
wait in real time.

### 5.2 Session restoration

`SessionProvider` keeps the existing `account` and `ready` public contract.
Internally, restoration becomes a bounded transition:

```text
RESTORING
  ├─ 2xx -> AUTHENTICATED + refresh cache
  ├─ 401 -> ANONYMOUS + clear cache
  ├─ 5xx/network/timeout -> cached account when present, otherwise ANONYMOUS
  └─ unmount -> abort with no state update
```

The session deadline is **3,000 ms**. Current p95 is below 500 ms, so this gives
substantial variance room while ensuring the product exits the blocked state
before an indefinite wait becomes the experience.

`ready` becomes `true` in all settled non-unmount branches. No automatic retry
is made. A later user navigation or explicit login action establishes a fresh
request boundary.

### 5.3 Startup presentation

Replace the anonymous `.page-loading` session guard with one reusable startup
component used by all session/role guard paths. It uses the existing `BrandMark`,
CSS variables, type scale, spacing, reduced-motion rules, and semantic status
colors. It contains:

- NekoPath brand;
- “Đang mở không gian học tập…” as visible text;
- a polite live status for assistive technology;
- a compact progress treatment that does not imply a percentage.

It does not add a new route, image, icon set, or layout language. Lazy feature
chunks keep their existing route-specific loading states.

### 5.4 Class directory

`LoginPage` loads `/api/auth/directory` with the same 3,000 ms deadline and an
explicit `loading | ready | error` state.

On error or timeout:

- the login card remains visible;
- the user sees a concise explanation that the first directory load needs a
  connection;
- “Thử lại” starts a new bounded request in place, without reloading the page;
- repeated clicks while loading are ignored;
- an obsolete request is aborted before a retry or unmount.

A successful retry restores the combobox without losing unrelated page state.

### 5.5 Sign-in submission

The credential request receives an **8,000 ms** deadline because it performs
password verification and session creation and is initiated explicitly by the
user. The existing `pending` state continues to prevent duplicate submissions.

Timeout and network failure use actionable Vietnamese copy. The chosen account
stays selected, so retry requires one action. `401` retains the existing
credential error and is never retried automatically.

### 5.6 Service-worker update boundary

The current Workbox prompt auto-applies an update only on `/login`. Extend that
policy to any pre-workspace state where there is no active account. An active
student diagnostic or teacher workspace still receives the existing explicit
update prompt and is never silently reloaded.

API requests remain excluded from Workbox navigation and runtime caching. The
service worker must not cache `/api/auth/**`.

## 6. User flow

### New or signed-out visitor

1. The brand startup state appears immediately on `/`.
2. `/api/auth/me` succeeds with `401` or reaches its 3-second deadline.
3. The app routes to `/login`.
4. The login card appears independently of the directory request.
5. The directory appears, or an in-card retry state replaces its loading line.

### Returning online visitor

1. The brand startup state appears.
2. A valid `/api/auth/me` response routes to the correct workspace.
3. The account cache is refreshed.

### Returning offline or degraded visitor

1. The session probe fails or times out within 3 seconds.
2. A previously confirmed cached account opens its local-first workspace.
3. Existing offline/sync truth labels continue to communicate degraded state.

### Shared device with an expired server session

1. The server returns `401`.
2. Cached identity is cleared, even if it exists.
3. The user is routed to login; no previous workspace is shown.

## 7. Accessibility and motion

- Startup and retry messages are real text, not an aria-label on an empty box.
- Loading uses `role="status"`/polite announcement; failures use `role="alert"`.
- Retry and submit controls keep at least the existing 44 px target size.
- Keyboard focus remains on the current control after a recoverable failure.
- Reduced-motion users receive a static progress treatment.
- The login card continues to reflow at 320 CSS px without horizontal scrolling.

## 8. Verification

### Unit and integration tests

1. Session restore `401` clears cache and reaches anonymous-ready state.
2. Session restore timeout reaches cached-ready or anonymous-ready state within
   the 3-second fake-timer budget.
3. Session unmount aborts the request and produces no late state update.
4. Directory timeout renders an alert and retry control.
5. Directory retry succeeds without a document reload.
6. Sign-in timeout returns actionable copy and keeps the selected account.
7. Pending sign-in cannot issue duplicate requests.
8. Pre-workspace service-worker update auto-applies; active workspace updates
   remain user-controlled.

### Repository gates

Run on Node 24.18.0 LTS:

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval
npm run build
```

### Browser acceptance

- Normal production-like session restore reaches useful content without a
  visible blank page.
- A deliberately stalled session request leaves startup in no more than 3 s.
- A stalled directory request reaches an operable retry state in no more than
  3 s.
- Login works at desktop and 390×844; no overflow, console error, or focus loss.
- Offline reload with a confirmed account still reaches the local workspace.
- A stale pre-workspace service worker applies the update; active work is not
  silently reloaded.

## 9. Success criteria

- Infinite login/session loading is structurally impossible for the three auth
  request paths.
- Normal-path behavior and current authentication semantics remain unchanged.
- No new runtime dependency is added.
- All repository gates and browser acceptance checks pass.
- The PR contains only the bounded startup/login resilience change, its tests,
  and the supporting design/plan documentation.
