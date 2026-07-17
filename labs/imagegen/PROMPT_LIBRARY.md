# Prompt library

All prompts are **visual research prompts**, not implementation tickets. Generate each prompt as a
separate image; do not batch unrelated concepts into one result. Keep exact words, equations,
metrics and Vietnamese labels out of the image. The codebase owns them.

## Shared constraints

Append these to every prompt:

```text
Use this only as a high-fidelity composition and hierarchy reference, not a functioning UI screenshot.
No readable text, no numbers, no equations, no labels, no logos, no watermark and no brand names.
Use blank text bars and neutral abstract placeholders where production copy would live.
Do not invent learner information, charts, metrics, chat bubbles, avatars, AI orbs, gradients,
glassmorphism, glowing effects, confetti, dark command-centre styling or generic bento-card walls.
No human faces, school logos, national symbols or personal data.
```

## T01 — Teacher first-decision hierarchy

```text
Use case: ui-mockup
Asset type: composition reference for a teacher intervention dashboard, desktop 1440x900
Primary request: show one clear classroom action at the top, followed by a calm class-wide evidence
summary and four comparable intervention rows. The visual hierarchy must let a teacher identify
what to do first in a few seconds; evidence and uncertainty are visible but secondary.
Scene/backdrop: warm quiet classroom notebook paper, no illustration
Style/medium: restrained editorial education software, crisp code-native layout principles
Composition/framing: persistent left navigation, a narrow status strip, generous reading measure,
one decision panel above a compact table-like group comparison. Use rules, whitespace and type
scale instead of nested cards.
Lighting/mood: calm, trustworthy, practical, low cognitive load
Color palette: warm off-white canvas, dark green-black ink, muted sage/stone boundaries, one deep
teal evidence accent, one amber review accent, one blue focus accent
Materials/textures: matte paper-like surfaces; flat, no gradients, no glass
Constraints: use only abstract placeholder bars; leave room for a denominator, a rationale and a
single primary action; data needs a clear zero-baseline visual representation
Avoid: all readable text, invented metrics, radial charts, decorative photos, AI dashboard tropes
```

## S01 — Student diagnostic check-in

```text
Use case: ui-mockup
Asset type: composition reference for a student adaptive math check-in, mobile 390x844
Primary request: create a focused single-task mobile screen where target context, one diagnostic
question, full-width answer choices, a small explanation of why the question is asked, and a local
save status are visually ordered. The learner should see exactly one next action.
Scene/backdrop: quiet warm notebook interface, no classroom photograph
Style/medium: calm accessible educational software, precise and code-native rather than playful
Composition/framing: compact top navigation, a three-step orientation strip, one dominant question
surface, four large vertically stacked choices, a single confirmation area at the bottom. Leave
whitespace and room for Vietnamese diacritics and mathematical notation.
Lighting/mood: reassuring, focused, no gamification
Color palette: same warm canvas/dark ink/deep teal evidence/amber review/blue focus system as T01
Materials/textures: flat semantic surfaces, thin rules, no gradients or shadows except an
interactive elevation cue
Constraints: blank text placeholders only; task controls look at least 44 px tall; no feedback
before a choice is confirmed; no score, streak, mascot, chat or generated answer
Avoid: readable text, equations, fake progress claims, cards inside cards, decorative illustrations
```

## P01 — Explainable path and safe abstention

```text
Use case: ui-mockup
Asset type: composition reference for a learner evidence/path screen, desktop 1440x900
Primary request: make the difference between a supported learning path and an ambiguous hypothesis
instantly understandable. Show decision first, one next action second, and technical audit detail
progressively disclosed. The display must make uncertainty feel responsible rather than broken.
Scene/backdrop: warm evidence notebook, no imagery
Style/medium: clear information design for a teacher and learner, restrained editorial interface
Composition/framing: main column contains a verdict/status, a vertically ordered prerequisite trail
with start/target relationship, and one action; a quiet side disclosure holds audit information.
Use labeled steps and text-space placeholders, never a decorative network graph.
Lighting/mood: transparent, calm, intellectually honest
Color palette: warm paper, ink, deep teal for sufficient evidence, amber for review/uncertainty,
blue only for focus
Materials/textures: flat with subtle rule lines; no glow, no gradient, no glass
Constraints: show a possible next discriminating check as a clear area; leave all labels blank;
technical detail must look secondary and expandable
Avoid: probabilities, confidence percentages, raw IDs in the dominant region, chatbot UI, data art
```

## A01 — Optional pitch illustration (not for core PWA)

```text
Use case: scientific-educational
Asset type: optional presentation/video background with empty copy-safe space
Primary request: a refined flat editorial illustration of an abstract learning path moving from a
small foundational fraction tile toward a higher-level proportional reasoning tile, with a teacher
reviewing a simple class evidence strip. No student faces, no physical classroom, no text.
Composition/framing: horizontal 16:9, visual activity on the right third and generous clean negative
space left for slide copy
Style/medium: contemporary Vietnamese educational editorial illustration, restrained flat geometric
shapes, not cartoonish
Color palette: NekoPath warm paper, deep ink, teal evidence, amber review, minimal blue focus
Constraints: no numbers, letters, equations, logos, gradients, watermark or claims of success
Avoid: AI robots, glowing brains, generic graduation caps, photorealistic students, UI screenshots
```

