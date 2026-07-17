# NekoPath image-generation and UX/UI lab

**Status:** research and review workspace; not a product surface.  
**Evidence cutoff:** 2026-07-15.  
**Owner:** UX/UI teammate proposes; Codex integrates only reviewed outcomes.

This lab turns visual exploration into testable UX decisions. It exists to prevent two opposite
failures: shipping generic AI-generated screenshots as an app, and discussing visual taste without
an auditable decision trail.

## Non-negotiable boundary

NekoPath is a calm, evidence-first classroom intervention notebook. It is not a marketing site,
generic AI dashboard, chatbot, mascot product, or decorative ed-tech experience. The product
constitution remains authoritative.

- Generated screen images are **composition references only**. They never become an implementation
  specification, are not screenshots of a functioning feature, and do not replace HTML/CSS,
  semantic markup, or interaction tests.
- Exact Vietnamese copy, mathematics, learner numbers, priority values, states, focus rings and
  accessibility labels must come from code and deterministic adapter data, not from pixels.
- Do not introduce a large hero image, remote image request, font, tracking beacon, or extra runtime
  into the PWA critical path. The current performance budget is binding.
- No real learner faces, names, schools, accounts, PII, national symbols, third-party logos, or
  copied assets/prompts enter this directory.
- An image may be promoted only after a reviewer records why it helps a named route/state and it
  passes the rubric in `REVIEW_RUBRIC.md`. A rejected image remains a research artifact, never a
  silent product dependency.

## Directory map

| Path | Purpose | Git policy |
|---|---|---|
| `RESEARCH_NOTES.md` | Evidence-based UI rationale and source links | committed |
| `SCREEN_SPEC_TEMPLATE.md` | Route/state contract before visual work | committed |
| `PROMPT_LIBRARY.md` | Versioned, copy-ready visual exploration prompts | committed |
| `REVIEW_RUBRIC.md` | Deterministic human/AI review checklist | committed |
| `ASSET_REGISTER.md` | Prompt → candidate → decision provenance | committed |
| `generated/` | Unreviewed local drafts | ignored except `.gitkeep` |
| `approved/` | Curated noncritical candidate assets | committed only after approval |

## Workflow: contract → image → code → browser proof

1. **Name the decision.** Create a screen spec from `SCREEN_SPEC_TEMPLATE.md`. One frame must
   answer one user decision and map every state to existing adapter data or a named missing contract.
2. **Choose the proper medium.** Use CSS/components for layout, type, cards, forms, math, data bars,
   navigation and icons. Use image generation only for a visual reference, a pitch illustration, or
   a noncritical raster asset whose purpose cannot be fulfilled by code.
3. **Generate narrowly.** Use one prompt from `PROMPT_LIBRARY.md` per visual question. Require blank
   text areas or abstract placeholders; never trust generated text, metrics or diagrams as product
   facts. Save raw output under `generated/` with the job ID.
4. **Review before translation.** Apply `REVIEW_RUBRIC.md` with a human reviewer. Record accepted,
   rejected, or revise in `ASSET_REGISTER.md`; preserve the prompt and reason.
5. **Translate principles, not pixels.** Write CSS variables/components using the contract's spacing,
   type, color and state tokens. Do not copy a generated screenshot as a background or fixed layout.
6. **Prove the interaction.** At 390×844, 768×1024, 1280×720 and 1440×900 verify keyboard order,
   44 px task targets, reflow, 200% zoom, reduced motion, offline state and the 90-second
   walkthrough. The browser result, not image attractiveness, decides promotion.

## Quality gates

The gates run in this order:

1. product truth and deterministic state correctness;
2. uncoached task clarity for student and teacher;
3. accessibility and responsive reflow;
4. visual hierarchy, spacing and typography;
5. performance/offline/CI verification.

Use AI-assisted visual critique as a second pair of eyes for density and layout defects, not as a
substitute for a teacher, learner or accessibility review. See `RESEARCH_NOTES.md`.

## First lab cycle

The first cycle is deliberately small and has no permission to change product code:

- **T01:** Teacher first-decision hierarchy — class-wide gap, first intervention, comparable groups.
- **S01:** Student check-in hierarchy — target context, one diagnostic choice, local-save state.
- **P01:** Explainable path — decision, smallest next action, audit detail progressively disclosed.

Each output is a hypothesis about visual hierarchy. It must not create a new route, score,
probability, learner attribute, curriculum claim, or model behavior.

