# Teacher UI/UX skill audit

- **Date**: 2026-07-17 (Asia/Ho_Chi_Minh)
- **Audited commit**: `69cc370`
- **Production**: <https://nekopath.holilihu.online/>
- **Scope**: `/teacher`, `/teacher/class`, `/teacher/questions`, `/teacher/assignments`, `/system`
- **Viewports**: 1440×900, 1280×720, 768×1024, 390×844
- **Method**: source inspection plus clean-browser interaction, screenshots, geometry, keyboard,
  console and reduced-motion checks

This report applies the installed `emil-design-eng`, `apple-design`,
`review-animations`, `improve-animations`, `find-animation-opportunities` and
`animation-vocabulary` skills. Product truth and the deterministic teacher data remain
authoritative; no count, score, threshold or intervention wording is changed here.

## Outcome

The integrated teacher workspace is already a substantial improvement over the earlier scaffold.
At desktop width it exposes the 40-person class, 32 sufficiently evidenced profiles, the 12/40
class-wide pattern, priority formula `36 = 12 × 3`, and the recommended action in the first
viewport. The visual hierarchy is calm and the four need groups are reproducible from the domain
adapter.

The current highest-leverage work is not a new visual theme. It is to remove three usability
breaks and then refine motion:

1. the closed mobile drawer leaves off-screen links in the keyboard tab order, does not close on
   `Escape`, and keeps focus on the obscured menu button after opening;
2. `/teacher/questions` overflows horizontally by 24 px at 390×844;
3. `/teacher` pushes the class-wide pattern below y=1003 and the need map below y=1629 on mobile,
   so the first decision is not visible inside the required 844 px viewport.

## Project map relevant to the teacher experience

| Layer | Responsibility | Evidence |
| --- | --- | --- |
| Domain | deterministic grouping, priority and class-wide threshold | `src/domain/core.ts` |
| Adapter | human-readable KC/action/status labels | `src/app/adapters/hero-tutor.ts` |
| Teacher overview | class summary, class-wide pattern, top action | `src/features/teacher/TeacherPage.tsx` |
| Intervention workspace | ranked groups and evidence disclosure | `src/features/teacher/TeacherClassPage.tsx` |
| Operational tasks | question authoring and assignment creation | `src/features/teacher/TeacherQuestionsPage.tsx`, `TeacherAssignmentsPage.tsx` |
| Shell | role navigation, mobile drawer, truth/status labels | `src/components/AppLayout.tsx` |
| Visual/motion system | tokens, layout, targets and transitions | `src/styles/global.css` |

## Measured route matrix

| Route | 1440×900 | 390×844 | Finding |
| --- | ---: | ---: | --- |
| `/teacher` | 1216 px high, no overflow | 2195 px high, no overflow | class-wide pattern begins at y=1003; need map at y=1629 |
| `/teacher/class` | 1050 px, no overflow | 1560 px, no overflow | meets the approximate 1600 px collapsed-group target |
| `/teacher/questions` | 1124 px, no overflow | 1279 px, **24 px overflow** | two-column choice minimums exceed the panel content width |
| `/teacher/assignments` | 900 px, no overflow | 908 px, no overflow | acceptable baseline |
| `/system` | 900 px, no overflow | 1280 px, no overflow | acceptable baseline |

The canonical domain also logs one console error because Cloudflare Web Analytics injects a beacon
that the repository CSP correctly blocks. The product constitution forbids an analytics beacon on
the critical path; disable the injection rather than weakening `script-src 'self'`.

## UI/UX review

The table format follows the required `emil-design-eng` review contract.

| Before | After | Why |
| --- | --- | --- |
| Closed drawer is translated off-screen but remains keyboard-focusable (`AppLayout.tsx:71`, `global.css:1408`) | When closed on mobile, make the drawer non-interactive/non-focusable; on open, move focus into the current navigation item; close on `Escape`, backdrop click and route selection; restore focus to Menu | Apple-style agency and wayfinding require predictable entry, exit and focus. The browser test reached links at negative x positions while the drawer was closed. |
| `.choice-grid` always uses `repeat(auto-fit, minmax(160px, 1fr))` (`global.css:1686`) | At `max-width: 34rem`, use one column: `grid-template-columns: minmax(0, 1fr)` | Two 160 px columns plus the gap are wider than the mobile panel content box, producing 24 px horizontal overflow. |
| Mobile `.metric-grid` becomes one column (`global.css:1509`), consuming roughly 516 px before the decision region | Keep a compact 2×2 metric grid on mobile, then present the class policy trigger and priority formula as one related decision block | The teacher must see coverage, class pattern, top group, formula and action inside the first 844 px. The same K02 root should read as one decision, not two unrelated cards. |
| Account action “Đổi” measures 37×44 px (`global.css:530`) | Give it `min-width: var(--touch-target)` and the accessible name “Đổi tài khoản” | The product deliberately targets 44×44 controls; the current width misses that enhanced target. |
| Four metric cards use equal visual weight even though only coverage and action counts support the next decision | Preserve all four values, but reduce their mobile padding/type scale and keep the top intervention dominant | Simplicity is hierarchy, not removal. Teachers need the facts without scrolling past the decision. |

## Animation review

### Findings

| # | Severity | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Accessibility / spatial consistency | `src/components/AppLayout.tsx:60-122`, `src/styles/global.css:1408-1451` | The mobile drawer moves, but focus does not move with it; `Escape` does nothing and closed links remain tabbable off-screen. The backdrop also appears/disappears without a continuity transition. | Implement the self-contained drawer plan in `plans/001-fix-mobile-drawer-continuity.md`. |
| 2 | MEDIUM | Accessibility | `src/styles/global.css:1543-1551` | Reduced motion changes every animation and transition to 0.01 ms, removing useful color/opacity feedback as well as movement. | Disable positional movement selectively while retaining 160 ms color/opacity feedback; see plan 002. |
| 3 | MEDIUM | Performance | `src/styles/global.css:633-644` | The full loading block animates `background-position`, a paint-heavy property, for an indefinite 1.4 s shimmer. | Move the sheen on a pseudo-element with `transform: translateX()` and provide a static reduced-motion state; see plan 003. |
| 4 | LOW | Easing / physicality | `src/styles/global.css:185-188`, `219-223` | Press feedback uses built-in `ease` and a 1 px translation. It is responsive but lacks the stronger house curve and physical scale response. | Introduce `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` and use `scale(0.97)` over 120 ms; remove the transform under reduced motion. |

### Review verdict

**Block the mobile drawer interaction from being called accessibility-complete.** The transition
itself is short enough, but motion and focus tell conflicting spatial stories. Other teacher
motion is restrained, which is correct for a frequently used, information-dense decision surface.
There is no `transition: all`, `scale(0)`, `ease-in`, long UI transition or decorative chart motion.

## Motion opportunities

### Opportunities table

| # | Location | Today | Purpose | Frequency | Suggested motion |
| --- | --- | --- | --- | --- | --- |
| 1 | Mobile navigation drawer | Drawer slides while backdrop teleports and focus stays behind it | Spatial consistency / state indication | Occasional | **Continuity transition**: drawer `transform 180ms cubic-bezier(0.23, 1, 0.32, 1)`; backdrop `opacity 160ms` on the same curve; carry focus into/out of the drawer. Reduced motion keeps the opacity change and makes the translation instant. |
| 2 | Teacher group `<details>` | Evidence appears instantly | State indication / preventing a jarring change | Occasional | **Accordion / Collapse**: rotate a custom disclosure marker over 160 ms and reveal detail with `opacity` plus at most 4 px translation over 180 ms using the shared ease-out curve. Reduced motion keeps opacity only. |
| 3 | Question save status | Saved/error copy appears instantly | Feedback | Occasional | Enter with `@starting-style`: `opacity: 0` to `1` over 160 ms using the shared ease-out curve. Do not delay the status announcement. |

Vocabulary is used precisely: a **continuity transition** visually connects before and after;
**Accordion / Collapse** smoothly exposes or hides a section; **Press / Tap feedback** confirms a
press through a subtle physical response.

### Rejected candidates

- Metric number tickers — **Rejected: functional data teachers must read; movement adds no state
  information.**
- Staggered group-row entrances — **Rejected: the comparison is frequent and information-dense;
  a cascade delays scanning.**
- Route/page transitions — **Rejected: navigation is used tens of times per day and should feel
  immediate.**
- Animated class-wide progress on initial load — **Rejected: the 12/40 ratio is a static evidence
  statement, not live progress.**

### Opportunity verdict

The teacher workspace needs very little additional motion. The mobile drawer is the only
high-leverage animated seam because it currently contradicts focus and spatial state. Disclosure
and save-status transitions are optional polish after the layout and keyboard defects are fixed.

## Recommended execution order

1. Fix mobile drawer focus, exit behavior, hidden-state tab order and its easing.
2. Fix `/teacher/questions` mobile overflow with a one-column choice grid.
3. Compress `/teacher` mobile metrics and unify the K02 class-policy/top-priority relationship.
4. Restore useful feedback under reduced motion.
5. Move the loading shimmer to compositor-friendly motion.
6. Re-run the route matrix, keyboard test, 200% zoom, offline reload, format/lint/typecheck/test/eval/build.

The animation plans are intentionally separate from source implementation because the selected
skills require an audit-and-plan handoff. They contain exact values and verification steps for an
executor working from this commit.

## Execution result

Implemented on `codex/teacher-ui-plan` in commits `3d527ea` and `11c3573` and reviewed against the
`review-animations` bar. The review removed the remaining animated box shadow before approval.

- `/teacher` at 390×844 now has no horizontal overflow; the primary intervention CTA measures
  44 px high and ends at y=843 inside the first viewport.
- The overview remains domain-derived: 40 learners, 32 sufficiently evidenced profiles, class
  pattern 12/40 and priority `36 = 12 × 3`.
- `/teacher/questions` reflows to one choice column at 390 px with
  `scrollWidth = clientWidth = 390`.
- Closed drawer controls have `tabIndex=-1`; opening focuses the current route; `Escape`, backdrop
  and route selection close it; Tab and Shift+Tab remain trapped inside while open.
- Reduced motion makes drawer travel effectively instant while preserving 160 ms color/opacity
  feedback. Loading shimmer animates only a pseudo-element transform and becomes static when
  reduced motion is requested.
- Browser QA covered all teacher routes and `/system` at 390, 768, 1280 and 1440 px with no
  horizontal overflow or post-login console/page error. A production service-worker reload kept
  `/teacher` available offline with the honest offline status.
