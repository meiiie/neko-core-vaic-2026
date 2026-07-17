# NekoPath implementation master plan

Status: **execution-ready handoff for Fable 5 and Codex**

Frozen at: **2026-07-17 13:52 ICT**

Official checkpoints: **CP1 2026-07-18 11:00**, **CP2 2026-07-18 23:00**,
**Final 2026-07-19 11:00 ICT**.

This document turns the product contract into one build plan. It is intentionally narrower than
a normal LMS: one judgeable vertical slice, one local-first PWA, one reviewed mathematics wedge,
and one optional server boundary. “Complete” below means complete for the 48-hour proof, not a
claim of whole-curriculum or production-scale coverage.

Read first:

1. `docs/PROBLEM_ANALYSIS.md`
2. `docs/PRODUCT_CONTRACT.md`
3. `docs/CONTENT_MODEL_DRAFT.md`
4. `AGENTS.md`

## 1. Decisions already locked

| Question | Decision | Why |
|---|---|---|
| Product shape | Public, no-login, desktop-first PWA with student and teacher modes | The judge reaches value immediately; auth adds no proof for this brief |
| Curriculum scope | One Grade 5–7 fractions-to-proportion graph, 12 KCs | Small enough to review and test; directly matches the root-gap example |
| Adaptive core | Pure TypeScript, graph-constrained BKT-like state and bounded information-gain probes | Deterministic, explainable, fast, offline and falsifiable |
| Knowledge retrieval | Versioned structured JSON and direct graph traversal | The corpus is tiny and relational; RAG/vector search adds failure modes without value |
| Browser persistence | Dexie over IndexedDB | Concise typed schema, migrations and transactions; proven useful in the local LMS reference |
| Service worker | `vite-plugin-pwa`, `generateSW`, prompt-for-update | Minimal code and prevents silent reload/data loss during an active diagnostic |
| Backend | Not on the critical path. Admit one Fastify service only for validated model explanation or real sync | Offline diagnosis, path and dashboard must never depend on an API |
| Server database | None in MVP | Student and teacher modes share one local synthetic class; do not invent cross-device sync |
| Deployment | VPS-first, immutable Docker image, Caddy TLS/reverse proxy; Cloudflare optional only after origin is healthy | Matches the rehearsed infrastructure and provides a simple rollback |
| AI role | Optional wording/hint explanation after deterministic facts are computed and validated | A model cannot own graph edges, mastery, group, priority or labels |
| Voice | Rejected for this 48-hour product | It does not prove the mandatory root-gap or teacher decisions and creates latency/offline risk |

### Hard truth labels

- The official statement does not require login, a trained model, cloud sync, voice, RAG or an
  external API.
- The 13 proposed prerequisite edges and all item content remain **UNREVIEWED** until a named
  teacher/mentor marks them `ACCEPT`, `REVISE` or `REJECT`.
- The 40-student class and all measured outcomes are **synthetic simulation**.
- If server sync is not admitted, the UI says “Lưu trên thiết bị này”; it must not say “Đã đồng bộ
  đám mây”.

## 2. Judgeable architecture

```text
Browser / installed PWA
┌──────────────────────────────────────────────────────────────────────────┐
│ React UI                                                                │
│  Student task → evidence/path → teacher action                          │
│       │                 │                  │                              │
│       └──────────── application use-cases ────────────────┐             │
│                                                          │             │
│ Pure domain core                                         │             │
│ graph → mastery → root/abstain → next probe → path → grouping/priority │
│       │                                                  │             │
│ Versioned content bundle              Dexie / IndexedDB  │             │
│ graph + items + hints + sources        events + overrides + outbox     │
│       │                                  │                              │
│ Workbox precache: app shell + reviewed content; no API response cache   │
└──────────────────────────────────────────────────────────────────────────┘
                              │ NetworkOnly, optional
                              ▼
                 ┌───────────────────────────────┐
                 │ Thin Fastify adapter          │
                 │ /api/healthz                  │
                 │ /api/v1/explanations (gated) │
                 │ /api/v1/events/sync (gated)  │
                 └───────────────────────────────┘
                              │
                     optional FPT inference API

Internet → Cloudflare DNS/proxy (optional) → Caddy :443 → static PWA / Fastify
```

The browser is the runtime system of record for the MVP. The server is an adapter, not the tutor.
Turning the network off after the first load must leave diagnosis, practice, path, teacher groups,
teacher override and local writes functional.

## 3. Technology snapshot and version policy

The package snapshot was checked against npm on 2026-07-17. Exact resolved versions belong in
`package-lock.json`; do not rerun an unconstrained upgrade during the event.

| Layer | Choice | Snapshot | Policy |
|---|---|---:|---|
| Runtime | Node.js | `24.18.0 LTS` | Pin in `.nvmrc`, `.node-version`, CI and Docker |
| Package manager | npm | lockfile v3 | Use `npm ci`; commit the lockfile |
| UI | React | `19.2.7` | No SSR and no React Server Components |
| Build | Vite | `8.1.5` | Static SPA build |
| Language | TypeScript | `7.0.2` | `strict: true`; isolate pure domain from browser APIs |
| PWA | vite-plugin-pwa | `1.3.0` | `generateSW`; prompt update; no API runtime cache |
| Local DB | Dexie / hooks | `4.4.4` / `4.4.0` | One singleton DB and explicit schema versions |
| Runtime validation | Zod | `4.4.3` | Only at JSON, IndexedDB migration and API boundaries |
| Unit/eval | Vitest | `4.1.10` | Pure core and content gates |
| Browser tests | Playwright | `1.61.1` | Hero, teacher and real offline reload smoke |
| Optional API | Fastify | `5.10.0` | Admit after T+24 only if core gates pass |

Current workstation warning: `node --version` returned `v25.9.0`; Node 25 is EOL. Fable must not
generate the lockfile with that runtime. Switch to Node 24.18.0 or do the initial scaffold inside
the pinned Node Docker image. Docker Desktop is installed but its Linux daemon was not running at
the time of this audit, so starting it is an explicit preflight, not an assumption.

Dependency budget for the critical path:

- Runtime: `react`, `react-dom`, `dexie`, `dexie-react-hooks`, `zod`.
- Dev: Vite/React/TypeScript, `vite-plugin-pwa`, Vitest, Testing Library, Playwright, ESLint and
  Prettier.
- One icon set such as `lucide-react` is allowed only if tree-shaken. No chart library, state
  manager, component megakit, CSS framework, date library or API cache library.
- Use React state/context for ephemeral UI and Dexie live queries for persisted state. Do not add
  Redux, Zustand or TanStack Query without a failed representative test.

## 4. Repository shape and ownership boundaries

Fable creates the scaffold once. After that, no agent independently rewrites `package.json`, the
lockfile, `vite.config.ts`, root TypeScript configs or deployment files.

```text
nekopath/
├─ .github/workflows/
│  ├─ ci.yml
│  └─ deploy.yml                 # admitted after first manual deploy succeeds
├─ docs/
├─ public/
│  ├─ icons/
│  └─ offline.svg
├─ src/
│  ├─ app/                       # Fable: routing, composition, error boundary
│  ├─ components/                # Fable: shared accessible primitives
│  ├─ features/
│  │  ├─ student/                # Fable
│  │  ├─ evidence-path/          # Fable
│  │  ├─ teacher/                # Fable
│  │  └─ pwa-status/             # Fable
│  ├─ domain/                    # Codex: pure functions and contracts
│  │  ├─ model.ts
│  │  ├─ graph.ts
│  │  ├─ mastery.ts
│  │  ├─ diagnosis.ts
│  │  ├─ path.ts
│  │  ├─ grouping.ts
│  │  └─ index.ts
│  ├─ content/                   # Codex authors schema/fixtures; human reviews pedagogy
│  │  ├─ schema.ts
│  │  ├─ graph.v1.json
│  │  ├─ items.v1.json
│  │  ├─ actions.v1.json
│  │  └─ profiles.v1.json
│  ├─ storage/                   # Fable: Dexie implementation against shared types
│  │  ├─ db.ts
│  │  ├─ event-repository.ts
│  │  └─ migrations.ts
│  ├─ services/                  # Fable: optional network adapters only
│  ├─ styles/
│  └─ main.tsx
├─ tests/
│  ├─ eval/                      # Codex: profiles, baselines, report
│  ├─ e2e/                       # Fable: browser harness and specs
│  └─ fixtures/
├─ server/                       # Fable, only if admission gate passes
├─ ops/                          # Fable: Caddy, Compose, deploy/rollback scripts
├─ Dockerfile
├─ package.json
└─ package-lock.json
```

### Shared-file rule

- Fable owns scaffold/config/UI/storage/ops.
- Codex owns `src/domain/**`, `tests/eval/**` and initial structured content files.
- Human curriculum reviewer owns acceptance of graph edges, items and action wording.
- Only Fable/integrator edits shared configs. Codex supplies a dependency/config request in a
  handoff note instead of changing them concurrently.
- Each handoff states commit SHA, files touched, commands run and remaining failures.

## 5. Stable integration contract

Fable may build UI against the following domain contract before implementation is complete. Do
not let view components infer pedagogy from raw events.

```ts
type DiagnosisStatus =
  | 'DIAGNOSED'
  | 'NEEDS_MORE_EVIDENCE'
  | 'OUT_OF_SCOPE'
  | 'FAST_PATH';

interface DiagnosisResult {
  status: DiagnosisStatus;
  learnerId: string;
  targetKcId: string;
  rootKcId?: string;
  competingKcIds: string[];
  evidenceEventIds: string[];
  nextItemId?: string;
  pathKcIds: string[];
  reasonCodes: string[];
  contentVersion: string;
  algorithmVersion: string;
}

interface TeacherGroup {
  id: string;
  status: 'ACTIONABLE_ROOT' | 'QUICK_CHECK' | 'READY_TO_ADVANCE';
  rootKcId?: string;
  learnerIds: string[];
  sufficientEvidenceCount: number;
  totalLearnerCount: number;
  blockedDescendantCount: number;
  priorityScore: number;
  representativeEventIds: string[];
  suggestedActionId: string;
}
```

Additional invariants:

- Every `id` is stable and opaque; profile names are presentation metadata, never inference
  inputs.
- Events are append-only and ordered by `(sequence, occurredAt, id)` before inference.
- Duplicate event IDs are ignored idempotently.
- Every result carries `contentVersion` and `algorithmVersion`.
- `reasonCodes` are a closed enum mapped to reviewed Vietnamese strings in the UI.
- A teacher override creates a new override record; it never rewrites the learner event history.

## 6. Front-end and experience plan

### Selected visual direction

Use **“Sổ can thiệp lớp học”**: a calm, legible teacher field notebook rather than a generic dark
AI dashboard. The visual hierarchy should make evidence and the next action feel concrete.

- Warm paper background, dark ink text, teal for supported evidence, amber for “cần kiểm tra”,
  and red only for real errors.
- No purple gradient, glassmorphism, glowing AI orb, dense chart wall or decorative chatbot.
- Use the system font stack so Vietnamese text works offline; no Google Fonts request.
- Cards may resemble clipped classroom notes, but controls remain conventional and accessible.
- Minimum 16 px body text, clear 44 px touch targets, visible focus, reduced-motion support and
  WCAG 2.2 AA contrast.
- Optimize the live judging viewport first: 1280×720 and 1440×900, then tablet width. Mobile is
  functional but not a separate product.

### Routes and 90-second flow

| Route | Purpose | Cold-judge proof |
|---|---|---|
| `/` | Problem thesis, four hero shortcuts, “Xem lớp học” | Value and demo path understood in under 15 seconds |
| `/learn/:learnerId` | Target item, discriminating probe, staged hint | Same visible target produces different evidence |
| `/path/:learnerId` | Root hypothesis/abstention, evidence, micro-path | Shows why, what next, what is skipped |
| `/teacher` | Groups, priority, class-wide gap, representative evidence, override | One teacher action is obvious without coaching |
| `/system` | Build/content/DB versions, offline/storage state, reset synthetic demo | Enables reliable judging and recovery |

Hero script:

1. Open An and fail the Grade 7 target; D02 isolates an equivalent-fraction gap.
2. Open Bình on the same target; evidence points to ratio meaning instead.
3. Open Chi; product abstains and requests one discriminating item.
4. Open Minh; product serves a transfer challenge and no remediation.
5. Open teacher dashboard; compare root groups, priority factors and class-wide numerator/
   denominator; inspect evidence and perform one override.
6. Disable network, reload, complete one student interaction and return to teacher view.

### UI states that must exist

- First-load and empty local store.
- Diagnosing/processing with no fake streaming.
- Diagnosed root, needs-more-evidence, out-of-scope and fast-path.
- Offline-ready, currently offline, local write saved, storage unavailable and schema incompatible.
- Optional provider timeout/rate limit/malformed response with reviewed-hint fallback.
- Service-worker update available with an explicit “Cập nhật sau / Cập nhật ngay” prompt.
- Reset demo confirmation and successful reset.

The dashboard uses counts, lists and small progress bars. A chart library is not justified for
three categorical groups. Always show the denominator and evidence coverage beside any class
percentage.

## 7. Content and adaptive-core plan

### Versioned content records

Every knowledge component, edge, item, hint and teacher action has:

- stable ID and `contentVersion`;
- exact curriculum source, grade/outcome anchor and source URL;
- `reviewState: UNREVIEWED | ACCEPTED | REVISE | REJECTED`;
- reviewer name/role and review timestamp when accepted;
- observable behavior, not a trait label;
- for edges, `scope: AUTHORED_ITEMS | GENERAL_PREREQUISITE`;
- for items, Q-matrix/KC IDs, answer/rubric, difficulty, diagnostic/practice/check role and
  misconception distractor metadata; and
- three reviewed hint steps that do not reveal the answer before an attempt.

The build/eval gate rejects missing IDs, duplicate IDs, cycles, unknown references, missing
sources, invalid answers, a diagnostic/check numeric clone, or shipping `REJECTED` content.
`UNREVIEWED` may run only with a visible “Giả thuyết cần giáo viên xác nhận” label.

### Core pipeline

1. Validate and topologically sort the content DAG.
2. Canonicalize and deduplicate events.
3. Update per-KC BKT-like state only from reviewed mapped items.
4. Enumerate ancestors of the failed target.
5. Remove candidates without minimum direct evidence.
6. Find the earliest actionable frontier; if candidates compete, choose one reviewed probe by
   expected entropy reduction within a fixed budget.
7. Return `NEEDS_MORE_EVIDENCE` after the budget; never force a root.
8. Produce the shortest valid root-to-target path and omit mastered nodes.
9. If prerequisites and target are sufficiently mastered, return `FAST_PATH` with a transfer
   item.
10. Aggregate results into teacher groups, evidence coverage and the transparent priority rule.

Thresholds live in one versioned configuration object and are tuned only on development cases.
Do not scatter magic numbers through UI components.

### Baselines and evaluation

- B0: remediate the surface skill.
- B1: fixed grade-level prerequisite sequence.
- B2: lowest BKT mastery without graph-constrained root search.
- N: NekoPath.

The simulator is a separately implemented noisy DINA-style response generator with different
parameters and rules from inference. Six held-out labels are frozen by someone other than the
domain implementer. Report root top-1, allowed abstention, diagnostic question count, path
validity and latency. Never label a synthetic score as real learning improvement.

## 8. PWA and offline plan

### What is local

- Bundle graph, items, reviewed hints, actions and synthetic profiles into the versioned build.
- Workbox precaches the hashed app shell, content assets, manifest, icons and offline illustration.
- Dexie stores learner events, teacher overrides, app metadata and an optional outbox.
- No API response is cached. Optional explanation requests are `NetworkOnly` with deterministic
  fallback.

This deliberately avoids the LMS reference's large API-cache/interceptor surface. NekoPath can
prove offline behavior with a smaller and more reliable boundary.

### IndexedDB v1

| Table | Primary/indexes | Purpose |
|---|---|---|
| `meta` | `key` | DB/content/algorithm versions, seed, last local write |
| `events` | `id, [learnerId+sequence], learnerId, itemId, occurredAt` | Append-only answer/evidence events |
| `overrides` | `id, learnerId, targetKcId, updatedAt` | Teacher decisions without history mutation |
| `outbox` | `eventId, status, createdAt, nextRetryAt` | Only used if real server sync is admitted |

Do not persist derived diagnoses/groups; recompute them from content + canonical events so stale
derived state cannot survive an algorithm update. A DB migration either transforms safely or
offers export/reset; it never silently clears learner work.

### Service-worker policy

- Use the plugin's default `prompt` update behavior, not `autoUpdate` during an active form.
- `navigateFallback` serves the SPA shell; hashed assets are precached.
- Set a conservative precache size and fail the build if expected shell/content files are absent.
- Do not cache `/api/**`, `/healthz`, secrets, auth, HTML carrying mutable security policy, or
  provider responses.
- Caddy sends `no-cache` for `index.html`, `sw.js` and `manifest.webmanifest`; hashed assets get
  `public, max-age=31536000, immutable`.
- Show “Sẵn sàng dùng ngoại tuyến” only after service-worker readiness and a successful content
  integrity read, not merely `navigator.onLine === false`.
- `navigator.storage.persist()` is a best-effort request. Show its result honestly and expose
  `navigator.storage.estimate()` in `/system`; handle `QuotaExceededError`.
- Do not rely on Background Sync. Flush an admitted outbox on app start, `online`, manual retry
  and page visibility; Background Sync may be a progressive enhancement only.

### Offline acceptance sequence

1. Clean browser profile; load the public URL online.
2. Wait for offline-ready UI and verify build/content versions.
3. Complete one An event and one teacher override.
4. Toggle Playwright/browser context offline.
5. Hard reload `/learn/an`; app shell and current state render.
6. Submit another item; local write survives navigation and reload.
7. Open `/teacher`; group and priority recompute.
8. Reconnect; there is no duplicate event. If sync is absent, status remains “local” rather than
   fabricating success.

## 9. Backend admission plan

### Default: no backend dependency

Static PWA deployment is sufficient through CP1 and should remain the recovery artifact. Caddy
can answer `/healthz` with build metadata and serve the static bundle.

### Optional explanation endpoint

Admit `POST /api/v1/explanations` only after all deterministic/offline gates pass and a three-case
bake-off shows a material UX gain over reviewed hints.

Request contains only IDs and deterministic facts:

```json
{
  "requestId": "uuid",
  "skillId": "K02",
  "itemId": "D02",
  "reasonCode": "ADDITIVE_EQUIVALENCE_ERROR",
  "allowedHintIds": ["H-D02-1", "H-D02-2"],
  "locale": "vi-VN"
}
```

Response is a strict schema containing `explanation`, cited IDs, provider/model metadata and
fallback status. Timeout, 401, 429, 5xx or invalid schema returns the reviewed local hint. The
server never accepts or returns mastery, root, path, group or priority changes.

Server controls:

- same-origin CORS, 16 KiB body limit, JSON schema validation;
- 4-second provider deadline, bounded retry only for safe transient errors;
- per-IP rate limit and a global budget/circuit breaker;
- FPT key exists only in VPS environment/secret store, never in Vite variables or client source;
- redact prompt/body/answers from logs; and
- expose `/api/healthz` without provider secrets.

### Optional event sync

Do not add `/api/v1/events/sync` unless the organizer/mentor explicitly requires cross-device
proof or the local shared-class demo is rejected. A real implementation needs persistent server
storage, idempotent `eventId`, a canonical version contract and conflict UX. An in-memory endpoint
or fake 202 response is worse than an honest local-only MVP and is forbidden.

## 10. Security, privacy and responsible-AI plan

- No login and no real learner data. Profiles are synthetic and visibly labeled.
- No name, email, phone, school, device fingerprint, demographic or free-text child profile.
- Never commit/read/log the existing FPT token files. The browser receives no provider key.
- Content Security Policy target: `default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none';
  base-uri 'none'; frame-ancestors 'none'; form-action 'self'`.
- Add HSTS after HTTPS is confirmed, `X-Content-Type-Options: nosniff`, strict referrer policy and
  a minimal Permissions Policy.
- Render authored text as text; do not introduce raw HTML/Markdown execution for hints.
- Zod validates bundled JSON, migrated IndexedDB records and server boundaries.
- Teacher recommendations show evidence IDs, reason codes, coverage and override. No demographic
  feature and no opaque urgency score.
- AI collaboration log records decisions/files/checks, not chain-of-thought, hidden labels,
  secrets or personal data.
- Run a secret scan before every public push and final submission.

## 11. Performance and observability

### Budgets

- Local diagnosis p95 under 300 ms on the event laptop.
- Useful first interaction under 15 seconds for a cold judge.
- Keep initial compressed JS target below 250 KiB if practical; investigate any main chunk above
  350 KiB.
- No remote font, hero video, analytics SDK or image larger than 200 KiB in the critical shell.
- Optional provider endpoint has a 4-second deadline; local fallback appears without blocking the
  path.

### Observable data

Client `/system` view:

- Git commit/build time, content version, algorithm version and DB schema version;
- service-worker state and update availability;
- online/offline, last local write, event/outbox counts;
- storage persistence result and approximate usage/quota; and
- a safe reset action.

Local evaluation logs contain profile ID, algorithm/baseline, result status, root label, question
count, path-valid flag and latency. Optional server JSON logs contain request ID, route, status,
latency, provider/model, token counts if returned, fallback/error code and build SHA. Do not log
raw prompts, answers or full provider responses. Sentry/OpenTelemetry is not admitted unless a
real debugging need appears; structured logs and the system panel are sufficient for 48 hours.

## 12. Verification pyramid and release gates

### Fast checks on every change

1. format check;
2. ESLint;
3. TypeScript no-emit typecheck;
4. Vitest unit/content tests;
5. deterministic eval smoke; and
6. production build plus PWA artifact integrity check.

### Domain invariants

- graph is acyclic and all references exist;
- same canonical events/content/algorithm version returns byte-equivalent core output;
- duplicate event ID does not update mastery twice;
- shuffled input order canonicalizes to the same result;
- sparse/contradictory evidence abstains;
- out-of-graph target returns `OUT_OF_SCOPE`;
- every returned path uses real edges, ends at target and omits mastered KCs;
- An and Bình get different justified roots from the same target;
- Chi abstains; Minh gets the fast path;
- group membership and priority recompute exactly from visible factors; and
- model wording cannot mutate any deterministic fact.

### Browser gates

- 90-second hero flow in Chromium with no console error;
- keyboard-only flow and visible focus;
- 1280×720 no horizontal overflow or hidden primary action;
- offline hard reload and local write;
- service-worker update prompt;
- storage-denied/DB-error safe state; and
- public URL smoke on a second network/device.

### Release gate order

`typecheck → unit → eval → build/PWA integrity → e2e online → e2e offline → public smoke`.

No feature is “done” because it renders. The AI log entry includes the exact command and result.

## 13. Git, CI/CD and VPS plan

### Git during the 48 hours

- `main` must remain deployable. Use short branches such as `fable/pwa-shell` and
  `codex/domain-core`.
- Conventional commit examples: `feat(student): add diagnostic probe flow`,
  `test(eval): freeze graph baselines`, `fix(pwa): preserve events across update`.
- One concern per commit; no broad formatter/refactor commit during feature work.
- Tag only meaningful snapshots: `checkpoint-1`, `checkpoint-2`, `v1.0.0-vaic-final`.
- Releases are useful at CP2/final because they freeze the source, image digest and artifacts;
  do not spend time writing ceremonial release notes for every push.
- Never force-push `main`. Before merge: rebase/merge current main, rerun owned checks, inspect
  diff and secret scan.

### GitHub Actions

`ci.yml` runs on pull requests and main pushes:

- Node 24.18.0 and `npm ci`;
- read-only default token permissions;
- format/lint/typecheck/unit/eval/build;
- archive the eval JSON/Markdown and `dist` artifacts;
- Playwright smoke on main/release or when PWA files change;
- concurrency cancellation for superseded branches; and
- every action pinned to a verified full commit SHA with a version comment.

Do not expose deployment/provider secrets to pull-request jobs. High/critical production
dependency vulnerabilities block final release after human triage.

### Container and VPS

Baseline image:

1. Node 24.18.0 build stage runs `npm ci` and the release checks.
2. Caddy runtime stage contains only `dist`, Caddy config and static health metadata.
3. Run as the image's non-root user where supported; read-only filesystem except Caddy data/config
   volumes needed for certificates.
4. Pin base-image digest for final release and record the produced image digest.

If Fastify is admitted, it becomes one application container behind the same Caddy edge; the
static-only image remains a rollback/recovery artifact.

Deployment sequence:

1. Build and test locally/CI.
2. Push immutable `ghcr.io/...@sha256:...`.
3. On VPS, save current image digest as previous.
4. Pull the new digest and `docker compose up -d`.
5. Poll `/healthz`, then execute public online and offline smoke.
6. On failure, restore previous digest and repeat health check.

Caddy owns HTTPS and security/cache headers. Open only SSH, 80 and 443; restrict SSH where
practical. Secrets live in a VPS env file with restrictive permissions and never in Compose,
image layers, shell history or logs.

Cloudflare order:

1. Prove the VPS origin directly with HTTPS and health check.
2. Point DNS.
3. Enable proxy/WAF only if it does not break service-worker updates or API streaming.
4. Keep “DNS only” as the immediate fallback. Do not introduce Workers/D1/R2 during the event.

### Required runbook commands after scaffold

Fable replaces placeholders with actual scripts and updates `AGENTS.md` immediately:

```powershell
npm ci
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval
npm run build
npm run test:e2e
docker build -t nekopath:local .
docker compose -f ops/compose.yml up -d
```

## 14. Execution schedule from the current clock

The original 48-hour contract remains authoritative, but at document freeze roughly 45 hours
remained. These are operational deadlines, not organizer judging weights.

### Now → 2026-07-17 16:00

- Fable: switch to Node 24 LTS, scaffold React/Vite, lock dependencies, create route shells,
  manifest/PWA registration, Dexie v1 and first local deployment.
- Codex: implement pure domain types, DAG validation, canonical events and deterministic test
  fixtures in owned folders after scaffold SHA is supplied.
- Human: obtain teacher/mentor review of the 13 edges and hero plausibility.
- Exit: CI/build green; public static shell; integration types compile.

### 16:00 → 22:00

- Fable: student target/probe/path UI using typed fixtures; selected visual direction; all safe
  states.
- Codex: mastery, root/abstention, path and An/Bình/Chi/Minh tests.
- Integrate once through `DiagnosisResult`, not by importing internal functions into components.
- Exit: same target → two roots + abstention + fast path in browser.

### 22:00 → 2026-07-18 03:00

- Fable: teacher group/priority/class-gap/evidence/override surface.
- Codex: grouping, priority and baseline eval.
- Exit: 40 synthetic learners yield reproducible groups and one obvious teacher action.

### 03:00 → 08:00

- Fable: real service worker, IndexedDB persistence, offline/update/storage states and Playwright
  offline smoke.
- Codex: duplicate/out-of-order/schema and path property tests.
- Exit: network-off hard reload and next interaction pass.

### 08:00 → CP1 11:00

- Fix only proof-blocking failures; deploy stable public URL.
- Prepare CP1 project/solution summary from actual behavior, not roadmap.
- Submit CP1 before the platform deadline and record submission evidence manually.

### CP1 → 18:00

- Freeze content/graph after teacher feedback.
- Run 30-profile eval; repair content/core, not architecture.
- Accessibility, low-bandwidth and second-device smoke.
- Optional FPT explanation bake-off only if all core gates pass.

### 18:00 → CP2 23:00

- Feature freeze by 20:00.
- Complete README, architecture/eval evidence, AI collaboration log and deployment rollback.
- Record a rough demo video rehearsal and cold-user test.
- Tag `checkpoint-2` only after release checks and submit CP2 on time.

### CP2 → 2026-07-19 06:00

- Polish clarity, repair bugs, finish presentation and final <=5 minute demo video.
- Clean-clone reproduction, image rebuild by digest, public/private-window smoke.
- No new architecture, login, voice, RAG, cross-device sync or model experiment.

### 06:00 → Final 11:00

- Submission audit: slides, <=5 minute video, accessible GitHub repo, live URL and AI log.
- Verify repository access and exact platform fields.
- Upload by 09:30 target to preserve 90 minutes for platform/network failure.
- Final tag/release only from the submitted commit; all members present as required.

## 15. Fable 5 execution packet

Copy this section plus the four source-of-truth documents to Fable:

> Work only in `E:\Sach\Sua\hanoi_thi\nekopath`. Read `AGENTS.md`,
> `docs/PROBLEM_ANALYSIS.md`, `docs/PRODUCT_CONTRACT.md`,
> `docs/CONTENT_MODEL_DRAFT.md` and this plan before editing. Do not copy code/assets/templates
> from `LMS_hohulili`; it is a read-only architectural reference. Preserve existing commits and
> AI log.
>
> Your owned lane is scaffold/config, React application and accessible UI, Dexie persistence,
> PWA/service-worker behavior, browser tests, Docker/Caddy/CI and deployment. Do not implement or
> rewrite `src/domain/**` or `tests/eval/**`; Codex owns those. Build against the stable
> `DiagnosisResult` and `TeacherGroup` contracts in this plan using temporary typed fixtures.
>
> First milestone: switch from EOL Node 25 to Node 24.18.0 LTS, create the minimal Vite React TS
> scaffold in the existing repository without deleting docs, pin the lockfile, add actual commands
> to `AGENTS.md`, and deliver a commit SHA with `npm ci`, typecheck, unit and build results. Use the
> selected “Sổ can thiệp lớp học” visual direction. Do not add auth, voice, RAG, vector DB, Python,
> chart kit, component megakit, cloud DB or provider call.
>
> Second milestone: student/evidence/teacher vertical slice plus Dexie events/overrides. Third:
> real offline reload/update/storage/error tests. Fourth: immutable VPS deployment and rollback.
> Do not add the optional Fastify/FPT endpoint until all deterministic and offline gates pass and
> the team explicitly admits it.
>
> Every handoff must list commit SHA, changed files, commands/results, screenshots/public URL,
> known failures and next integration need. Add a concise AI collaboration log row; never include
> hidden reasoning, secrets or PII.

## 16. Codex parallel lane after Fable supplies the scaffold SHA

Codex works only on:

1. stable domain types and reason-code enums;
2. graph validation/topological helpers;
3. canonical event/deduplication logic;
4. BKT-like update, root/abstention and bounded probe selector;
5. shortest valid remediation/fast path;
6. teacher grouping/priority aggregation;
7. independent simulator, B0/B1/B2 and deterministic eval report; and
8. content schema/fixtures, with pedagogical acceptance left to the human reviewer.

First Codex handoff must be a single commit touching only owned paths, with no new package and no
config change. Required proof: An/Bình/Chi/Minh tests, graph-invalid tests and exact exported type
contract. Fable integrates through `src/domain/index.ts`; UI must not reach into internal files.

## 17. Kill switches

- If core does not beat B0/B1, repair graph/items or simplify inference; do not add a deep model.
- If a teacher cannot validate an edge, label it as an authored-item hypothesis and expose review.
- If offline hard reload is not green by 08:00 on 18 July, stop optional AI/provider work.
- If the teacher action is unclear to a cold observer, delete charts/details before adding features.
- If FPT output fails one correctness/schema/no-answer case, ship reviewed local hints.
- If Docker/VPS deployment is unstable, deploy the already-built static recovery image; do not
  migrate platform during the final night.
- If Cloudflare introduces cache/TLS/service-worker ambiguity, return to DNS-only.
- No new feature after CP2 unless it fixes a required proof or submission failure.

## 18. Definition of done

The product is ready to submit only when a cold judge can, without login:

1. understand the problem and product thesis;
2. observe An and Bình receive two evidence-backed paths from one surface task;
3. observe Chi trigger a safe abstention and Minh receive a fast path;
4. see root-based groups, transparent priority, class-wide numerator/denominator, representative
   evidence, one teacher action and an override;
5. disable the network, hard reload and complete one more interaction;
6. inspect honest synthetic/offline/version labels; and
7. access the live URL, public repository, slides, <=5 minute demo video and AI log from the exact
   submitted commit.

## 19. Read-only LMS reference audit

Inspected repository: `E:\Sach\Sua\LMS_hohulili` at HEAD
`af262ff076e0e8f918b3614eec985991a63bdfc1`.

Useful patterns retained as design lessons:

- explicit Dexie versions, compound keys and user/data isolation;
- append-only/idempotent operation IDs, backoff and visible failed/conflict states;
- per-transaction writes and crash-safe checkpoints;
- service-worker artifact integrity checks after build;
- content/publication version carried with local state;
- cache/auth/health boundaries and honest `online-only` degradation;
- Caddy security/cache headers and deploy rollback discipline.

Patterns deliberately not copied:

- Angular/Spring architecture, 300+ endpoints and the LMS's large offline interceptor;
- broad runtime API caching, video/download machinery, publication workflow and multi-account auth;
- any source code, config, prompt, asset, dependency set or project history.

Files studied read-only:

- `AGENTS.md`
- `docs/PWA_OFFLINE_RESEARCH.md`
- `docs/architecture/STREAMING_PWA_ROADMAP.md`
- `fe/package.json`
- `fe/ngsw-config.json`
- `fe/scripts/fix-ngsw.js`
- selected schema/sync sections of `fe/src/app/core/db/lms-offline.db.ts`
- selected sections of `fe/src/app/core/services/offline-sync.service.ts`
- selected sections of `fe/src/app/api/interceptors/offline.interceptor.ts`

`Caddyfile` and `docker-compose.prod.yml` were already modified in the LMS worktree, so their
current content is not treated as a reproducible source and was not copied.

## 20. Current primary references

- [Node.js release status](https://nodejs.org/en/about/previous-releases) — production should use
  an LTS line; Node 25 is EOL and Node 24 is LTS at the research cutoff.
- [React versions](https://react.dev/versions) — current documented React 19.2 line.
- [Vite PWA guide](https://vite-pwa-org.netlify.app/guide/) and
  [prompt update behavior](https://vite-pwa-org.netlify.app/guide/prompt-for-update) — manifest,
  service-worker generation and user-controlled refresh.
- [Dexie React guide](https://dexie.org/docs/Tutorial/React) — one typed database instance and live
  IndexedDB queries.
- [MDN persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist),
  [storage estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) and
  [quota/eviction guide](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
  — persistence is requested, not guaranteed; quota values are estimates.
- [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
  — progressive enhancement in secure contexts, not the sole delivery mechanism.
- [Fastify LTS policy](https://fastify.dev/docs/latest/Reference/LTS/) and
  [server safety options](https://fastify.dev/docs/latest/Reference/Server/) — validation and
  non-zero request timeouts for an admitted service.
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/) — separate build
  and small runtime stages.
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) and
  [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) — TLS and one
  edge boundary.
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) —
  least privilege, secret isolation and full-SHA action pinning.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — accessibility acceptance baseline.
