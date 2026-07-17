# Teacher UI motion plans

These plans were written against commit `69cc370` after the 2026-07-17 teacher route audit.

| # | Plan | Severity | Status | Dependency |
| --- | --- | --- | --- | --- |
| 001 | [Fix mobile drawer continuity and focus](001-fix-mobile-drawer-continuity.md) | HIGH | DONE | none |
| 002 | [Preserve useful feedback under reduced motion](002-preserve-reduced-motion-feedback.md) | MEDIUM | DONE | applied after 001 |
| 003 | [Move loading shimmer to the compositor](003-composite-loading-shimmer.md) | MEDIUM | DONE | coordinated with 002 |

Recommended execution order: 001 → 002 → 003. Rebase before execution. If cited source differs
from commit `69cc370`, stop and refresh the plan rather than improvising.

Executed on branch `codex/teacher-ui-plan` in commits `3d527ea` and `11c3573`. Final browser QA
covered drawer focus/exit/trapping, reduced motion, 390 px reflow, offline reload and the teacher
route matrix.
