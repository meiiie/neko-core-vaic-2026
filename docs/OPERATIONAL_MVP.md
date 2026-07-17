# NekoPath operational MVP

Status: current product-flow authority  
Decision date: 2026-07-17  
Scope: Vietnam AI Innovation Challenge 2026 — 48-hour MVP

## Product decision

NekoPath must feel like a usable school product, not a gallery of proof screens. The deterministic
diagnosis, abstention and teacher grouping remain the core advantage, but users enter through a
recognizable role workspace and complete a coherent task.

The one-click account selector is a **demo session**, not authentication. It has no password, JWT,
remote identity, authorization boundary or learner PII. Real registration and account security are
out of scope until a school pilot supplies an identity and consent contract.

## Adopted clean-room lessons

The team inspected `LMS_hohulili`, `AI_v1` and `NekoCore` as research references only. No source,
asset, prompt or dependency was copied.

- From LMS products: role entry, stable sidebar, active task, visible progress and explicit submit.
- From agent systems: explicit state, thin adapters around the deterministic core and inspectable
  evidence rather than hidden orchestration.
- Rejected for this MVP: LMS backend/JWT complexity, RAG, chat, agent runtime and a second backend.

## Route and task contract

| Route | Role | Complete task |
|---|---|---|
| `/login` | evaluator | choose a student or teacher sample account in one click |
| `/student` | student | understand and resume today's adaptive check-in |
| `/student/check-in` | student | choose, confirm and locally save one answer at a time |
| `/student/path` | student | see abstention/root decision, next action and ordered path |
| `/teacher` | teacher | identify the class-wide pattern and first intervention |
| `/teacher/class` | teacher | compare all ranked need groups and inspect evidence |
| `/system` | both | verify device/offline data and reset the evaluation state |

Role guards return an authenticated demo account to its own workspace. Signing out returns to the
account selector. Direct links remain recoverable.

## Quiz behavior

1. Show one domain-selected question and its target context.
2. Require an answer selection before enabling confirmation.
3. One confirmation produces at most one idempotent local event.
4. Re-run the deterministic diagnosis over ordered evidence.
5. Ask another discriminating item only when `nextItemId` exists; otherwise show completion and the
   path action.
6. Never reveal correctness mid-diagnosis, fabricate confidence or advance on a decorative timer.

## UX rules

- Desktop uses a persistent role-specific sidebar; mobile uses the same navigation in a drawer.
- Each screen has one primary decision and one dominant action.
- Sample-data, offline and uncertainty labels remain visible but secondary.
- Use the spacing, typography, semantic color, accessibility and performance contracts in
  `PRODUCT_UI_CONSTITUTION.md`.
- No dead primary controls. Navigation, answer selection, confirmation, path continuation, group
  inspection, account switching and data reset must work.

## Acceptance walkthrough

1. Open `/login`, enter as Nguyễn Minh Chi and start the check-in.
2. Verify confirmation is disabled until a choice is selected.
3. Confirm an answer, see the next adaptive state, then inspect the path.
4. Switch account, enter as Nguyễn Thu Hà and identify the first class intervention.
5. Open all need groups and verify their counts, evidence and actions are domain-derived.
6. At 390 px, open/close the drawer and complete a question without horizontal overflow.
7. Disconnect the network, reload and verify the installed shell plus local answer still work.

Passing screenshots alone is insufficient; the interaction and persisted state must pass.
