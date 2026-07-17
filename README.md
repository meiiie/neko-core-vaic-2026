# NekoPath

**Adaptive learning paths for mixed-ability classrooms — by Neko Core.**

NekoPath diagnoses the earliest actionable prerequisite gap behind a learner's current
mistake, asks for more evidence when the cause is ambiguous, and gives the teacher a
correctable intervention path. Learners who have already mastered the target take a fast
path instead of repeating the same fixed lesson sequence.

## Source of truth

- [Problem analysis](docs/PROBLEM_ANALYSIS.md)
- [48-hour product contract](docs/PRODUCT_CONTRACT.md)
- [Curriculum and hero-profile draft](docs/CONTENT_MODEL_DRAFT.md)
- [Implementation master plan and Fable 5 handoff](docs/IMPLEMENTATION_MASTER_PLAN.md)
- [AI collaboration log](AI_COLLABORATION_LOG.csv)

The official problem text is intentionally short. Anything not stated there is an internal
hypothesis and must be labeled as such. In particular, no judging weights, dataset, required
model, required framework, or whole-curriculum coverage have been announced in the supplied
statement.

## Current status

The local-first PWA scaffold, deterministic root-gap core, guarded hero content and reproducible
40-learner synthetic classroom now exist with runnable checks. The selected visual direction is
“Sổ can thiệp lớp học”. UI/domain wiring, named curriculum review, the 30-profile frozen evaluation
and deployment remain explicit next gates; no real-learning or whole-curriculum result is claimed.

## Non-negotiables

- Root-gap evidence, not a generic tutoring chatbot.
- Mandatory teacher grouping, prioritization, and class-wide gap detection.
- Core diagnosis and reviewed practice work after the network is disconnected.
- Every skill and item maps to a sourced 2018 curriculum outcome.
- No learner PII, opaque high-stakes label, or fabricated learning/SOTA claim.
