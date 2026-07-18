# NekoPath

**Adaptive learning paths for mixed-ability classrooms — by Neko Core.**

Live demo: [nekopath.holilihu.online](https://nekopath.holilihu.online/)

NekoPath diagnoses the earliest actionable prerequisite gap behind a learner's current
mistake, asks for more evidence when the cause is ambiguous, and gives the teacher a
correctable intervention path. Learners who have already mastered the target take a fast
path instead of repeating the same fixed lesson sequence.

## Source of truth

- [Problem analysis](docs/PROBLEM_ANALYSIS.md)
- [48-hour product contract](docs/PRODUCT_CONTRACT.md)
- [Curriculum and hero-profile draft](docs/CONTENT_MODEL_DRAFT.md)
- [Implementation master plan and Fable 5 handoff](docs/IMPLEMENTATION_MASTER_PLAN.md)
- [UX/UI audit and Codex–Fable execution plan](docs/UX_UI_AUDIT_AND_EXECUTION_PLAN.md)
- [Product and UI constitution](docs/PRODUCT_UI_CONSTITUTION.md)
- [Operational role-based MVP](docs/OPERATIONAL_MVP.md)
- [Brand system and asset governance](docs/BRAND_SYSTEM.md)
- [SEO and share audit](docs/SEO_AND_SHARE_AUDIT.md)
- [Evaluation status and reproducibility](docs/EVALUATION.md)
- [Teacher AI harness v2 design](docs/superpowers/specs/2026-07-18-neko-teacher-ai-harness-v2-design.md)
- [Agentic vertical-slice implementation plan](docs/superpowers/plans/2026-07-18-neko-agentic-vertical-slice.md)
- [AI collaboration log](AI_COLLABORATION_LOG.csv)

The official problem text is intentionally short. Anything not stated there is an internal
hypothesis and must be labeled as such. In particular, no judging weights, dataset, required
model, required framework, or whole-curriculum coverage have been announced in the supplied
statement.

## Current status

The local-first PWA provides authenticated student and teacher workspaces with persistent sidebar
navigation. The student can complete an adaptive check-in and inspect the resulting path; the
teacher can inspect the class-wide gap and ranked intervention groups. These surfaces use the
deterministic domain runtime and local IndexedDB, not hard-coded screen outcomes.

The teacher Neko dock now runs through a persistent, evidence-first agent controller. Its canonical
memory is compacted by estimated token pressure, never by a fixed message or turn count. It supports
the deterministic rule provider, opt-in in-browser Gemma 3 through WebLLM, a server-side OpenAI
Responses provider, and an optional local/self-hosted ChatGPT managed-account provider through the
official Codex App Server protocol. Exact configuration and trust boundaries are documented in the
[production runbook](ops/RUNBOOK.md).

The account and class records remain sample evaluation data, not learner PII. Named curriculum
review and six independently owned held-out labels remain explicit next gates; no real-learning,
whole-curriculum, or SOTA result is claimed.

## Non-negotiables

- Root-gap evidence, not a generic tutoring chatbot.
- Mandatory teacher grouping, prioritization, and class-wide gap detection.
- Core diagnosis and reviewed practice work after the network is disconnected.
- Every skill and item maps to a sourced 2018 curriculum outcome.
- No learner PII, opaque high-stakes label, or fabricated learning/SOTA claim.
