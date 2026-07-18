# Login Startup Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound every login-critical network wait, provide an immediate meaningful startup state, and recover cleanly from slow auth, directory, sign-in, and stale-shell conditions.

**Architecture:** Keep the existing React session API and Fastify endpoints. Add one abortable `fetchWithDeadline` primitive, use it at the three auth request boundaries, render a branded session boot component, and pass pre-workspace state into the existing Workbox update prompt. Preserve authoritative `401` handling and use cached identity only for network, timeout, or server degradation.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vitest 4, Testing Library, Vite 8, vite-plugin-pwa/Workbox.

---

## File map

- Create `src/services/fetch-with-deadline.ts`: one transport primitive that combines caller cancellation with a request deadline and cleans up all listeners/timers.
- Create `src/services/fetch-with-deadline.test.ts`: deterministic timeout, caller-abort, success, and cleanup tests.
- Modify `src/app/session.tsx`: apply 3 s restore and 8 s sign-in deadlines without changing the public session contract.
- Modify `src/app/session.test.tsx`: prove timeout fallback, authoritative `401`, abort-on-unmount, and sign-in timeout copy.
- Modify `src/app/pages/LoginPage.tsx`: explicit bounded directory attempts and in-place retry.
- Modify `src/app/App.test.tsx`: prove directory timeout/retry, retained login selection, and startup accessibility.
- Modify `src/app/App.tsx`: reusable branded pre-session boot state and explicit pre-workspace flag for service-worker updates.
- Modify `src/styles/global.css`: startup presentation using existing tokens and reduced-motion policy.
- Modify `src/features/pwa-status/UpdatePrompt.tsx`: auto-apply waiting updates only before an active workspace.
- Create `src/features/pwa-status/UpdatePrompt.test.tsx`: prove automatic versus user-controlled update behavior.

### Task 1: Add the bounded fetch primitive

**Files:**
- Create: `src/services/fetch-with-deadline.ts`
- Create: `src/services/fetch-with-deadline.test.ts`

- [ ] **Step 1: Write failing tests for success, timeout, caller abort, and cleanup**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithDeadline } from './fetch-with-deadline';

function abortAwarePendingFetch() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }),
  );
}

describe('fetchWithDeadline', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns a successful response and clears its deadline timer', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const response = new Response('{}', { status: 200 });
    vi.stubGlobal('fetch', vi.fn(async () => response));

    await expect(fetchWithDeadline('/ok', { deadlineMs: 3_000 })).resolves.toBe(response);
    expect(clearTimeoutSpy).toHaveBeenCalledOnce();
  });

  it('aborts a request when its deadline expires', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', abortAwarePendingFetch());
    const request = fetchWithDeadline('/slow', { deadlineMs: 3_000 });

    await vi.advanceTimersByTimeAsync(3_000);
    await expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('propagates caller cancellation before the deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', abortAwarePendingFetch());
    const caller = new AbortController();
    const request = fetchWithDeadline('/cancelled', {
      deadlineMs: 3_000,
      signal: caller.signal,
    });

    caller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test -- src/services/fetch-with-deadline.test.ts`

Expected: FAIL because `./fetch-with-deadline` does not exist.

- [ ] **Step 3: Implement the minimal abortable deadline helper**

```ts
export interface FetchWithDeadlineInit extends RequestInit {
  readonly deadlineMs: number;
}

export async function fetchWithDeadline(
  input: RequestInfo | URL,
  { deadlineMs, signal: callerSignal, ...init }: FetchWithDeadlineInit,
): Promise<Response> {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) onCallerAbort();
  else callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

  const timer = globalThis.setTimeout(() => {
    controller.abort(new DOMException('Request deadline exceeded', 'TimeoutError'));
  }, deadlineMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test -- src/services/fetch-with-deadline.test.ts`

Expected: 3 tests pass with no unhandled rejection.

- [ ] **Step 5: Commit the transport primitive**

```powershell
git add src/services/fetch-with-deadline.ts src/services/fetch-with-deadline.test.ts
git commit -m "feat(auth): bound critical fetch requests"
```

### Task 2: Bound session restoration and sign-in

**Files:**
- Modify: `src/app/session.tsx`
- Modify: `src/app/session.test.tsx`

- [ ] **Step 1: Add failing session timeout and authoritative-401 tests**

Add an abort-aware pending `/api/auth/me` stub, use fake timers, and assert the exact transitions:

```ts
it('stops restoring after three seconds and falls back to cached identity', async () => {
  vi.useFakeTimers();
  window.localStorage.setItem('nekopath.session-cache.v1', JSON.stringify(CACHED_AN));
  vi.stubGlobal('fetch', abortAwarePendingFetch());

  render(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByTestId('ready').textContent).toBe('false');
  await vi.advanceTimersByTimeAsync(3_000);

  expect(screen.getByTestId('ready').textContent).toBe('true');
  expect(screen.getByTestId('who').textContent).toBe('STUDENT:An');
});

it('clears cached identity when the server authoritatively returns 401', async () => {
  window.localStorage.setItem('nekopath.session-cache.v1', JSON.stringify(CACHED_AN));
  installApiStub(null);
  render(<SessionProvider><Probe /></SessionProvider>);

  await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
  expect(screen.getByTestId('who').textContent).toBe('none');
  expect(window.localStorage.getItem('nekopath.session-cache.v1')).toBeNull();
});

it('returns an actionable message when sign-in reaches its deadline', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', abortAwarePendingFetch());
  render(<SessionProvider><Probe /></SessionProvider>);
  await vi.advanceTimersByTimeAsync(3_000);

  screen.getByRole('button', { name: 'in-good' }).click();
  await vi.advanceTimersByTimeAsync(8_000);
  expect((await screen.findByTestId('sign-in-error')).textContent).toBe(
    'Đăng nhập mất quá nhiều thời gian. Vui lòng thử lại.',
  );
});
```

Extend `Probe` with a `signInError` state and `<output data-testid="sign-in-error">`, reset timers in `afterEach`, use one shared `CACHED_AN` object, and add a test that unmounts while restore is pending and asserts the captured request signal becomes aborted.

- [ ] **Step 2: Run the session tests and verify RED**

Run: `npm run test -- src/app/session.test.tsx`

Expected: the timeout test remains `ready=false` because the existing fetch has no deadline.

- [ ] **Step 3: Apply the restore and sign-in deadlines**

Import the helper and add explicit constants:

```ts
import { fetchWithDeadline } from '../services/fetch-with-deadline';

export const SESSION_RESTORE_DEADLINE_MS = 3_000;
export const SIGN_IN_DEADLINE_MS = 8_000;
```

Use an unmount controller for restoration:

```ts
useEffect(() => {
  let cancelled = false;
  const lifecycle = new AbortController();
  void (async () => {
    try {
      const response = await fetchWithDeadline('/api/auth/me', {
        credentials: 'include',
        deadlineMs: SESSION_RESTORE_DEADLINE_MS,
        signal: lifecycle.signal,
      });
      if (cancelled) return;
      // Keep the existing 2xx, 401, and 5xx branches unchanged.
    } catch {
      if (!cancelled) setAccount(readCache());
    } finally {
      if (!cancelled) setReady(true);
    }
  })();
  return () => {
    cancelled = true;
    lifecycle.abort();
  };
}, []);
```

Call `fetchWithDeadline` in `signIn` with `deadlineMs: SIGN_IN_DEADLINE_MS`. In its catch branch, distinguish `TimeoutError`:

```ts
if (error instanceof DOMException && error.name === 'TimeoutError') {
  return 'Đăng nhập mất quá nhiều thời gian. Vui lòng thử lại.';
}
return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
```

- [ ] **Step 4: Run session and helper tests and verify GREEN**

Run: `npm run test -- src/app/session.test.tsx src/services/fetch-with-deadline.test.ts`

Expected: all focused tests pass, including timeout fallback, `401` cache clearing, and unmount abort.

- [ ] **Step 5: Commit session resilience**

```powershell
git add src/app/session.tsx src/app/session.test.tsx
git commit -m "fix(auth): bound session restoration"
```

### Task 3: Add bounded directory loading and in-place retry

**Files:**
- Modify: `src/app/pages/LoginPage.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing timeout and retry tests**

Create one fetch stub that returns `401` for `/api/auth/me`, stalls the first directory request until aborted, and succeeds on the second directory request. The test must assert that retry does not call `window.location.reload`:

```ts
it('bounds class-directory loading and retries in place', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  let directoryAttempts = 0;
  vi.stubGlobal('fetch', abortAwareAuthFetch(() => {
    directoryAttempts += 1;
    return directoryAttempts === 1
      ? 'pending-until-abort'
      : new Response(JSON.stringify({ accounts: STUB_DIRECTORY }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
  }));

  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(screen.getByRole('alert').textContent).toContain('Không tải được danh sách lớp');

  await user.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('combobox', { name: 'Chọn tên của bạn' })).toBeTruthy();
  expect(directoryAttempts).toBe(2);
});
```

The second directory response proves recovery occurred inside the same mounted App instance; the production retry handler must not reference `window.location.reload`.

- [ ] **Step 2: Run the focused App test and verify RED**

Run: `npm run test -- src/app/App.test.tsx -t "bounds class-directory"`

Expected: FAIL because the current directory request never times out and retry reloads the document.

- [ ] **Step 3: Implement explicit directory attempt state**

Import the helper and add:

```ts
const DIRECTORY_DEADLINE_MS = 3_000;
type DirectoryState = 'loading' | 'retrying' | 'ready' | 'error';

const [directoryState, setDirectoryState] = useState<DirectoryState>('loading');
const [directoryAttempt, setDirectoryAttempt] = useState(0);
```

Replace the existing directory effect with a lifecycle-aborted bounded request. Set `ready` after a successful JSON response and `error` after timeout, transport failure, or a non-2xx response. When `directoryAttempt > 0`, keep the retry button mounted and disabled while the request is `retrying` so keyboard focus is not discarded.

```ts
function retryDirectory() {
  if (directoryState === 'retrying') return;
  setDirectoryState('retrying');
  setDirectoryAttempt((attempt) => attempt + 1);
}
```

Render `Đang thử lại…` in the disabled retry button during a retry. Do not clear `selected`, `query`, or the sign-in error when retrying the directory.

- [ ] **Step 4: Run the App tests and verify GREEN**

Run: `npm run test -- src/app/App.test.tsx`

Expected: the new timeout/retry test and all existing login, role, and mobile drawer tests pass.

- [ ] **Step 5: Commit directory recovery**

```powershell
git add src/app/pages/LoginPage.tsx src/app/App.test.tsx
git commit -m "fix(login): recover from stalled class directory"
```

### Task 4: Replace the blank session guard with a branded startup state

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing accessibility test**

```ts
it('shows a meaningful branded status while session restoration is pending', () => {
  vi.stubGlobal('fetch', abortAwarePendingFetch());
  render(<MemoryRouter initialEntries={['/teacher']}><App /></MemoryRouter>);

  const status = screen.getByRole('status');
  expect(status.textContent).toContain('NekoPath');
  expect(status.textContent).toContain('Đang mở không gian học tập');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test -- src/app/App.test.tsx -t "meaningful branded status"`

Expected: FAIL because the current guard is an empty generic element with only an aria-label.

- [ ] **Step 3: Implement one reused `SessionStartup` component**

In `src/app/App.tsx`, import `BrandMark` and add:

```tsx
function SessionStartup() {
  return (
    <main className="session-startup">
      <div className="session-startup__card" role="status" aria-live="polite">
        <div className="session-startup__brand">
          <BrandMark size={40} />
          <strong>NekoPath</strong>
        </div>
        <p>Đang mở không gian học tập…</p>
        <span className="session-startup__progress" aria-hidden="true" />
      </div>
    </main>
  );
}
```

Return `<SessionStartup />` from all three `!ready` session guard branches. Do not replace lazy-route `Suspense` fallbacks or feature loading states.

Add CSS using existing variables only:

```css
.session-startup {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: var(--s-4);
  background: var(--canvas);
}

.session-startup__card {
  width: min(100%, 24rem);
  padding: var(--s-8);
  border: 1px solid var(--rule);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.session-startup__brand {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}

.session-startup__card > p {
  margin: var(--s-5) 0 var(--s-3);
  color: var(--muted-strong);
}

.session-startup__progress {
  display: block;
  overflow: hidden;
  height: 0.25rem;
  border-radius: 999px;
  background: var(--surface-subtle);
}

.session-startup__progress::after {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  content: '';
  animation: session-startup-progress 1.2s ease-in-out infinite alternate;
}

@keyframes session-startup-progress {
  to { transform: translateX(150%); }
}

@media (prefers-reduced-motion: reduce) {
  .session-startup__progress::after { animation: none; }
}
```

Every referenced variable already exists in the `:root` token set; do not add a parallel color, shadow, radius, or spacing token.

- [ ] **Step 4: Run App tests, typecheck, and CSS formatting**

Run: `npm run test -- src/app/App.test.tsx; npm run typecheck; npm run format:check`

Expected: all commands exit 0 and the status has a single accessible announcement.

- [ ] **Step 5: Commit startup presentation**

```powershell
git add src/app/App.tsx src/app/App.test.tsx src/styles/global.css
git commit -m "feat(login): show resilient startup state"
```

### Task 5: Apply waiting service-worker updates before workspace entry

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/pwa-status/UpdatePrompt.tsx`
- Create: `src/features/pwa-status/UpdatePrompt.test.tsx`

- [ ] **Step 1: Write failing update-boundary tests**

Mock `virtual:pwa-register/react` with `needRefresh=true` and a shared `updateServiceWorker` spy. Test both props:

```tsx
it('auto-applies a waiting update before a workspace becomes active', async () => {
  render(<MemoryRouter><UpdatePrompt preWorkspace /></MemoryRouter>);
  await waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('keeps updates user-controlled inside an active workspace', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><UpdatePrompt preWorkspace={false} /></MemoryRouter>);
  expect(updateServiceWorker).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Cập nhật ngay' }));
  expect(updateServiceWorker).toHaveBeenCalledWith(true);
});
```

- [ ] **Step 2: Run the update test and verify RED**

Run: `npm run test -- src/features/pwa-status/UpdatePrompt.test.tsx`

Expected: FAIL because `UpdatePrompt` has no `preWorkspace` prop and only checks `/login`.

- [ ] **Step 3: Pass explicit session state into the update prompt**

Change the component signature and policy:

```tsx
export function UpdatePrompt({ preWorkspace }: { preWorkspace: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (needRefresh && preWorkspace) void updateServiceWorker(true);
  }, [needRefresh, preWorkspace, updateServiceWorker]);

  if (!needRefresh || preWorkspace) return null;
  // Keep the existing alertdialog and buttons unchanged.
}
```

In `App.tsx`, create `AppContent` inside `SessionProvider`, read `{ account, ready }`, and render:

```tsx
<UpdatePrompt preWorkspace={!ready || account === null} />
```

Keep the route tree unchanged inside `AppContent`.

- [ ] **Step 4: Run update, App, and session tests and verify GREEN**

Run: `npm run test -- src/features/pwa-status/UpdatePrompt.test.tsx src/app/App.test.tsx src/app/session.test.tsx`

Expected: update auto-apply/user-control tests and all auth flow tests pass.

- [ ] **Step 5: Commit the stale-shell boundary**

```powershell
git add src/app/App.tsx src/features/pwa-status/UpdatePrompt.tsx src/features/pwa-status/UpdatePrompt.test.tsx
git commit -m "fix(pwa): update stale pre-workspace shells"
```

### Task 6: Full verification, PR, CI, and merge

**Files:**
- Verify all changed files
- Update plan checkboxes while executing

- [ ] **Step 1: Install and verify with the required runtime**

Confirm `node --version` prints `v24.18.0`. Then run:

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval
npm run build
```

Expected: every command exits 0; no lockfile diff is produced by `npm ci`.

- [ ] **Step 2: Run browser acceptance at desktop and 390×844**

Start `npm run server` and `npm run dev` using Node 24.18.0. Verify:

1. `/` shows the branded startup state before routing.
2. Normal restore reaches `/login`, `/student`, or `/teacher` without blank content.
3. A deliberately stalled auth stub exits startup by 3,000 ms.
4. A stalled directory reaches its retry state by 3,000 ms and recovers in place.
5. Login at desktop and 390×844 has no overflow, console error, or lost keyboard access.
6. Offline restore uses a confirmed cached identity; an online `401` clears it.

Save before/after screenshots under `labs/ux-audit/login-startup-2026-07-18/` only if they materially document the changed state.

- [ ] **Step 3: Review the final diff for scope and secrets**

Run:

```powershell
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git status --short
rg -n "BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|api[_-]?key|secret|token" src docs/superpowers
```

Expected: only the planned auth/startup/PWA files and documentation differ; the secret scan finds no credential material.

- [ ] **Step 4: Commit plan checkbox updates and push the branch**

```powershell
git add docs/superpowers/plans/2026-07-18-login-startup-resilience.md
git commit -m "docs(auth): record login resilience execution"
git push -u origin codex/login-startup-resilience
```

- [ ] **Step 5: Open the pull request**

```powershell
gh pr create --base main --head codex/login-startup-resilience --title "fix(auth): bound login startup and recovery" --body "Bounds session, directory, and sign-in waits; adds an accessible branded startup state; preserves authoritative 401 handling and offline fallback; and updates stale shells before workspace entry. Includes deterministic stalled-request tests and full repository verification."
```

Expected: GitHub returns a PR URL targeting `main`.

- [ ] **Step 6: Wait for CI and inspect review state**

```powershell
gh pr checks --watch
gh pr view --json mergeable,reviewDecision,statusCheckRollup,url
```

Expected: all required checks are successful, `mergeable` is `MERGEABLE`, and there is no blocking review decision.

- [ ] **Step 7: Merge only after the gate is green**

```powershell
gh pr merge --merge --delete-branch
git fetch origin --prune
git log origin/main -1 --oneline --decorate
```

Expected: the PR is merged into `main`, the remote feature branch is deleted, and `origin/main` points to the merge commit.
