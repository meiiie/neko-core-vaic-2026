# NekoPath UX/UI audit and parallel execution plan

Date: 2026-07-17  
Status: implementation-ready for Fable 5; Codex owns independent review and integration  
Production baseline: <https://nekopath-vaic.pages.dev/>

## 1. Outcome to optimize

The interface must let an uncoached judge understand and verify this chain in 90 seconds:

1. forty learners can make the same visible mistake for different prerequisite reasons;
2. An and Bình receive different evidence-backed root hypotheses and repair paths;
3. Chi is not force-labeled when evidence is ambiguous;
4. Minh skips remediation when already ready;
5. the teacher immediately sees which group to help first, why, and what to do;
6. the same core interaction continues after the network is disabled.

This is not a generic LMS and not an AI chat product. The visual product is a **classroom
intervention notebook**: evidence first, action second, implementation detail third.

## 2. Audit scope and evidence

This is a combined UX and accessibility-risk audit of the deployed routes `/`, `/learn/chi`,
`/path/chi`, `/path/an`, `/teacher` and `/system`. Each route was captured on 2026-07-17 at
1440×900 and 390×844. The mobile pass also measured horizontal overflow and pointer target sizes.

This audit does not claim full WCAG conformance. It records visible and browser-measurable risks
that the implementation pass must verify again.

### Confirmed strengths

- The warm-paper, dark-ink direction is calm and domain-appropriate.
- Simulation, unreviewed-content and online/offline truth labels are visible.
- The production routes reflow without horizontal overflow at 390 px.
- Buttons meet the existing 44 px minimum, focus styling and reduced-motion rules exist.
- All important numbers and outcomes come from the deterministic domain adapter; the UI does not
  invent scores or confidence.
- The core student, path, teacher and recovery routes are already functional.

### P0 structural risks

1. **The first screen explains but does not demonstrate.** The value proposition is a paragraph,
   while the four proof profiles are plain text links. A judge cannot see “same error, different
   root” at a glance or choose the intended 90-second route confidently.
2. **Navigation and role controls duplicate one another.** “Học sinh/Giáo viên” links and
   “Vai trò” buttons compete in the header even though the role state is not authentication or a
   security boundary.
3. **The teacher's first decision is buried.** The highest-priority group, class-wide gap and
   recommended intervention are embedded in prose and nested cards. There is no single dominant
   “do this first” region above the fold.
4. **The causal product proof is visually absent.** The path page renders a numbered list and raw
   event IDs, not the prerequisite frontier, skipped/blocked relationship and evidence trail that
   distinguish NekoPath from fixed-order practice.

### P1 interaction and hierarchy risks

- Almost every surface uses the same full-width card treatment, including cards inside cards.
  This flattens hierarchy and reads as generic scaffold UI.
- Profile links and the teacher shortcut on the home page are only 21 px tall on mobile.
- Student answer choices look like small utility buttons; the question, current evidence state and
  next step do not read as one learning interaction.
- Raw learner IDs (`an`, `chi`), KC IDs, event IDs and algorithm versions are promoted above
  teacher-facing language. They are valid audit evidence but should live in expandable technical
  detail.
- The mobile teacher page is 2,271 px tall. Its repeated bullet blocks make comparison difficult,
  even though there is no horizontal overflow.
- “Giả thuyết cần giáo viên xác nhận” is correctly honest but repeated with identical visual
  weight. It needs one consistent review-state component, not warning prose everywhere.

### P2 polish risks

- Page titles use lowercase fixture IDs instead of human-readable profile labels.
- Status is mostly expressed in sentences rather than compact, consistently placed state labels.
- There is no clear current-step model across target task → diagnostic probe → repair path.
- The system route is useful for judging but visually competes with primary product navigation.

## 3. Chosen design direction

### Product character

Use **“Sổ can thiệp lớp học”**, but make it operational rather than decorative. It should feel like
a carefully marked teacher field notebook with three recurring product-specific structures:

- **Dấu vết bằng chứng:** what the learner did and what remains uncertain;
- **Đường bù kiến thức:** the smallest prerequisite-to-target path, including skipped nodes;
- **Dải lớp học:** the distribution of the 40-person class and the next intervention.

Do not introduce a mascot, AI orb, chatbot, avatar, gamification, stock illustration or decorative
school imagery. No visual asset is required for this pass.

### Anti-slop rules

- No gradient, glassmorphism, glow, floating blobs, oversized hero, bento-stat wall or dark AI
  dashboard.
- No card around every paragraph. Use spacing, rules, table/row structure and typographic contrast
  before adding a container.
- No decorative icon dependency, emoji, handcrafted SVG or chart library.
- No generic copy such as “unlock potential”, “powered by AI” or unsupported improvement claims.
- No animation unless it communicates a state change; respect `prefers-reduced-motion`.
- Do not hide uncertainty, synthetic-data labels, denominators or unreviewed content to make the
  demo look more confident.

### Tokens

Fable may tune exact values after browser comparison, but the semantic system is fixed:

| Token | Purpose | Starting value |
|---|---|---|
| canvas | warm paper background | `#F4F0E6` |
| surface | primary reading surface | `#FFFCF5` |
| ink | primary text | `#17211D` |
| muted | secondary text | `#5B625D` |
| rule | borders/dividers | `#D8D0C0` |
| evidence | sufficient/verified path | `#006B61` |
| review | ambiguity/unreviewed | `#9A5A00` |
| danger | destructive/error only | `#B42318` |
| focus | keyboard focus | `#1358BE` |

- System font stack only; no remote font request.
- Body 16 px minimum; metadata 14 px only when it is not required to complete a task.
- Use a restrained type scale around 16 / 18 / 24 / 32 px, with line length near 65–75
  characters for reading copy.
- Use 4 / 8 / 12 / 16 / 24 / 32 / 48 spacing and one restrained radius family (8–12 px).
- Shadows are optional and subtle; borders and spacing should carry most hierarchy.

## 4. Screen contracts

### Shared shell

- Keep a compact brand, simulation label and network state.
- Replace duplicate role links/buttons with **one** understandable mode navigation. It must never
  imply login or authorization.
- Give student learning and the teacher board primary prominence; move “Hệ thống” to a quiet
  utility position.
- At 390 px, the header must not occupy more than roughly the first 180 px or wrap into unrelated
  control rows.
- Preserve semantic `nav`, current-page indication, visible focus and 44×44 px targets.

### `/` — proof-oriented entry

Above the 720 px fold, show:

1. a concise headline stating “cùng lỗi bề mặt, khác lỗ hổng gốc”;
2. one sentence describing the teacher outcome;
3. primary action: start the two-learner comparison;
4. secondary action: open the 40-learner teacher board;
5. a compact four-profile proof selector using the existing `HERO_LEARNERS` data.

The four profiles must be scannable as different evidence states, not a bulleted link list. Do not
claim the root before the underlying adapter does. The full synthetic-data disclosure remains
visible, but it should not interrupt every action.

Acceptance: a new observer can say what NekoPath does and click the intended first proof in under
15 seconds.

### `/learn/:learnerId` — one diagnostic interaction

- Use the human-readable profile label; keep the fixture ID secondary.
- Show a compact three-step orientation: target task → diagnostic check → repair/advance.
- Treat the question as the dominant interaction. Answer options must be full, unambiguous targets,
  arranged compactly on desktop and stacked on mobile.
- Put “why this question?” next to the probe as a concise evidence explanation.
- Keep diagnosis status in a consistent status component and show local-save/offline feedback close
  to the interaction.
- Do not add generated chat, typing simulation, points, streaks or confetti.

Acceptance: keyboard-only completion works; the user can identify the question, evidence state and
next action without reading implementation prose.

### `/path/:learnerId` — explainable prerequisite trail

Use three levels of information:

1. **Decision:** root identified / more evidence needed / fast path / out of scope;
2. **Action trail:** prerequisite repair steps toward the target, or the single next discriminating
   probe when uncertain;
3. **Audit detail:** reason codes, event IDs, content and algorithm versions in an expandable
   technical section.

For a diagnosed learner such as An, render the ordered KC path as accessible labeled steps with a
clear start and target. For Chi, compare the two competing hypotheses and make the next probe the
dominant action. Do not fabricate probabilities.

Acceptance: a judge can answer “why this path, what comes next, and what was not assumed?” in 20
seconds.

### `/teacher` — decision cockpit, not analytics wallpaper

The first viewport must contain:

- class size and evidence coverage;
- the one class-wide gap, with numerator/denominator and threshold;
- “Ưu tiên trước” with the highest-priority group and the existing transparent factors;
- the recommended teacher action.

Below that, show the four groups as comparable ranked rows or a compact table on desktop. Each row
must expose group size, evidence coverage, blocked descendants, priority and action. Learner IDs and
representative events belong in disclosure panels. Use small native/CSS progress bars or proportional
strips only when the same numbers remain in text; do not add a chart library.

On mobile, preserve comparison order and collapse secondary evidence so the page is materially
shorter than the 2,271 px baseline. Do not solve height by reducing text below 16 px.

Acceptance: without coaching, an observer identifies whom to help first and why in under 15
seconds. No demographic data or opaque ranking is introduced.

### `/system` — judge recovery and transparency

- Keep storage/build facts and reset behavior, but make this a quiet utility surface.
- Group human-readable status separately from technical version detail.
- Keep the destructive reset confirmation explicit; never make reset a primary visual action.

## 5. Accessibility and responsive acceptance

- Target WCAG 2.2 AA contrast; verify actual computed combinations before claiming compliance.
- All links, buttons and `summary` controls used for tasks are at least 44×44 CSS px or have an
  equivalent padded hit area.
- One logical `h1`; headings do not skip levels; landmarks and labels remain meaningful.
- Keyboard focus follows visual order and is never obscured by a sticky element.
- State changes use `role=status`/`alert` where appropriate and are not communicated by color only.
- At 390×844, 768×1024, 1280×720 and 1440×900: no horizontal overflow, clipped controls or hidden
  primary action.
- At 200% browser zoom on desktop, content reflows without loss of task functionality.
- Offline, loading, saved, storage-error, invalid learner and reset-confirmation states remain
  legible.

## 6. Parallel ownership

### Fable 5 — visual implementation lane

Fable owns only the presentation layer for this pass:

- `src/styles/global.css` and any additional files under `src/styles/`;
- `src/components/**` presentation components;
- `src/app/pages/HomePage.tsx`;
- `src/features/student/LearnPage.tsx`;
- `src/features/evidence-path/PathPage.tsx`;
- `src/features/teacher/TeacherPage.tsx`;
- `src/features/system/SystemPage.tsx`;
- affected UI/unit tests under `src/app/**` or beside the changed UI.

Fable must not change `src/domain/**`, `src/content/**`, `tests/eval/**`, the diagnosis adapter,
curriculum facts, generated counts, priority rules, deployment configuration, README or the AI log.
No new dependency without a concrete failed test and integrator approval. No deployment from the
Fable branch.

### Codex — evidence, QA and integration lane

Codex owns:

- freezing the domain/adapter contract while Fable works;
- black-box desktop/mobile journey checks and before/after screenshot comparison;
- keyboard, target-size, overflow, offline reload, console and service-worker checks;
- unit/eval/build/security gates;
- resolving integration conflicts, documentation, AI log and Cloudflare deployment;
- rejecting any visual copy or state that overclaims curriculum review, confidence or learning
  impact.

Codex does not make a competing redesign while Fable is implementing. It may add independent test
coverage and report bounded corrections after the Fable commit.

### Handoff protocol

1. Fable fetches and rebases its worktree on the latest `origin/main` before editing.
2. Fable works in one bounded branch/commit series and does not merge or deploy.
3. Fable captures before/after at 1440×900 and 390×844 for `/`, `/learn/chi`, `/path/an`,
   `/path/chi`, `/teacher` and `/system`; screenshots stay out of Git unless requested.
4. Fable reports commit SHA, changed files, checks run, screenshots and known misses.
5. Codex rebases/integrates, runs the full gate, repeats the visual audit and sends only concrete
   corrections tied to a route, viewport and acceptance rule.

## 7. Fable milestones and stop conditions

### M1 — shell and foundations

- Implement tokens, typography, layout widths and the single navigation model.
- Replace generic repeated cards with a small semantic component set: status label, evidence note,
  action panel, profile selector, path step and group row.
- Stop if any truth label, route or keyboard path is lost.

### M2 — home and student proof

- Make the intended comparison path obvious above the fold.
- Make the diagnostic question a complete interaction, not a paragraph plus tiny buttons.
- Preserve all adapter-driven behavior and local persistence.

### M3 — path and teacher decisions

- Promote decision/action/evidence hierarchy on the path page.
- Put the teacher's first intervention above the fold and convert nested group cards into a
  comparable structure.
- Stop rather than invent a new score, probability, learner attribute or teacher action.

### M4 — responsive and accessibility polish

- Verify all named viewports, 200% zoom, keyboard path, reduced motion and task target size.
- Capture the full route matrix and run existing format/lint/typecheck/unit/build checks.
- Do not begin a new feature after this milestone.

## 8. Definition of done for this pass

- The 90-second script is visually self-guiding and does not require verbal explanation of the UI.
- Home value is visible in the first viewport; teacher priority/action is visible in its first
  viewport.
- An's path is visibly different from Chi's abstention state; technical IDs no longer dominate.
- Desktop and mobile use one coherent hierarchy without generic AI-dashboard styling.
- All current truth labels, domain results, offline behavior and recovery behavior remain intact.
- Existing unit and eval suites pass, production build passes, dependency audit stays clean, and
  Codex's post-integration browser smoke has no functional or console regression.

## 9. Copy-ready prompt for Fable 5

> Continue NekoPath in `E:\Sach\Sua\hanoi_thi\nekopath` on branch `fable/pwa-shell`. First fetch
> and rebase on the latest `origin/main`, then read `AGENTS.md`, `docs/PROBLEM_ANALYSIS.md`,
> `docs/PRODUCT_CONTRACT.md`, `docs/IMPLEMENTATION_MASTER_PLAN.md` and
> `docs/UX_UI_AUDIT_AND_EXECUTION_PLAN.md` completely. Implement only the Fable visual lane defined
> in section 6 and all screen contracts in sections 3–5. The current production is functional but
> visually generic: repeated cards flatten hierarchy, duplicate role controls confuse navigation,
> the prerequisite proof is hidden in text/IDs, and the teacher's first intervention is buried.
> Redesign it as a calm “Sổ can thiệp lớp học” centered on evidence trail, repair path and class
> intervention—not a generic AI dashboard. Preserve every adapter-driven outcome, uncertainty,
> synthetic-data label, unreviewed-content label, denominator, offline state and local write. Do not
> touch domain/content/eval/adapter/deploy/docs/log files, do not add auth/chat/voice/backend, do not
> add a dependency without a failed representative test, and do not deploy. Capture before/after
> screenshots at 1440×900 and 390×844 for `/`, `/learn/chi`, `/path/an`, `/path/chi`, `/teacher`
> and `/system`; verify keyboard focus, 44 px task targets, no overflow, 200% zoom and reduced motion.
> Run format, lint, typecheck, unit tests and build with Node 24.18.0. Finish with commit SHA, changed
> files, checks, screenshot paths and known misses so Codex can perform independent audit and
> integration.
