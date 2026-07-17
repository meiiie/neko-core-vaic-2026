# Asset and concept register

This register is deliberately small. Do not promote “nice-looking” drafts without a route/state
contract and a human decision.

| ID | Prompt / source | Intended route or medium | Status | Human review | Decision / reason |
|---|---|---|---|---|---|
| T01 | `PROMPT_LIBRARY.md#t01` | Teacher hierarchy composition reference | revise | Codex visual pass | `generated/T01-v1-teacher-hierarchy.png` is retained as a draft only: it introduced a radial chart explicitly prohibited by the prompt and reads as a generic dashboard. Do not integrate; retry with a zero-baseline class strip and a stronger first-action region. |
| S01 | `PROMPT_LIBRARY.md#s01` | Student check-in composition reference | planned | pending | Must preserve one-question, one-action sequence; not an app asset. |
| P01 | `PROMPT_LIBRARY.md#p01` | Path/abstention composition reference | planned | pending | Must make uncertainty responsible and actionable; not an app asset. |
| A01 | `PROMPT_LIBRARY.md#a01` | Optional pitch/video illustration | planned | pending | Only consider after product interaction is frozen; excluded from core PWA. |

## Record format for each generated draft

```md
### <ID>-v<N>

- Generated at (UTC):
- Tool/mode: built-in image generation
- Prompt source and exact revision:
- Output path: `generated/...`
- Intended use:
- Product route/state contract:
- AI visual review result:
- Human reviewer / decision:
- Rubric result:
- Promotion commit (if any):
- Rejection/revision reason:
```

### T01-v1

- Generated at (UTC): 2026-07-17T17:07Z
- Tool/mode: built-in image generation
- Prompt source and exact revision: `PROMPT_LIBRARY.md#t01`, v1
- Output path: `generated/T01-v1-teacher-hierarchy.png` (ignored raw draft)
- Intended use: teacher hierarchy composition reference only
- Product route/state contract: `/teacher`, class-wide pattern + first intervention
- AI visual review result: revise — the composition has a readable sidebar/table rhythm and neutral
  placeholder policy, but violates the prompt with a radial chart and makes the main action too
  dashboard-generic.
- Human reviewer / decision: pending
- Rubric result: revise; no promotion
- Promotion commit (if any): none
- Rejection/revision reason: retry without radial chart, large blue generic CTA or dashboard-stat
  styling; show a zero-baseline class evidence strip, named action-panel area and comparable rows.
