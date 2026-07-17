# Problem analysis — Adaptive tutor for the mixed-ability classroom

Research cutoff: 2026-07-17, Asia/Ho_Chi_Minh.

## Canonical statement

The team supplied the following as the complete current problem statement:

> Gap: The most pressing problem in Vietnamese general education isn't a lack of content —
> it's the ability gap within a single classroom, especially in disadvantaged areas where one
> teacher must carry a class of 40 students with very different foundations. Weaker students
> get left behind; stronger ones get held back. Existing learning apps just push lessons in a
> fixed order, aren't truly adaptive, and ignore the teacher's role.
>
> Requirements: Build an adaptive tutoring system that diagnoses each student's root-cause
> knowledge gaps (e.g., a student gets Grade 7 math wrong because of a fractions gap from
> Grade 5), then generates a personalized practice path that fills exactly that gap rather
> than just marking right/wrong. A teacher dashboard layer is mandatory: automatically group
> students by need, suggest who to help first, and detect class-wide gaps for the teacher to
> re-teach. Constraint: must work offline or on low bandwidth, with content aligned to the
> 2018 General Education Program.

Observed operational metadata: Duy Tan University, Education & Training, 21/30 slots at the
time the captain supplied the statement. Slot count is volatile and is not a product requirement.

This snapshot supersedes the corrupted export that appended an unrelated tourism paragraph.
The supplied statement contains **no judging weights, dataset, attachment, API requirement,
model mandate, technology mandate, or required curriculum breadth**. Do not reintroduce those
as organizer facts.

## What each sentence actually commits us to

| Text | Product obligation | Observable proof |
|---|---|---|
| mixed ability in one class | distinguish learners, not only questions | same surface error, different history, different outcome |
| weaker students left behind | repair an earlier actionable prerequisite | root evidence and shortest valid remediation path |
| stronger students held back | skip mastered nodes and advance | a mastered learner receives a fast path/challenge item |
| fixed order is inadequate | next step depends on current evidence | two histories cause different next questions |
| diagnose root-cause gaps | infer a latent cause with uncertainty | labeled root/abstention eval, evidence IDs, alternatives |
| fill exactly that gap | no generic grade-level playlist | path begins at diagnosed frontier and skips mastered skills |
| teacher dashboard mandatory | teacher is a first-class decision user | grouping, priority, class gap, evidence, override |
| automatically group by need | actionable pedagogical groups | deterministic group membership by root + evidence state |
| suggest who to help first | transparent intervention ordering | visible priority factors; no opaque model ranking |
| detect class-wide gaps | aggregate only sufficient evidence | numerator, denominator, threshold, representative errors |
| offline or low bandwidth | core cannot require a provider | reload/continue offline; queued local event survives reconnect |
| aligned to 2018 program | source every skill and item | grade/outcome/source/review fields and content gate |

## The true problem

The system observes answers, response history, item difficulty, and skill mappings. It does not
directly observe “the root gap.” Root diagnosis is therefore an uncertain latent-state inference
problem with five hard parts:

1. **Identifiability:** one wrong answer may be a misconception, a careless slip, ambiguous
   language, or missing prerequisite. One event cannot support a confident root.
2. **Graph validity:** a visually convincing prerequisite edge can still be pedagogically wrong.
   Curriculum order is evidence of sequence, not proof of causation.
3. **Multiple gaps:** a learner can have several missing skills. The useful output is the earliest
   *actionable* frontier, not a long unranked list.
4. **Cold start:** new learners have little history, so the product must spend a small question
   budget efficiently and know when to stop.
5. **Offline aggregation:** separate student devices cannot magically update one teacher device
   while all are disconnected. The MVP must show last-sync state honestly; its offline proof uses
   a complete local class/session and deferred cross-device sync.

## Definitions used by NekoPath

- **Target skill:** the current curriculum outcome the learner is attempting.
- **Surface error:** an incorrect response on a target item; not itself a root diagnosis.
- **Prerequisite graph:** a small, versioned, teacher-reviewed directed acyclic graph of skills.
- **Mastery state:** an evidence-backed probability/state per skill, never a label for the child.
- **Actionable root/frontier:** a likely unmastered skill on a path to the target whose own
  prerequisites are sufficiently mastered or are graph roots.
- **Discriminating question:** a reviewed item expected to reduce uncertainty between competing
  root hypotheses.
- **Practice path:** the shortest valid topological sequence from the actionable root to the
  target, skipping skills already mastered.
- **Fast path:** an advanced/transfer item for a learner whose prerequisites and target are
  sufficiently mastered.
- **Class-wide gap:** a shared root supported by enough learners and sufficient evidence, with
  the denominator and policy threshold visible.

## Product thesis

**When students make the same visible mistake for different reasons, NekoPath follows reviewed
prerequisite evidence, asks the smallest useful diagnostic question, and returns a correctable
learning path plus a teacher action—even when the network is unavailable.**

The primary decision user is the teacher; the student experience produces evidence and performs
the recommended micro-path. This avoids the brief's central failure mode: a student-only app that
still ignores the teacher.

## Narrow curriculum wedge

The official Mathematics Program makes a Grade 5–7 fractions-to-proportion slice defensible:

- Grade 5 consolidates simplifying, common denominators, comparing and operating on fractions,
  and includes ratio/percentage outcomes.
- Grade 6 covers fraction equality/properties/operations and ratio/percentage work.
- Grade 7 covers proportions, equal-ratio sequences, and direct/inverse proportion problems.

Candidate KCs for expert review—not yet asserted causal edges:

1. fraction meaning and representation;
2. equivalent fractions;
3. simplifying fractions;
4. common denominators;
5. comparing fractions;
6. fraction operations;
7. ratio as comparison;
8. equivalent ratios;
9. proportion definition/properties;
10. missing value in a proportion;
11. direct proportionality; and
12. inverse proportionality.

Every final edge needs the exact official outcome and a teacher/mentor approval. The official
program also asks instruction to respect different learner needs and warns that technology
should not create unnecessary teacher workload, which reinforces a compact action dashboard.

Source: [2018 Mathematics Program](https://thleductho.hcm.edu.vn/van-ban/chuong-trinh-giao-duc-pho-thong-mon-toan-ban-hanh-kem-theo-thong-tu-322018tt-bg/vbctmb/72434/406283).

## Research synthesis and design consequence

- Stanford's 2026 review found only 20 high-quality causal studies among more than 800 K–12 AI
  papers; guarded hints/reasoning support looked more promising than answer-giving chatbots, and
  educator-facing tools are a promising direction. **Consequence:** teacher cockpit and hint
  ladder, no generic answer chat. [Stanford SCALE review](https://scale.stanford.edu/research-in-action/understanding-evidence-base-ai-k12-education)
- A recent LLM-versus-KT preprint reports temporally inconsistent/wrong-direction mastery updates
  from the LLM approach. **Consequence:** a language model cannot own learner state. This source
  is a preprint, not final authority. [LLM vs. Knowledge Tracing](https://arxiv.org/abs/2512.23036)
- Efficient adaptive testing can use a simple greedy selector rather than a trained RL policy.
  **Consequence:** choose the next reviewed question by expected information gain with a bounded
  budget. [NeurIPS 2025 adaptive testing](https://papers.nips.cc/paper_files/paper/2025/hash/8d186577ca4f2d8ae43f26ac679d50ff-Abstract-Conference.html)
- Current KT reliability work shows temporal/configuration mistakes can inflate complex-model
  results. **Consequence:** frozen event order, independent simulator, simple baselines, and held-
  out ownership before model complexity. [ITS 2026 accepted preprint](https://arxiv.org/abs/2605.04727)
- LearnLens teacher interviews favor sample responses, concept summaries and classroom patterns.
  **Consequence:** show representative evidence and an action—not only probability charts. This
  is interview evidence, not a learning-effect study. [LearnLens](https://arxiv.org/abs/2509.10582)
- In OATutor's randomized study, raw generated hints failed quality checks on 32% of problems.
  **Consequence:** reviewed hints first; any generated hint must pass math/schema/no-answer checks.
  [PLOS ONE study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0304013)

## Hero story

All learners see the same Grade 7 proportion task.

- **An** has prior evidence of weak equivalent fractions. NekoPath probes that branch and starts
  a fraction-equivalence micro-path.
- **Bình** handles fractions but repeatedly misinterprets equivalent ratios. NekoPath asks a
  ratio representation item and starts a different path.
- **Chi** has sparse and contradictory evidence. NekoPath says “Cần thêm bằng chứng” instead of
  making a confident diagnosis.
- **Minh** masters both prerequisites and target. NekoPath skips remediation and serves a transfer
  challenge, proving that stronger learners are not held back.

The teacher then sees root-based groups, a transparent priority, a class-wide pattern and one
two-minute/short-group intervention. The network is disabled and the next student interaction
still completes locally.

## Claims we may and may not make

Allowed after passing tests:

- “Finds the labeled root in X/Y frozen synthetic profiles.”
- “Asks fewer/more useful diagnostic questions than named baselines.”
- “The reviewed core continues offline after first load.”
- “Teacher/mentor completed the observed grouping/override task.”

Forbidden without a real study or benchmark:

- “Improves real student learning by X%.”
- “Scientifically diagnoses every misconception.”
- “Covers the Vietnamese curriculum.”
- “Replaces teachers,” “national-scale,” or “SOTA.”
- Any confidence percentage that has not been calibrated on held-out cases.

## Highest-value mentor questions

1. Does the 12-KC graph contain any pedagogically false edge, and which edge is most important?
2. For the shared Grade 7 task, are the four learner profiles plausible and distinguishable?
3. What evidence would make a teacher trust or reject a root-gap recommendation?
4. Is priority more useful at group level or individual level during a 40-student lesson?
5. What threshold should trigger whole-class reteaching versus a short small-group intervention?
6. Does “offline” require cross-device local networking, or is local operation plus deferred sync
   acceptable? Do not promise the former without explicit confirmation and a working test.

