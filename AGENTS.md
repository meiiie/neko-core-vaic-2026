# NekoPath agent contract

Read `docs/PROBLEM_ANALYSIS.md` and `docs/PRODUCT_CONTRACT.md` before changing product code.

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

Until implementation commands exist, the only valid state is “contract complete; product not
built.” Add actual install/dev/typecheck/test/eval/build commands here immediately after the
minimal scaffold is chosen.
