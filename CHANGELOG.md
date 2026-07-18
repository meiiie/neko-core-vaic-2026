# Changelog

All notable changes to NekoPath are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (0.x during the VAIC 2026
hackathon window).

## [0.11.0] — 2026-07-19

The complete multimedia flow, distilled from the team's mature LMS at atomic level.

### Added

- **Pre-upload video probe on the teacher's device** (LMS_hohulili
  `video-probe` pattern, as YouTube Studio does): duration, frame size and a
  real poster frame are read from the file before any byte leaves the machine,
  shown for confirmation, and stored with the resource — zero server-side
  transcoding. The probe auto-fills the duration field; curated metadata
  (role, grade band, transcript, review state) rides in the same upload.
- **Drag-drop upload zone** with keyboard access and a byte-true progress bar
  (XMLHttpRequest upload events), replacing the bare file input.
- **Student video player card**: poster and duration visible before any bytes
  stream, per-learner resume position — "Tiếp tục từ 3:24" — kept local-first
  in the device database like scroll position, and one silent stream retry
  that preserves the position on flaky connections.
- **Deep-linkable authoring URLs**: `/teacher/lessons/K02` addresses one
  skill's materials directly (course-editor routing pattern).
- Resource rows now show kind chips, duration, size, publish/review state and
  uploader attribution in one metadata line on both teacher and student
  surfaces.

### Changed

- Local database schema v5 adds per-learner video resume positions alongside
  the curated resource indexes; existing devices upgrade in place from any
  prior version.
- Server `resources` table gains probed media metadata columns via additive,
  idempotent migration — verified against both fresh and existing databases.
- Video duration accepts fractional seconds end-to-end (the probe reads real
  values like 204.8s; an integer-only rule would reject honest data).

## [0.10.0] — 2026-07-18

The hardened Neko classroom-assistant release.

### Added

- Bounded prompt queue, true stop/streaming states, account-scoped drafts and session
  validation, mobile dialog semantics, focus containment and accessible answer announcements.
- `agent-eval-v1` scenarios for missing-evidence refusal, prompt-injection containment,
  mutation approval and honest token/latency reporting.
- A Node-runtime Fastify boot smoke in CI so the production module graph is exercised outside
  Vite and Vitest before deployment.

### Changed

- Codex App Server now advertises the NekoPath package version instead of a stale hard-coded
  client version.
- Public production continues to leave managed ChatGPT accounts disabled. The integration is
  shipped behind `NEKOPATH_CODEX_APP_SERVER_ENABLED` until a real multi-user OAuth smoke and
  encrypted credential-at-rest design are reviewed.

### Fixed

- Assignment tool writes now carry a short-lived operation ID; the server derives a stable,
  teacher-scoped assignment ID and deduplicates ambiguous timeout/retry requests.
- Tool-envelope parsing, mutation timeout semantics, learner-name matching, session rollback
  races and several NekoDock accessibility/interaction failures found during PR review.

## [0.9.0] — 2026-07-18

The multimedia and deep-agent release.

### Added

- **Teacher-uploaded learning resources**: PDF summaries and compressed micro-videos
  (≤ 60 MB, MIME allowlist) attached per skill, stored on the persistent volume,
  streamed with HTTP Range support, and **pinnable offline per device** — download is
  always explicit with the size shown. Students see attachments on the lesson page
  with teacher attribution.
- **Neko agent harness v2** (teacher-side): persistent token-budget agent sessions,
  server-side OpenAI Responses relay and managed ChatGPT accounts (teacher-only,
  secrets never leave the server), selectable streamed models with stall recovery,
  WebMCP assignment tools, and Gemma 3 running offline in a WebLLM worker.
- **Adaptive continuation**: learning continues past mastery with persisted,
  policy-validated spaced-review schedules.
- **Teacher question-bank import** from file and a restored class dashboard with
  per-student drill-down.
- Student evidence histories persisted in SQLite server-side (no client-seeded
  walkthrough data).

### Fixed

- **Production crash-loop root-caused and closed** (two stacked failures): the
  runtime image now ships all of `src/` (a hand-maintained COPY allowlist broke when
  a new server cross-import landed), a directory import that Vite/vitest resolve but
  plain Node ESM rejects was made explicit, and the Docker release gate now
  boot-smokes the server module graph with plain Node — a green test suite can no
  longer ship a server that cannot boot. Recovery deploys are no longer blocked by
  the pre-deploy snapshot when the container is already down.
- Local database schema advanced to v4 (lesson/resource mirrors + scoped agent
  sessions) with safe upgrade paths for devices on any prior version.

## [0.8.0] — 2026-07-18

Baseline release for the per-feature deepening phase.

### Added

- Teacher-owned lesson materials: a server `lessons` table (12 team drafts seeded as
  editable rows), a `/teacher/lessons` authoring surface that publishes under the
  teacher's name, and an offline device mirror so students read materials without a
  network — with provenance labels (draft vs teacher-updated) on every lesson.
- Server-backed teacher intelligence: support groups, targeted review and per-learner
  evidence tracing now read real synced records instead of on-device aggregates only.
- Account-owned evidence hydration: paginated server history restores a student's
  append-only log on any device; assignment answers feed diagnosis and practice
  progress on equal footing with check-in answers.
- End-to-end adaptive-contract tests over real Fastify + in-memory SQLite: the same
  surface error yields different diagnosed roots and different remediation paths, with
  an explicit abstention case — no API mocks.
- Public governance set: requirement-by-requirement problem-fit audit, engineering
  standards benchmarked against industry practice, and an honest architecture review
  against the team's mature LMS with a tiered adoption plan.

### Changed

- Deploys are pipeline-only: keyless Workload Identity Federation + IAP from GitHub
  Actions; hand SSH demoted to reported break-glass. One-command local gate
  `npm run verify` mirrors CI exactly.
- Learner evidence is isolated per account; assigned and practice progress unified.

### Fixed

- Assigned-answer evidence hardening; deploy-time SQLite snapshot flow simplified
  after the sidecar approach proved redundant.

## [0.7.0] — 2026-07-18

### Added

- An account-scoped assignment-to-diagnosis contract test now proves that identical K10 surface
  errors can produce K02 and K07 remediation paths, while sparse evidence safely abstains.
- Teacher group details now trace each learner's decision to server-owned answer evidence before
  a review assignment is created.
- Complete paginated server-evidence hydration feeds confirmed assignment answers back into local
  diagnosis and adaptive practice progress.
- Confirmed device profiles can reopen without connectivity after one successful online sign-in;
  the same recovery remains available if the directory loads but the network drops during submit.
- A focused adaptive check-in presents one evidence decision at a time with student-facing copy
  and an explicit completion state.

### Changed

- Local answers and their outbox rows now commit atomically; duplicate IDs remain idempotent and
  mismatched payloads are quarantined instead of overwriting server evidence.
- Teacher support-group actions are shorter and more decision-focused while retaining evidence and
  intervention detail.

### Fixed

- A browser-visible, non-credential profile binding plus `/api/auth/me` verification prevents an
  offline profile switch from syncing events through another learner's stale HttpOnly session.
- Shared-device outbox batches sync only events owned by the currently verified learner; HTTP
  authentication failures never fall back to offline entry.

## [0.6.1] — 2026-07-18

### Changed

- Teacher surfaces adopt the quiet presentation system: computed greeting and date
  header (previously hard-coded), section labels in sentence case app-wide instead of
  all-caps letterspacing (40 labels stopped shouting; uppercase Vietnamese also stacks
  diacritics poorly), two decision-focused metric cards, and typographic middle-dot
  separators across eight pages.

### Removed

- Redundant "last updated" chips on teacher pages — the sidebar connection status
  already answers data freshness; the sample-data footnote stays with the data.

## [0.6.0] — 2026-07-18

### Added

- A same-device, local-first evidence loop: new student answers now feed the
  deterministic teacher dashboard without being multiplied across a simulated group.
- Append-only teacher diagnosis overrides with a required professional reason; every
  override re-runs grouping and the 15-minute attention plan without rewriting learner
  evidence.
- Resilient class-directory startup states with bounded session and directory requests.

### Changed

- The student dashboard and shared shell use quieter, task-led status presentation while
  keeping sample-data disclosure next to the data it describes.

### Fixed

- Signed-out and stale PWA shells can recover from delayed or aborted authentication and
  class-directory requests instead of waiting indefinitely.

## [0.5.0] — 2026-07-18

### Added

- Public repository presentation: brand banner (governed by `docs/BRAND_SYSTEM.md`),
  status badges, professional README with architecture diagram and bilingual summary.
- `CHANGELOG.md` with the full release history and `LICENSE` (MIT).
- Repository metadata: description, homepage and topics for discoverability.

## [0.4.0] — 2026-07-18

### Added

- Evidence-aware adaptive core: misconception naming requires two independent items;
  explicit detect–verify–escalate dispositions; a distinct teacher-review group after the
  question budget is exhausted; interventions selected under a 15-minute teacher budget
  (`docs/EXECUTIVE_CONCLUSION_EXECUTION.md`).
- Class-roll sign-in: an anchored, diacritic-insensitive combobox over real directory
  records — pick your name, no password typing, no external identity provider.
- Disclosed synthetic Brier/ECE evaluation gates (`docs/EVALUATION.md`), 28 eval tests.

### Changed

- Login typography and rhythm tuned for Vietnamese: 24 px macro-rhythm, major-third type
  scale, line-heights on the 4 px grid so stacked diacritics never clip; full-width
  48 px primary action aligned with the field.
- Route-split page boundaries; initial JS 79 KiB gzip against a 150 KiB budget.

### Fixed

- Service-worker updates now surface on every route and auto-apply on `/login`,
  eliminating the stale-shell trap for signed-out visitors.
- Hardened evidence and action fallbacks in the adaptive domain core.

## [0.3.0] — 2026-07-18

### Added

- Product-grade assistant dock (chat panel) replacing the TUI-style console.
- Image-generation UX lab with asset register and review rubric (`labs/imagegen`).

### Changed

- Flat role-based sidebar navigation with preserved account context down to 320 px.
- Teacher decision workflows refined; mobile drawer traps focus correctly.
- PWA identity hardened: versioned mark derivatives, install icons, truthful share card.

### Fixed

- Edge worker no longer allows HTML transformation (analytics injection prevented).
- Deployed build provenance preserved (`GITHUB_SHA` shown on the in-product version surface;
  `/api/healthz` remains a minimal liveness endpoint).

## [0.2.0] — 2026-07-17

### Added

- Deterministic root-gap domain core: diagnosis, teacher grouping, mastery with
  abstention (`NEEDS_MORE_EVIDENCE`), versioned but teacher-unreviewed GDPT 2018 (Toán 7)
  curriculum graph draft.
- Real backend: Fastify 5 + `node:sqlite`, scrypt credentials, HttpOnly session
  cookies, question authoring and assignment endpoints, seeded Class 7A records.
- Local-first sync: Dexie/IndexedDB event store with an idempotent outbox bridge.
- Neko agent harness on one provider port: deterministic rule agent, local Ollama,
  and in-browser Gemma via WebLLM with consented on-device model download.
- Production: Docker Compose on a GCP VM behind Caddy, Cloudflare Worker edge on the
  canonical domain `nekopath.holilihu.online`.
- CI with SHA-pinned actions and a manual VM deploy workflow; semver tagging.

[0.11.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/meiiie/neko-core-vaic-2026/releases/tag/v0.2.0
