# Changelog

All notable changes to NekoPath are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (0.x during the VAIC 2026
hackathon window).

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

[0.5.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/meiiie/neko-core-vaic-2026/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/meiiie/neko-core-vaic-2026/releases/tag/v0.2.0
