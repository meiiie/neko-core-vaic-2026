# NekoPath 48-hour product contract

This contract converts the short problem statement into falsifiable product behavior. Internal
targets below are team decisions, not organizer criteria.

## Minimum Judgeable Product

One public, no-login, desktop-first PWA with two connected modes:

1. **Student:** answer a bounded diagnostic, inspect a short practice path, use a staged hint,
   and continue offline.
2. **Teacher:** inspect a synthetic 40-student class, root-based groups, transparent priority,
   class-wide gaps, evidence and override.

The hero flow uses An, Bình, Chi and Minh. It is successful only if the same surface task produces
two different justified roots, one abstention, and one fast path.

## Requirement traceability

| ID | Requirement | MVP behavior | Deterministic acceptance |
|---|---|---|---|
| R1 | diagnose root cause | graph-constrained mastery/evidence state | frozen profiles return correct root or allowed abstention |
| R2 | personalized path | shortest root-to-target path; skip mastered nodes | every edge valid; no unrelated skill; mastered node omitted |
| R3 | weaker learners not left | staged micro-practice and held-out check | root path begins below the failed target when evidence supports it |
| R4 | stronger learners not held | fast path/transfer challenge | mastered profile receives no remedial repetition |
| R5 | automatic grouping | root + evidence-state groups | membership reproducible from the same event log |
| R6 | suggest priority | visible policy based on affected count and downstream skills | displayed factors reproduce the ordering exactly |
| R7 | class-wide gaps | sufficient-evidence aggregate | numerator/denominator/threshold and examples shown |
| R8 | teacher role | evidence inspection and override | override persists and is never silently replaced |
| R9 | offline/low bandwidth | packaged content/core/local events | cached reload and next interaction succeed network-off |
| R10 | 2018 alignment | source-bearing reviewed skill/item records | build fails for missing source/review/skill/answer |

## Scope budget

- 12 teacher-reviewed knowledge components.
- 36 reviewed items: one diagnostic, one guided practice, and one held-out/check item per KC.
- Three-level hint ladder: conceptual cue, guided substep, bottom-out worked step after an attempt.
- Four hero learners plus a generated 40-learner synthetic class.
- 30 frozen evaluation profiles: 18 development, 6 adversarial, 6 held-out.
- Three primary surfaces only: student, evidence/path, teacher dashboard.

Whole-curriculum coverage, real student onboarding and live classroom deployment are outside the
48-hour claim.

## Diagnostic contract

### State

Each item maps to an explicit Q-matrix/KC set and stores difficulty, answer/rubric, slip/guess
defaults, source and review state. Each learner event is append-only and pseudonymous.

Use a BKT-like posterior for each KC. For the same content version and canonical event order, the
result is deterministic. A generated explanation never feeds back into the posterior.

### Root/frontier

For candidate ancestors of the failed target:

1. update mastery only from mapped reviewed items;
2. exclude candidates with insufficient direct evidence from confident diagnosis;
3. choose a likely unmastered candidate whose prerequisites are sufficiently mastered;
4. if roots compete, ask a reviewed item with the largest expected entropy reduction;
5. stop after a bounded diagnostic budget and return `NEEDS_MORE_EVIDENCE`; and
6. return `OUT_OF_SCOPE` when the target/evidence is outside the reviewed graph.

Provisional thresholds are tuned only on development cases and recorded as qualitative states:
`Đủ bằng chứng`, `Cần thêm bằng chứng`, and `Ngoài phạm vi`. Do not display a percentage before
held-out calibration.

### Path

Find the shortest topological path from the actionable frontier to the target and remove mastered
nodes. A learner who masters target and prerequisites receives one transfer/challenge item. A
held-out/check item—not reading an explanation—marks path completion.

## Teacher decision contract

- Group by actionable root and evidence state; keep `Cần kiểm tra nhanh` separate.
- Priority is explainable. Start with `sufficient learner count × downstream skills blocked`.
  Do not use demographics, an LLM score or invented urgency.
- Class-wide gap appears only under a versioned policy such as `>=30% and >=3 sufficiently
  evidenced learners`; display the actual numerator/denominator. The teacher/mentor must approve
  or replace this provisional policy.
- Every group shows representative responses, inspected graph path, suggested whole-class/
  small-group/two-minute-check action and an override.
- Advanced learners form a `Sẵn sàng tiến tiếp` group rather than disappearing from the dashboard.

## Offline truth

After the first successful load, the app shell, graph, items, hints, synthetic class and learner
events are local. The diagnostic and both views require no server/model call.

For the MVP, student and teacher modes share one local dataset. Cross-device events synchronize
only when connectivity returns; the teacher view shows `last synced` and queued count. We do not
claim real-time aggregation between disconnected devices.

Append-only event IDs make sync idempotent. Duplicate, out-of-order, storage-full and incompatible
schema cases have explicit tests and non-destructive UI states.

## Model and retrieval boundary

The graph/item bank is small and structured, so direct lookup and traversal replace RAG. The core
is already AI through probabilistic learner modeling and adaptive item selection.

One optional FPT model call may produce a Vietnamese Socratic explanation from structured inputs
after the deterministic core passes. It must:

- return a strict schema;
- cite only supplied skill/error/hint IDs;
- pass answer/math and no-premature-answer checks;
- never change graph, mastery, grouping, priority or eval; and
- fall back to a reviewed hint on timeout, 401, 429, 5xx or malformed output.

Spend no credit comparing models for diagnosis. Bake off exact hint/explanation cases only.

## Evaluation

### Baselines

- B0: remediate only the surface skill.
- B1: fixed grade-level prerequisite sequence.
- B2: lowest-mastery/BKT selection without graph-constrained root search.
- N: NekoPath.

All receive the same histories, item bank and question budget.

### Independence

Generate learner responses with a separately implemented noisy DINA-style simulator, including
multi-gap profiles, slips, lucky guesses and held-out parameter ranges. Inference remains BKT-like.
Another owner freezes six held-out labels; implementers know the rubric, not expected outcomes.

### Internal gates

- N beats the best B0/B1 baseline by at least 10 percentage points on the frozen synthetic suite.
- Root top-1 is at least 80% overall and at least 5/6 held-out outcomes are correct.
- 100% returned paths are graph-valid; all out-of-graph cases abstain.
- Same event log/content version produces identical core results.
- Network-off hero flow, offline reload and reconnect-without-double-update pass.
- Local diagnosis p95 is below 300 ms on the event laptop.
- Optional explanation preserves all deterministic facts for three repeated runs.

These thresholds decide whether to ship a feature; they are not organizer weights or real learning
claims. A simulated pre/post score must be labeled as simulation.

## Product states

The UI must cover: empty, diagnosing, success, needs evidence, out of scope, provider fallback,
offline/queued, sync conflict and reset. Keyboard navigation, visible focus, Vietnamese labels,
body-text contrast >=4.5:1 and reduced motion are not optional polish.

## Architecture budget

- React + Vite + TypeScript PWA.
- Pure TypeScript domain functions for graph, posterior, question selection, path and grouping.
- Versioned JSON content; local IndexedDB/event outbox.
- One Node/Fastify unit only if the optional model proxy/sync is admitted.
- One container behind Caddy on the prepared VPS; static PWA remains a recovery artifact.

Rejected until a failed representative test proves need: Python service, deep KT/RL training,
Neo4j, vector DB, RAG, Redis, microservices, Kubernetes, auth, voice, LMS, parent portal,
multi-agent runtime, avatars and gamification.

## 48-hour order

| Window | Build only this | Exit condition |
|---|---|---|
| T+0–2 | source lock, 12-KC graph, four hero profiles, visual direction | teacher/mentor reviews edges and hero plausibility |
| T+2–6 | pure diagnosis + B0/B1/B2 tests | same error -> two roots, abstention, fast path locally |
| T+6–10 | student/evidence vertical slice | first public URL and useful outcome <15 seconds |
| T+10–14 | teacher groups/priority/class gap | 40 synthetic learners produce actionable groups |
| T+14–18 | PWA cache/local events | reload and next interaction pass network-off |
| T+18–24 | 30-profile eval and content repair | gates reported honestly; graph/content frozen |
| T+24–30 | optional validated explanation only | admitted only if it beats reviewed fallback |
| T+30–32 | reliability faults and feature freeze | no new features after T+32 |
| T+32–40 | cold-judge UX, README, deck, video, AI log | observer completes 90-second flow uncoached |
| T+40–46 | clean clone/deploy, second network, rollback, submission audit | five artifacts accessible and consistent |
| T+46–48 | buffer | no architecture change |

## Kill switches

- If root search does not beat B0/B1, repair graph/items and simplify; do not add a deeper model.
- If no teacher can validate an edge, label the output “diagnostic hypothesis” and keep review-only.
- If generated hints fail one correctness case, ship reviewed hints.
- If offline fails by T+18, stop all optional model work.
- If teacher action is unclear in a cold test, remove charts before adding features.
- If the visual build has not been selected, do not scaffold the UI from generic AI-dashboard
  defaults; choose one grounded direction first.

## Definition of done

A cold judge can open the public URL without login, understand the classroom problem, observe An
and Bình receive different evidence-backed paths from one surface error, see Chi trigger a safe
abstention and Minh take a fast path, use the teacher grouping/action view, then continue one
interaction after the network is disabled. Every displayed claim maps to a frozen artifact or is
visibly labeled as a hypothesis/simulation.

