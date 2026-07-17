# Curriculum and content-model draft

Status: **unreviewed hypothesis**. This file is a teacher/mentor review surface, not a claim that
the proposed edges are pedagogically causal.

## Curriculum boundary

NekoPath uses a narrow fractions-to-proportion chain because the official 2018 Mathematics
Program contains the following outcomes:

- Grade 5 consolidates simplifying, common denominators, comparison, ordering and four operations
  on fractions; it also recognizes ratios/percentages and applies them to simple problems.
- Grade 6 explicitly includes equal fractions, basic fraction properties, comparison and fraction
  operations, plus ratios and percentages.
- Grade 7 recognizes proportions and their properties, equal-ratio sequences and simple direct/
  inverse proportion problems.

Source: [official Mathematics Program](https://thleductho.hcm.edu.vn/van-ban/chuong-trinh-giao-duc-pho-thong-mon-toan-ban-hanh-kem-theo-thong-tu-322018tt-bg/vbctmb/72434/406283).

The program supports the presence and sequence of these outcomes. It does not by itself prove
that every proposed arrow below is a necessary prerequisite.

## Proposed knowledge components

| KC | Name | Curriculum anchor | Observable learner behavior | Review |
|---|---|---|---|---|
| K01 | Fraction meaning | Grade 5 consolidation of fractions | represents part/whole and identifies numerator/denominator | UNREVIEWED |
| K02 | Equivalent fractions | Grade 5 review; Grade 6 equal fractions/properties | scales numerator and denominator by the same non-zero factor | UNREVIEWED |
| K03 | Simplifying fractions | Grades 5–6 | reduces a fraction without changing its value | UNREVIEWED |
| K04 | Common denominator | Grades 5–6 | creates equivalent fractions with a shared denominator | UNREVIEWED |
| K05 | Compare fractions | Grades 5–6 | orders fractions and justifies comparison | UNREVIEWED |
| K06 | Fraction operations | Grades 5–6 | selects and performs fraction operations correctly | UNREVIEWED |
| K07 | Ratio meaning and order | Grades 5–6 ratio outcomes | interprets `a:b`, keeps quantity order and connects ratio to context | UNREVIEWED |
| K08 | Equivalent ratios | Grade 7 equal-ratio sequence | generates/completes ratios with invariant multiplicative relation | UNREVIEWED |
| K09 | Proportion definition/properties | Grade 7 | recognizes a true proportion and explains the equality | UNREVIEWED |
| K10 | Missing value in a proportion | Grade 7 use of proportion properties | finds an unknown with a justified multiplicative relation | UNREVIEWED |
| K11 | Direct proportion | Grade 7 | models and solves a simple direct-proportion situation | UNREVIEWED |
| K12 | Inverse proportion | Grade 7 | distinguishes/models a simple inverse-proportion situation | UNREVIEWED |

## Proposed edges

```text
K01 -> K02
K02 -> K03
K02 -> K04
K04 -> K05
K04 -> K06
K01 -> K07
K02 -> K08
K07 -> K08
K08 -> K09
K06 -> K10
K09 -> K10
K10 -> K11
K10 -> K12
```

| Edge | Why it may help | What the reviewer must decide |
|---|---|---|
| K01 -> K02 | equivalence preserves fraction value | is fraction meaning truly required for the diagnostic item? |
| K02 -> K03/K04 | simplification/common denominator use equivalence | should these be separate branches rather than strict prerequisites? |
| K04 -> K05/K06 | common denominator supports comparison/add-subtract | is the edge valid for all item types or only the authored subset? |
| K01/K07 -> K08 | equivalent ratios require quantity order and multiplicative invariance | does K02 also need to be a hard prerequisite? |
| K08 -> K09 | proportions express equality of ratios | is recognition possible without generating equivalent ratios? |
| K06/K09 -> K10 | unknown-value problems use arithmetic plus proportion meaning | can items isolate arithmetic from conceptual proportion errors? |
| K10 -> K11/K12 | missing-value reasoning appears in simple applications | should direct/inverse identification precede computation instead? |

An edge may be scoped to the authored item set rather than asserted as a universal learning law.
Record that distinction in the final graph.

## Hero target and items

Target item candidate:

> Tìm `x` biết `x/12 = 3/4`. Hãy giải thích quan hệ em đã sử dụng.

The explanation request helps separate a correct guess/procedure from ratio understanding. The
runtime answer validator remains deterministic.

Candidate discriminating items:

| Item | KC | Prompt sketch | Signal |
|---|---|---|---|
| D02 | K02 | choose and explain a fraction equal to `3/4` | multiplicative equivalence vs additive change |
| D04 | K04 | rewrite `1/3` and `1/4` with a common denominator | common-denominator construction |
| D06 | K06 | compute a small fraction multiplication/division | arithmetic versus conceptual proportion gap |
| D07 | K07 | express red:blue from a picture-free quantity description | ratio meaning/order |
| D08 | K08 | complete `2:3 = 6:?` and explain scaling | equivalent-ratio invariant |
| D09 | K09 | decide which of three equalities is a proportion | recognition without long arithmetic |

Every final KC needs at least three distinct reviewed items: diagnostic, guided practice and
held-out/check. Do not use the same numeric template in both diagnosis and post-check.

## Four hero profiles

### An — equivalent-fraction root

- Surface: fails K10 target.
- Prior evidence: fails two K02 items with additive numerator/denominator changes; passes K07.
- Expected behavior: diagnose K02 only after enough direct evidence; path K02 -> K08 -> K09 -> K10.
- Distinguishing check: D02, not another K10 item.

### Bình — ratio-meaning root

- Surface: fails the same K10 target.
- Prior evidence: passes K02/K06; reverses quantity order or uses additive reasoning on K07/K08.
- Expected behavior: diagnose K07 or ask D07/D08; path K07 -> K08 -> K09 -> K10.
- Difference from An must be visible from evidence, not from a hidden profile label.

### Chi — insufficient/contradictory evidence

- Surface: one wrong K10 response.
- Prior evidence: one correct and one incorrect response on competing roots; no repeated direct
  evidence.
- Expected behavior: `NEEDS_MORE_EVIDENCE` plus the highest-information reviewed question.
- Forbidden: a confidence percentage or forced nearest root.

### Minh — ready to advance

- Surface: may make one careless error, then passes confirmation; prior K02/K07/K08/K09 evidence
  is strong and target is mastered.
- Expected behavior: no remediation; serve a K11 transfer challenge and place Minh in
  `Sẵn sàng tiến tiếp`.
- Purpose: satisfy the stronger-learners-held-back half of the brief.

## Forty-learner synthetic class

Generate the class from six hidden archetypes with deterministic seeds:

| Archetype | Count | Dashboard expectation |
|---|---:|---|
| K02 equivalence gap | 10 | candidate small-group/whole-class pattern |
| K07 ratio-meaning gap | 8 | separate actionable group |
| K06 arithmetic gap | 5 | separate group only with direct evidence |
| multiple gaps | 5 | earliest actionable frontier, not multi-label dump |
| insufficient/contradictory | 6 | quick-check queue |
| mastered/advanced | 6 | ready-to-advance group |

Counts are demo fixtures, not claims about a real classroom. The dashboard must display both
group count and evidence coverage.

## Review checklist

The curriculum/teacher reviewer marks each item `ACCEPT`, `REVISE`, or `REJECT` and records why:

- Is every KC phrased as observable knowledge/behavior rather than a trait label?
- Does every edge represent a necessary prerequisite for these items, or only a useful teaching
  sequence? Is that distinction stored?
- Can each diagnostic item isolate its intended KC without requiring an unlisted reading or
  arithmetic skill?
- Are wrong-answer patterns plausible and non-stigmatizing?
- Does the hint ladder prompt thinking before revealing a worked step?
- Are Vietnamese wording, notation and grade difficulty appropriate?
- Is the target/profile pair plausible enough for a teacher to act on?
- Which threshold would justify whole-class reteaching rather than a quick check?

No graph-driven code is called “validated” until this checklist has a named human result.
