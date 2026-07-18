# Executive conclusion → competition execution

Cutoff: 2026-07-18 (Asia/Ho_Chi_Minh)
Scope: the judgeable fractions-to-proportion slice, not a whole-curriculum research platform.

## Decision

NekoPath remains a **curriculum-grounded, teacher-controlled adaptive system**. The deterministic
graph/learner kernel owns mastery, diagnosis, paths, grouping and priority. A language model may
word a bounded explanation, but it may not change those facts.

“Beyond SOTA” is a research target, not a release claim. This build can claim reproducible
behavior on named synthetic suites only. A real SOTA claim still requires independent labels,
teacher-reviewed content and a student study.

## What changed now

| Executive requirement | Product behavior | Deterministic proof |
|---|---|---|
| correct answer ≠ valid method | events store answer correctness separately from method validity; an invalid method is not positive mastery evidence | a correct/invalid event lowers the KC posterior while correct/valid raises it |
| detect–verify–escalate | each diagnosis returns `AUTO_REMEDIATE`, `ASK_VERIFY`, `TEACHER_REVIEW`, `ADVANCE` or `OUT_OF_SCOPE` | Chi asks a reviewed probe; exhausted budget escalates without guessing |
| misconception evidence | authored distractors emit a bounded misconception ID; hypotheses count independent items | one item stays `NEEDS_VERIFICATION`; two different items become `SUPPORTED_BY_MULTIPLE_ITEMS` |
| teacher-budget-aware action | a transparent integer-budget allocator selects the highest total action value under a supplied minute budget | the 15-minute class plan selects K02 reteach + quick check, uses 12 minutes and defers K07 |
| calibrated learner state | disclosed synthetic profiles report Brier score and ECE in addition to root/path accuracy | report is deterministic, bounded and labeled `DISCLOSED_SYNTHETIC_GROUND_TRUTH` |

The teacher attention value is deliberately **not** called expected learning gain. For an
actionable root it remains `sufficient learners × downstream skills blocked`; for an uncertainty
queue it is the number of learners awaiting verification. Minute estimates are authored inputs.

## Evidence contract

An answer event may carry:

```text
correct
methodValidity: VALID | INVALID | UNKNOWN
misconceptionId: an authored distractor signal (optional)
```

The system rejects a misconception ID not declared by the item. A named pattern is never inferred
from the learner name, demographic data or free text. It is a session-level hypothesis, not a
permanent trait label.

Root-gap evidence and named-misconception evidence are intentionally separate. Two distinct
items can support a KC-level practice path even when their distractors do not identify the same
error pattern. The interface may name a misconception only when the same authored signal repeats
across two distinct items; otherwise it presents the path at KC level without inventing a label.

## Current acceptance gates

1. Same visible Grade 7 target still yields K02 for An, K07 for Bình, safe abstention for Chi and
   a transfer path for Minh.
2. Correct answer + invalid method cannot increase mastery.
3. A misconception requires two distinct items before the UI describes it as repeated evidence.
4. A remaining probe yields `ASK_VERIFY`; no probe/budget yields `TEACHER_REVIEW`.
5. Teacher allocation never exceeds the supplied budget and is deterministic under ties.
6. Brier/ECE reports remain explicitly synthetic; no real-learning or SOTA wording is emitted.
7. Format, lint, typecheck, unit, eval, production PWA build and browser/offline smoke stay green.

## Human gates that code cannot replace

- A named mathematics teacher/mentor must review the exact KCs, edges, distractors, hints and
  intervention wording. Until then the UI keeps the `UNREVIEWED` disclosure.
- Another owner must freeze the six held-out root/abstention labels. Development labels cannot be
  relabeled as held-out evidence.
- A real pilot is required for learning gain, retention, transfer, teacher-time savings and any
  comparison with published systems.

## Deferred by design

- deep/neural knowledge tracing, forgetting models and distillation until real longitudinal data;
- RAG/vector databases while the reviewed corpus remains small and structured;
- on-device SLM responsibility beyond bounded wording with deterministic fallback;
- 100–150 items or whole-curriculum coverage without human content review;
- cluster RCT, VietRootMath public benchmark and cross-school generalization until after the
  competition snapshot.

## Verified research basis

- [FoundationalASSIST](https://arxiv.org/abs/2602.00070): frontier LLMs barely match a trivial KT
  baseline and underperform random chance on item discrimination in the reported evaluation.
- [The Correct Answer Trap](https://arxiv.org/abs/2606.23205): motivates separating answer and
  method, then detect–verify–escalate instead of direct alerts.
- [Responsible-DKT](https://arxiv.org/abs/2604.08263): supports keeping symbolic educational rules
  explicit in learner modelling; it does not justify replacing the current small-data kernel.
- [Hybrid human–AI tutoring](https://arxiv.org/abs/2605.11155): supports differentiated proactive
  human attention, while remaining quasi-experimental evidence outside Vietnam.
- [SHAPE](https://arxiv.org/abs/2604.22134): supports explicit pedagogical gating against
  answer-inducing behavior.
- [MisEdu-RAG](https://arxiv.org/abs/2604.04036): supports misconception-aware teacher evidence;
  it does not make RAG necessary for NekoPath's small structured corpus.

These papers motivate design choices. They do not validate NekoPath or establish a SOTA result.
