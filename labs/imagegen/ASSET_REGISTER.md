# Asset and concept register

This register is deliberately small. Do not promote “nice-looking” drafts without a route/state
contract and a human decision.

| ID  | Prompt / source                                       | Intended route or medium                       | Status   | Human review                | Decision / reason                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------- | ---------------------------------------------- | -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | `PROMPT_LIBRARY.md#t01`                               | Teacher hierarchy composition reference        | revise   | Codex visual pass           | `generated/T01-v1-teacher-hierarchy.png` is retained as a draft only: it introduced a radial chart explicitly prohibited by the prompt and reads as a generic dashboard. Do not integrate; retry with a zero-baseline class strip and a stronger first-action region. |
| S01 | `PROMPT_LIBRARY.md#s01`                               | Student check-in composition reference         | planned  | pending                     | Must preserve one-question, one-action sequence; not an app asset.                                                                                                                                                                                                    |
| P01 | `PROMPT_LIBRARY.md#p01`                               | Path/abstention composition reference          | planned  | pending                     | Must make uncertainty responsible and actionable; not an app asset.                                                                                                                                                                                                   |
| A01 | `PROMPT_LIBRARY.md#a01`                               | Optional pitch/video illustration              | planned  | pending                     | Only consider after product interaction is frozen; excluded from core PWA.                                                                                                                                                                                            |
| N01 | Team-supplied NekoPath mark; `docs/BRAND_SYSTEM.md#2` | Product identity: shell, PWA icons, share card | promoted | human visual review pending | Faithful monochrome feline mark passed alpha, small-icon, desktop/mobile and local browser checks. It is product identity, never a mascot or a learning-state icon.                                                                                                   |
| N02 | Hand-authored SVG composed from promoted N01 mark     | GitHub repository README banner                | promoted | human visual review pending | Flat paper card, monochrome mark, wordmark, EN/VI taglines and a quiet evidence-path motif (two evidenced nodes, one abstaining). No gradient/glow; complies with `docs/BRAND_SYSTEM.md#3`. Repo-only asset; not shipped in the PWA shell or precache.                |

## Record format for each generated draft

```md
### <ID>-v<N>

- Generated at (UTC):
- Tool/mode: built-in image generation
- Prompt source and exact revision:
- Output path: `generated/...`
- Intended use:
- Product route/state contract:
- AI visual review result:
- Human reviewer / decision:
- Rubric result:
- Promotion commit (if any):
- Rejection/revision reason:
```

### T01-v1

- Generated at (UTC): 2026-07-17T17:07Z
- Tool/mode: built-in image generation
- Prompt source and exact revision: `PROMPT_LIBRARY.md#t01`, v1
- Output path: `generated/T01-v1-teacher-hierarchy.png` (ignored raw draft)
- Intended use: teacher hierarchy composition reference only
- Product route/state contract: `/teacher`, class-wide pattern + first intervention
- AI visual review result: revise — the composition has a readable sidebar/table rhythm and neutral
  placeholder policy, but violates the prompt with a radial chart and makes the main action too
  dashboard-generic.
- Human reviewer / decision: pending
- Rubric result: revise; no promotion
- Promotion commit (if any): none
- Rejection/revision reason: retry without radial chart, large blue generic CTA or dashboard-stat
  styling; show a zero-baseline class evidence strip, named action-panel area and comparable rows.

### N02-v1

- Generated at (UTC): 2026-07-18T05:10Z
- Tool/mode: hand-authored SVG (no image generation); embeds the promoted N01 512 px mark as a
  base64 raster so the file is self-contained on GitHub
- Prompt source and exact revision: composition rules from `docs/BRAND_SYSTEM.md#3` and `#4`
- Output path: `docs/assets/nekopath-banner-v1.svg` (66 KiB)
- Intended use: GitHub README banner only; never loaded by the PWA, never precached
- Product route/state contract: repository presentation; no in-app surface
- AI visual review result: pass — flat `brand-paper` card with 1 px rule border, monochrome mark
  at 148 px with clear space, wordmark + honest EN/VI taglines (no capability claim), evidence
  motif uses `evidence` teal for evidenced nodes and `review` amber outline for the abstaining
  node; Vietnamese diacritics verified in browser render at 1280 px and fit within the card
- Human reviewer / decision: pending
- Rubric result: pass for repository use
- Promotion commit (if any): recorded in git history with the v0.5.0 release
- Rejection/revision reason: none

### N01-v1

- Generated at (UTC): 2026-07-17T17:38:06Z
- Tool/mode: built-in image generation + local chroma-key removal and deterministic derivative
  composition
- Prompt source and exact revision: `N01_NEKOPATH_MARK_PROMPT.md`
- Source input: `brand/source/nekopath-logo-concept-v0.png`, SHA-256 recorded in
  `docs/BRAND_SYSTEM.md`
- Output paths:
  - `public/brand/nekopath-mark-v1.png` — transparent raster master; not precached
  - `public/brand/nekopath-mark-v1-512.png` — shell mark
  - `public/icons/nekopath-{192,512,maskable-512,apple-touch-180}.png` — install/browser marks
  - `public/brand/nekopath-share-v1.png` — truthful Open Graph/Twitter preview
- Intended use: identity only, on login/shell/PWA/share surfaces
- Product route/state contract: no mark in the student question or teacher intervention decision
  regions
- AI visual review result: pass — monochrome silhouette preserved; transparent corners verified;
  source mark, 1440 × 900 shell, 390 × 844 drawer, icon and share card inspected; no page error in
  browser smoke
- Human reviewer / decision: pending
- Rubric result: pass for promotion; human product review remains available
- Promotion commit: `fix(brand): harden PWA identity and optional dock load` (Git history)
- Rejection/revision reason: none; revisit only if the team replaces the source mark with a
  maintained vector master
