# Visual-review rubric

Use this rubric before any image-derived design change or asset promotion. Mark every criterion
**pass**, **revise**, or **reject**, and record the reason in `ASSET_REGISTER.md`.

## 1. Product truth — hard gate

- Maps to one existing route, named state and adapter data source.
- Does not turn a hypothesis, synthetic profile, unreviewed content or local demo into a factual
  claim.
- Does not invent a score, confidence, learner attribute, curriculum alignment, model capability or
  teacher action.
- Keeps the teacher's role and learner agency visible; no answer-generating/chat-first interaction.
- Has no real PII, faces, school identity, copyrighted mark or copied reference asset.

Any failure is **reject**.

## 2. Decision clarity — hard gate

- One screen answers one decision; one dominant action is obvious.
- First viewport has the correct priority: teacher action/evidence or learner question/context.
- Different evidence states look distinguishable without using color alone.
- Technical/audit detail is available but cannot dominate action or reading order.
- An uncoached observer can complete the named task in the intended 15–20 second window.

## 3. Accessibility and responsive behavior — hard gate

- Exact text remains code, not pixels; math is accessible text/MathML when necessary.
- Task controls have 44×44 px targets; focus has a 3 px visible outline and 2 px offset.
- Color pairings meet WCAG 2.2 AA for text/controls; state has a text equivalent.
- Keyboard order follows visual order; no required drag; overlays do not obscure focus.
- Reflow works at 320/390 px, 200% zoom and reduced-motion settings.

## 4. Geometry and typography — required

- Uses the 4 px quantum and semantic spacing groups: 8–12 related, 16–24 subgroup, 32–48 decision
  separation.
- Respects existing 16/18/24/32 px type roles, system font and readable 65–72ch desktop measure.
- Uses tabular figures for counts/priority and zero-based lengths for any proportion.
- Uses whitespace and rules before adding a new card or shadow.
- Sidebars, page gutters and content widths follow the product constitution rather than fixed image
  geometry.

## 5. Visual direction — required

- Calm classroom intervention notebook: warm, practical, evidence-first.
- No generic AI dashboard cues: bento walls, gradients, glow, glass stacks, floating blobs, fake
  live indicators, AI orb or mascot.
- Accent colors retain semantic meaning: teal=evidence, amber=review, red=destructive/error,
  blue=focus only.
- Motion, if any, communicates a real state change, uses transform/opacity, is interruptible where
  gesture-driven and respects reduced motion.

## 6. Technical promotion — required for an asset

- Raw generation is stored as an unreviewed draft with prompt ID and timestamp.
- Human reviewer signs off the intended noncritical use.
- File is optimized, dimensioned for its exact use and not on the PWA critical path.
- License/provenance, prompt and reviewer decision are recorded.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run eval` and
  `npm run build` remain green after integration.

