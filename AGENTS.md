# NekoPath agent contract

Read `docs/PROBLEM_ANALYSIS.md`, `docs/PRODUCT_CONTRACT.md` and
`docs/IMPLEMENTATION_MASTER_PLAN.md` before changing product code.

## Authority

1. Latest organizer/platform instruction and the exact supplied problem statement.
2. Human team decision.
3. These product contracts.
4. Implementation preference.

Do not copy source, templates, prompts, assets, or history from the preparation harness or
external reference clones. They are research evidence only. Record any later third-party
dependency with exact version, license, purpose, and organizer permission.

## Product invariant

For the same surface error, different evidence may produce different root hypotheses. Sparse,
contradictory, or out-of-graph evidence produces `NEEDS_MORE_EVIDENCE` or `OUT_OF_SCOPE`, never
a confident guess. A model may explain a computed result but may not change curriculum edges,
answer keys, mastery state, priority, or eval labels.

## Delivery rules

- TypeScript first; one deployable web unit; core works without an external API.
- Keep diagnosis/graph/path logic pure and deterministic for the same event log.
- Use a small versioned JSON DAG, not Neo4j, RAG, or a vector database.
- Add no auth, voice, multi-agent runtime, LMS integration, or second backend without a failed
  representative test proving it necessary.
- Never simplify away input validation, offline data integrity, accessibility, or privacy.
- No secret, token, PII, raw chain-of-thought, or hidden held-out label in Git or logs.
- Touch only task-owned files. Do not refactor unrelated work.

## Verification

Every non-trivial behavior needs the smallest runnable check. Compare diagnosis against the
surface-skill, fixed-path, and no-graph baselines. The response simulator must use different
rules/parameters from inference, and another owner controls held-out labels.

## Commands

Run with Node 24.18.0 LTS (`.nvmrc` / `.node-version`); do not generate the lockfile with any
other runtime. These commands exist and pass on the scaffold:

```powershell
npm ci
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval
npm run build
```

`npm run test:e2e` does not exist yet; add it only when the Playwright harness is real. Never add a
placeholder script that always succeeds.

## Concurrent ownership during initial build

- Fable 5 owns scaffold/config, `src/app/**`, `src/components/**`, `src/features/**`,
  `src/storage/**`, `src/services/**`, `tests/e2e/**`, `server/**`, `ops/**` and deployment.
- Codex owns `src/domain/**`, `src/content/**` schema/fixtures and `tests/eval/**`.
- Only the Fable/integrator lane changes shared package/build/CI configuration. Other lanes submit
  a dependency or config request instead of racing on shared files.
- Human curriculum review owns acceptance of edges, items, hints and intervention wording.

## Current UX/UI refinement pass (2026-07-17)

`docs/UX_UI_AUDIT_AND_EXECUTION_PLAN.md` overrides the initial-build ownership only for this
bounded pass.

- Fable 5 owns the presentation files listed in section 6 of that plan and their colocated UI tests.
- Codex freezes `src/domain/**`, `src/content/**`, `tests/eval/**` and
  `src/app/adapters/hero-tutor*`; it owns black-box QA, integration, docs/log and deployment.
- Fable does not edit README, AI log, deploy/config files or add dependencies, and it does not
  deploy. Codex does not implement a competing visual redesign while Fable is active.
- Handoff is one reviewed commit SHA plus route/viewport screenshots and check results. Preserve
  all synthetic, unreviewed, uncertainty and offline truth labels.
