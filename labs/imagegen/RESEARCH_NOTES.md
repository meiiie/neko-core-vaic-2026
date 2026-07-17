# Research notes — design decisions for the imagegen lab

**Research cutoff:** 2026-07-15.  
**Method:** primary standards and official lab/organization material first; research papers only
inform the review method. These notes do not claim that generated visuals improve learning outcomes.

## Decisions grounded in evidence

| Finding | NekoPath decision | Evidence |
|---|---|---|
| AI-in-K–12 research is growing faster than rigorous causal evidence; pedagogical guardrails and teacher support matter more than a general answer generator. | Keep the teacher's first action, evidence and denominator above the fold. Do not market an image, model, or generated copy as proof of learning impact. | [Stanford SCALE, 2026](https://scale.stanford.edu/research-in-action/understanding-evidence-base-ai-k12-education) |
| Good feedback communicates status, success/failure, warning or correction at a level of interruption proportional to its importance. | Use persistent nearby save/offline/status messages; reserve modal interruption for destructive reset. Never add fake typing or decorative success animations. | [Apple HIG — Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback) |
| Purpose, agency, responsibility, familiarity, flexibility, simplicity, craft and delight are complementary design principles. | Every experiment must state its user decision, preserve control and disclose uncertainty. “Delight” is earned by clarity and responsiveness, not visual effects. | [Apple HIG — Design principles, 2026-06-08](https://developer.apple.com/design/human-interface-guidelines/design-principles) |
| WCAG 2.2 adds requirements around non-obscured focus, dragging alternatives, target size and accessible authentication. | Minimum task target remains 44×44 CSS px; keyboard focus needs a 3 px visible ring; no interaction may require drag; demo role entry stays clearly non-authentication. | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) |
| Synthetic heuristic evaluation can find many layout defects, but it also misses UI conventions and cross-screen violations. | Use an AI visual review only as a fast first pass. A human evaluates complete flows, state continuity, truthfulness and assistive use. | [Zhong, McDonald & Hsieh, 2025](https://arxiv.org/abs/2507.02306) |
| Clear, purpose-led image prompts improve visual exploration; dense text and complex layouts need downstream design-tool refinement. | Prompts use blank/abstract text regions and describe hierarchy, material and composition. Exact Vietnamese copy and real metrics are added in code only. | [OpenAI Academy — Creating images, 2026-04-10](https://openai.com/academy/image-generation/) |

## Applied Apple-design rules

These rules are applied selectively: NekoPath is a data-rich desktop/mobile web app, not an iOS
imitation.

- **Immediate response:** task controls visibly respond on press; persistence shows a real saving or
  saved state.
- **Spatial consistency:** the mobile drawer opens/closes from the same edge; panels return to their
  trigger rather than teleporting.
- **Interruptible, restrained motion:** use transform/opacity only; no motion when it does not
  explain a state. Reduced-motion users receive a short opacity change or no motion.
- **Material communicates hierarchy:** one structural sidebar/panel may be visually heavier than
  content. Do not stack glass surfaces or create a “glassmorphism” dashboard.
- **Type and spacing are semantic:** system font, 4 px quantum, 16 px body minimum, tabular figures
  for counts and formulae. A value needs a semantic token, not a one-off magic number.

## What the lab explicitly rejects

- AI orb, mascot, fake live chat, complex agent visualizations, confetti, points/streaks or a
  leaderboard;
- gradients, glow, bento-card statistic walls, decorative blobs, heavy glass effects and dark
  “command centre” styling;
- screenshots with unreadable generated Vietnamese/Math, invented learner data or labels that look
  like a validated diagnosis;
- student faces, real classroom scenes, generic stock-school imagery or any raster image placed on
  the PWA's critical path;
- a change whose strongest evidence is “it looks modern.”

## Review metric (not a claim of scientific validity)

For each concept, ask an uncoached observer to complete the relevant task and record:

1. **Decision clarity:** can they name what to do first in 15 seconds?
2. **Evidence clarity:** can they explain what evidence supports/limits the suggestion in 20 seconds?
3. **Action safety:** can they find the next action without believing an unreviewed hypothesis is a fact?
4. **Interaction accessibility:** can they complete the flow with keyboard, zoom and reduced motion?

If any answer is no, the concept is rejected or revised regardless of aesthetic preference.

