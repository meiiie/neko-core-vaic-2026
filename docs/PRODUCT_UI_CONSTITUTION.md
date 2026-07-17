# NekoPath product and UI constitution

Status: binding handoff for product, UX/UI and implementation review  
Evidence cutoff: 2026-07-15  
Product: Vietnam AI Innovation Challenge 2026 — Adaptive tutor for the mixed-ability classroom

## 1. Honest verdict

The current direction is strong for a 48-hour build because it proves the brief with one narrow,
falsifiable vertical slice:

- a deterministic prerequisite graph and mastery state rather than a generic chatbot;
- different evidence can produce different roots for the same visible error;
- the system abstains when evidence is ambiguous and fast-tracks a ready learner;
- the teacher sees need groups, transparent priority and a class-wide pattern;
- the core, content and local records continue without a provider or network;
- the repository discloses synthetic data, unreviewed content and evaluation limits.

This is closer to the strongest available evidence than adding RAG, voice, a deeper KT model or an
agent runtime. A 2026 Stanford review found only 20 high-quality causal studies among more than 800
AI-in-K–12 papers, so NekoPath must not claim learning gains or “SOTA” without a real study. The
competition target is **best-in-class reproducible evidence and decision clarity**, not an
unsupported leaderboard label.

### Green — keep

- TypeScript local-first PWA; one deployable unit.
- Pure deterministic diagnosis/grouping functions and versioned structured content.
- Named simple baselines, independent simulator and safe abstention.
- Teacher as the primary decision user; student interaction supplies evidence.
- No login, external model, backend, RAG, vector store, voice or cloud sync on the critical path.
- Truth labels for simulation, review state, uncertainty and local-only storage.

### Amber — improve before final submission

- All curriculum edges/items remain `UNREVIEWED`; named teacher/mentor review is the largest product
  risk.
- Six independently owned held-out labels and their frozen report are not complete.
- The student hero profiles and 40-person class are separate simulations. Do not imply that one
  student answer updates the class dashboard until that behavior exists.
- The browser/offline journey has been manually exercised but is not yet a reproducible repository
  E2E suite or CI gate.
- The teacher mobile page is readable but 2,555 px tall; the first decision is visible, while group
  comparison still needs a denser collapsed form.
- The current UI contains a few presentation values as inline styles; semantic tokens should own
  every non-data-driven value.

### Red gate — do not pitch past this

- Never present the authored graph as scientifically validated or aligned to the whole 2018
  curriculum until a named reviewer accepts the exact nodes, edges, questions and wording.
- Never report synthetic root accuracy as student learning improvement.
- Never let repeated clicks, event reordering or duplicate records change evidence accidentally.
- Never say “đúng/chắc chắn” when the output is an evidence-backed, unreviewed hypothesis.

## 2. Product boundary

### Primary users

1. **Teacher:** decide which need to address first, with what group and why.
2. **Learner:** answer the smallest useful check and follow a bounded repair/advance path.
3. **Judge/operator:** verify truth labels, offline behavior, versions and reset the demo.

Parents, school administrators, content authors and national analytics are outside the MVP.

### Product promise

> When learners make the same visible mistake for different reasons, NekoPath follows reviewed
> prerequisite evidence, asks the smallest useful diagnostic question, and returns a correctable
> learning path plus a transparent teacher action—even when the network is unavailable.

### Explicit non-features

No registration/login, JWT, role permissions, onboarding wizard, parent portal, chat, voice,
avatar, gamification, leaderboard, notification center, RAG, content search, LMS integration,
payment, admin panel or second backend. Add one only after a representative test proves it is
required by the official brief or prevents the 90-second proof.

## 3. Information architecture: exactly five product surfaces

| Route | User decision | Required content | Must not become |
|---|---|---|---|
| `/` | Which proof should I inspect? | thesis, An→Bình guided comparison, four profiles, teacher CTA, truth label | marketing landing page |
| `/learn/:learnerId` | What should this learner answer now? | target context, selected diagnostic/transfer item, choices, save state, why this item | chatbot or course catalog |
| `/path/:learnerId` | Why this decision and what comes next? | status, root/alternatives, repair path or abstention, audit details | raw event viewer |
| `/teacher` | Who/what should I help first? | class coverage, whole-class gap, top intervention, comparable need groups, evidence disclosure | analytics wallpaper |
| `/system` | Is the demo reliable and recoverable? | local storage state, versions, offline/update state, reset | settings product |

A dedicated `/compare` route is **not admitted yet**. The current lower-risk proof is a guided
`An → Bình` sequence. Add side-by-side comparison only if a cold observer cannot state the
difference after that sequence; do not add a sixth page for visual novelty.

## 4. State contract by surface

| Surface | Required states |
|---|---|
| shell | online, offline, update available, simulation disclosure |
| home | normal, invalid/deep-link recovery |
| learner | local loading, question ready, saving, saved, storage error, diagnosed, needs evidence, fast path, out of scope |
| path | diagnosed root, competing roots/abstention, no valid path, fast path, technical details closed/open |
| teacher | class summary, class-wide gap present/absent, ranked groups, group detail closed/open, zero learners |
| system | estimate available/unavailable, persistent storage granted/denied/unknown, reset confirm/success/error |

Each state needs one primary message and at most one primary action. Loading must not use fake
streaming. Color never carries the state without text.

## 5. Cold-judge journey

The navigation and copy must make this sequence self-guiding:

1. Home: understand “same surface error, different root” in under 15 seconds.
2. An: see the equivalent-fraction root and its minimal path.
3. Follow the explicit next action to Bình: see a ratio-meaning root for the same target.
4. Chi: see safe abstention and answer one discriminating question.
5. Minh: receive the real transfer item rather than remediation.
6. Teacher: identify the first group, formula, action and class-wide numerator/denominator.
7. Disable the network, reload and complete one interaction locally.

The student hero profiles and aggregate class are separate simulation views. Say so if asked; do
not stage a fake synchronization animation.

## 6. Geometry with meaning

“Mathematical design” means consistent constraints and faithful data encoding—not a golden ratio,
Fibonacci decoration or arbitrary numerology.

### Base spatial system

Use a 4 px quantum and the fixed scale below. Values exist because screens need both compact
component relationships and larger section boundaries; multiples of 4 render predictably and match
widely used 4/8-based systems.

| Token | px | Semantic use |
|---|---:|---|
| `space-1` | 4 | text/chip micro-gap only |
| `space-2` | 8 | tightly related label/value, choice stack gap |
| `space-3` | 12 | heading-to-supporting-copy, compact row gap |
| `space-4` | 16 | standard component padding; mobile page gutter |
| `space-6` | 24 | panel padding; blocks inside one task; tablet gutter |
| `space-8` | 32 | major separation on mobile |
| `space-12` | 48 | major section separation on desktop |
| `space-16` | 64 | rare page/hero separation only |

Rules:

- Related items are 8–12 px apart; different subgroups are 16–24 px apart; separate decisions are
  32–48 px apart.
- Never type raw `margin: 13px`, `padding: 22px` or equivalent. Use a token or document a measured
  optical exception.
- Do not add space to repair weak hierarchy; first remove unnecessary containers/copy.
- Inline styles are allowed only for data-bound values such as a proportion width. Typography,
  spacing, radius, border and color always use semantic classes/tokens.

### Page geometry

| Property | Mobile | Tablet | Desktop |
|---|---:|---:|---:|
| viewport design check | 320–479 | 768–1023 | 1280×720 and 1440×900 |
| page gutter | 16 | 24 | 32 |
| content max width | fluid | fluid | 1120 |
| reading measure | 100% | 60–70ch | 65–72ch |
| major section gap | 32 | 40 | 48 |
| header total height target | ≤144 | ≤80 | ≤72 |

Breakpoints follow content failure, not named devices. Start with fluid single-column content;
introduce two-column comparison only when each column can retain at least 320 px of usable width.

### Radius, border and elevation

- Control radius: 8 px.
- Decision panel radius: 12 px.
- Status chip radius: pill only when it is text-sized; otherwise 8 px.
- Neutral boundary: 1 px.
- Evidence/review accent: 4 px leading border.
- Keyboard focus: 3 px high-contrast outline with 2 px offset.
- No decorative shadow. A raised surface may use one subtle shadow only if its z-order is
  interactive; normal sections use whitespace and rules.

## 7. Typography and mathematical content

Use the offline system stack. Keep all line heights on a 4 px rhythm.

| Role | Size / line | Weight | Use |
|---|---|---:|---|
| metadata | 14 / 20 | 400–600 | IDs, versions, review note; never core instruction |
| body | 16 / 24 | 400 | all task content |
| emphasis | 18 / 28 | 600 | prompt, group action, root result |
| section heading | 24 / 32 | 700 | one decision region |
| page heading | 32 / 40 | 700 | one per route |

- Use only weights 400, 600 and 700; no faux-thin text.
- Use sentence case. Never use all caps for status or headings.
- Use `font-variant-numeric: tabular-nums` for counts, percentages and priority formulas.
- Never turn mathematics into an image. For simple expressions, readable text plus an accessible
  label is enough; introduce MathML only when notation structure becomes ambiguous. Do not add
  KaTeX for the current four questions.
- A formula such as priority must expose its operands: `36 = 12 đủ bằng chứng × 3 kỹ năng bị
  chặn`; never show a score without its derivation.

## 8. Semantic color

The palette is functional, not decorative:

| Token | Starting value | Meaning |
|---|---|---|
| `canvas` | `#F4F0E6` | quiet classroom paper |
| `surface` | `#FFFCF5` | task/decision surface |
| `ink` | `#17211D` | primary content |
| `muted` | `#5B625D` | secondary/audit content |
| `rule` | `#D8D0C0` | structure only |
| `evidence` | `#006B61` | sufficient evidence, supported path, primary action |
| `review` | `#9A5A00` | ambiguity, review required, offline caveat |
| `danger` | `#B42318` | destructive action or actual error only |
| `focus` | `#1358BE` | keyboard location only |

- Green means evidence is sufficient under the demo rule; it does not mean scientific truth.
- Amber means “check/review”, not failure or low ability.
- Never assign identity colors to learners or imply a red/green ability label.
- Text and controls target WCAG 2.2 AA contrast. Focus and meaningful graphical boundaries target
  at least 3:1 against adjacent colors.

## 9. Component constitution

These are semantic patterns, not a mandate to create one React file per row. Extract a component
only after two real uses or when behavior/accessibility must be centralized.

| Pattern | Required anatomy | Exact geometry | Invariant |
|---|---|---|---|
| app shell | brand, truth labels, one nav | 16 px mobile / 24 px desktop internal gap; brand target ≥44 | never imply authentication |
| status label | state text | 4×12 padding; 14/20 type; 1 px border | text + color |
| evidence note | one caveat | 12 px leading padding; 3–4 px amber rule | no alarm styling |
| action panel | heading, decision, one CTA | 16 mobile / 24 desktop padding; 4 px semantic edge | one dominant action |
| profile selector | name, evidence-state note | 16 padding; minimum 44 target | adapter data only |
| process strip | target, check, repair/advance | 8 gap; 8×12 step padding | current step announced |
| question | prompt, choices, reason, save state | choice height ≥48; 8 gap; prompt 18/28 | one write per gesture |
| knowledge path | ordered KC steps | 16 vertical per step; zero decorative nodes | order and start/target in text |
| proportion | number, denominator, zero-based bar | 8 px bar; max 320; text adjacent | area/length matches value |
| need group | title, priority, three factors, action, disclosure | 16 padding; 12 row gaps | comparable order across groups |
| disclosure | clear summary, detail | summary target ≥44 | no primary action hidden |
| reset confirmation | consequence, confirm, cancel | danger only on confirm | no destructive default focus |

For data visualizations, length begins at zero, numerator/denominator remains visible and a screen
reader receives the same value. Prefer native `<progress>` or `role="progressbar"` with
`aria-valuemin`, `aria-valuemax` and `aria-valuenow` over `role="img"` when the value is progress or
proportion.

## 10. Surface-specific rules

### Home

- First viewport: headline, one-sentence teacher outcome, guided An→Bình start, teacher CTA.
- Four profiles show distinct evidence states; do not expose a guaranteed root in marketing copy.
- Truth disclosure stays visible without competing with the primary action.
- Do not add testimonials, logos, feature bento cards or “AI-powered” copy.

### Learner

- The target task context must appear before or beside the selected check; it cannot feel like an
  unrelated quiz.
- Choices are full-row controls, at least 48 px high, and lock during persistence.
- The reason for asking is one short explanation; raw KC/item IDs remain secondary.
- After answer: announce saving/saved/error, then update the next item or path without fake typing.
- Transfer item is a real question; never link to a page with no challenge.

### Evidence and path

- Information order: decision → action/path → audit detail.
- Diagnosed: name the evidence-supported root and ordered repair path.
- Ambiguous: show competing hypotheses and exactly one next check; never fabricate confidence.
- Fast path: show what was skipped and the real transfer action.
- Guide An explicitly to Bình so the core comparison is not dependent on a presenter.

### Teacher

- First 844 px: class size/coverage, class-wide pattern, top group, formula and action.
- Do not repeat the same K02 intervention as two equal-priority cards. One is the class policy
  trigger; one is the ranked need group—visually state that relationship.
- Collapsed group rows must remain comparable. Expanded IDs/events are audit detail.
- Mobile target: the complete collapsed four-group summary should fit within roughly 1,600 px;
  secondary evidence opens on demand. Do not reduce type below 16 px to hit this.
- A 30% rate that equals a 30% threshold “đạt điều kiện”; it does not “vượt ngưỡng”.

### System

- Human-readable local/offline state first, version details second.
- Reset is visually quiet until confirmation.
- No unrelated settings or deployment diagnostics.

## 11. Accessibility contract

- Target WCAG 2.2 AA; 44×44 task targets are an intentional enhanced touch target beyond the AA
  24×24 minimum.
- Reflow at 320 CSS px without two-dimensional scrolling or lost function.
- One `h1` per route; heading levels reflect structure rather than visual size.
- Keyboard order equals visual order; focus is visible and never obscured.
- Links describe their destination; avoid identical “Xem thêm” labels.
- State changes use `status` or `alert` appropriately and never color alone.
- Respect reduced motion; no timed content or auto-advancing steps.
- At 200% zoom, primary action, answer options and disclosures remain operable.
- Vietnamese diacritics, mathematical notation and abbreviations remain readable by assistive
  technology; raw IDs are never the only label.

## 12. Performance and reliability budgets

- Core diagnosis p95: <300 ms on the event laptop.
- Initial app JS: keep ≤150 KiB gzip unless a measured user-critical feature justifies growth
  (current integrated build: 137.80 KiB gzip).
- No remote font, analytics beacon, large hero image or external runtime on the critical path.
- No console/page errors in the full route matrix.
- One gesture produces at most one learner event; duplicate IDs remain idempotent.
- Direct route, service-worker update, offline hard reload, local answer, reset and reconnect are
  automated before final submission.
- Clean clone runs format, lint, typecheck, unit, eval, E2E and production build on Node 24 LTS.

## 13. UX/UI teammate handoff

The design teammate should deliver one coherent system, not disconnected “beautiful screens”:

1. token sheet with color, type, spacing, radius, border and state meanings;
2. component anatomy/state sheet for the patterns in section 9;
3. desktop 1440×900 and mobile 390×844 frames for home, Chi question, An path, Chi abstention,
   Minh transfer, teacher collapsed groups and system reset confirmation;
4. one expanded teacher group and one storage-error/offline state;
5. annotated interaction links for An→Bình, Chi answer→next check, Minh→transfer and reset;
6. contrast values, target sizes and keyboard/focus order notes;
7. a change list mapped to existing routes/components, not a replacement architecture.

Review sequence:

1. product truth and state correctness;
2. uncoached 90-second task clarity;
3. accessibility and responsive reflow;
4. visual rhythm and polish;
5. only then implementation.

No implementation starts from a screenshot alone. Each frame must identify the adapter data/state
that drives it, empty/error/offline behavior and the token used for every measurement.

## 14. Current Fable review

Commit `21dad18` (integrated as `d80fbe5`) passed format, lint, typecheck, 45/45 unit tests, 23/23
eval checks, production PWA build and zero high dependency vulnerabilities.

Confirmed improvement:

- duplicate role controls removed;
- path and abstention hierarchy materially clearer;
- teacher priority appears before group detail;
- mobile has no horizontal overflow and console capture is clean;
- truth labels and domain-derived values remain intact.

Corrections already applied during Codex integration:

- answer persistence now guards against double-click duplicate writes;
- An now guides explicitly to Bình and the home copy no longer claims the system “finds the right”
  root;
- equality wording at the 30% policy threshold now says the condition is met, not exceeded;
- the brand is now a 44 px target;

Next polish:

- compress the collapsed mobile teacher comparison without hiding its action;
- move non-data-driven inline styles into semantic tokens/classes;
- add reproducible browser/offline gates after the visual system stabilizes.

## 15. Research basis (sources available by 2026-07-15)

- [Stanford SCALE — Evidence Base on AI in K–12 (2026)](https://scale.stanford.edu/research-in-action/understanding-evidence-base-ai-k12-education): rigorous causal evidence remains thin; constrain claims and keep the teacher central.
- [Access Is Not Enough (2026)](https://scale.stanford.edu/publications/access-not-enough-human-support-improves-engagement-ai-tutoring): two RCTs show that access alone does not guarantee use or learning; human support and implementation matter.
- [Knowledge-tracing reliability re-evaluation (2026)](https://arxiv.org/abs/2605.04727): sequence construction and configuration can inflate results, while extra complexity does not consistently win; preserve time order, simple baselines and frozen evaluation.
- [LearnLens teacher dashboard (2025)](https://arxiv.org/abs/2509.10582): teacher interviews favor classroom patterns, concept summaries and representative evidence that guide instruction.
- [CAST UDL Guidelines 3.0](https://udlguidelines.cast.org/more/about-guidelines-3-0/): connect prior knowledge, clarify mathematical symbols, provide action-oriented feedback, support transfer and varied accessible interaction.
- [OATutor](https://github.com/CAHLR/OATutor): an open-source React/BKT tutor can run statically with optional logging; expert-curated content and explicit skill mappings matter more than an obligatory backend.
- [web.dev offline data](https://web.dev/learn/pwa/offline-data): Cache Storage fits network assets; IndexedDB fits structured local learner data; storage remains user-controlled.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): reflow, focus, labels and target size are product requirements, not finishing polish.
- [IBM Carbon spacing](https://carbondesignsystem.com/elements/spacing/overview/): a tokenized scale using multiples of 2/4/8 supports both component relationships and layout density.
- [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/): shared semantic token names create cross-tool vocabulary. For this 48-hour product, CSS variables remain the source of truth; adding a token build pipeline would be unnecessary.

Papers first appearing after 2026-07-15 are deliberately excluded from this decision record.
