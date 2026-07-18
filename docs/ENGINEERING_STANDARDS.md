# Engineering standards — how NekoPath ships

Status: team working agreement, effective 2026-07-18  
Benchmark: DORA/Accelerate delivery research, Google SRE, trunk-based development,
twelve-factor build–release–run, GitHub's own merge/deploy practice.

This document exists because ad-hoc operations crept in during the hackathon rush
(hand-typed SSH deploys, unscripted shell chains, rebase races). It states the standard,
compares it with what leading organizations do, and is honest about the gaps we accept
until after the event.

## 1. One command per intent

| Intent | The ONLY sanctioned way | Never again |
|---|---|---|
| Validate a change | `npm run verify` (format → lint → typecheck → 150+ app tests → eval suite → build; byte-identical to CI) | hand-chained shell fragments that drift from CI |
| Ship to main | commit → `git pull --rebase origin main` → `git push` as one uninterrupted sequence; if the push loses a race, repeat the pair immediately — never re-run the full gate in between (CI is the arbiter on the merged result) | gating for 10 minutes and then pushing into a stale head |
| Deploy production | `gh workflow run deploy.yml` (or the Actions UI button) | typing `gcloud compute ssh … docker compose up` by hand |
| Inspect production | read `/api/healthz`, CI logs, Actions run logs first | SSH as a first resort |

## 2. Deployment: pipeline, not fingers

What the deploy pipeline (`.github/workflows/deploy.yml`) already does — and why this
matches the practice of large organizations:

| Property | Our pipeline | Industry reference |
|---|---|---|
| Keyless auth | Workload Identity Federation — no service-account key exists anywhere | Google Cloud's recommended pattern; keys are the #1 leaked credential class |
| Network path | IAP tunnel over 443 from GitHub's runners | zero-trust access; deploys are immune to any teammate's local network (the exact failure we hit on 18/07) |
| Supply chain | every action pinned to a full commit SHA | GitHub/OpenSSF hardening guidance |
| Serialization | `concurrency: deploy-production`, no cancel | one release at a time, like any deploy queue |
| Verification | post-deploy smoke of the canonical URL + health endpoint | health-gated rollout (degraded form of canary) |
| Audit | every release is an Actions run with logs, actor and SHA | change-management for free |

Hand SSH (`gcloud compute ssh --tunnel-through-iap`) is **break-glass only**: pipeline
red for reasons the logs cannot explain, or the VM unreachable by the pipeline itself.
A break-glass session must be reported in the AI collaboration log / team chat with what
was touched.

## 3. Merge discipline on a hot trunk

We practice trunk-based development with a single `main`. On 18/07 the team merged a PR
roughly every few minutes; three consecutive pushes lost the race because a full local
gate ran between rebase and push.

Rule: the local gate runs BEFORE the ship sequence, not inside it. `rebase → push` is
one atomic step; conflicts are resolved immediately and pushed without re-gating (CI
gates the merged result — that is what CI is for). Risky or long-running work goes
through a short-lived PR so CI serializes integration instead of humans racing.

Post-event upgrade: enable branch protection + GitHub **merge queue**, which is how
GitHub itself and most large monorepo teams retire this race entirely.

## 4. Honest gaps (accepted for the event, queued for after)

| Gap | Industry standard | Why accepted now |
|---|---|---|
| The VM rebuilds the image from git | build ONCE in CI, push an immutable, digest-pinned image to a registry; the host only pulls (build–release–run separation) | registry + pull plumbing is a half-day change; the in-image gate still blocks broken builds |
| No staging environment | deploy to staging, promote on green | one demo VM; the disclosed sample-data environment is the stage |
| Rollback = redeploy previous commit | one-command image-tag rollback | previous images remain on the VM (`docker image ls`) — compose can pin the prior tag in minutes |
| No merge queue | merge queue / bors-style serialization | needs branch protection the team opted out of for hackathon speed |

## 5. Scripts live in the repository

Any command sequence executed more than once must exist as a file under version control
(`package.json` scripts, `ops/*.sh`, workflow YAML) — never only in a terminal history or
a chat message. If an operation was worth typing twice, it is worth reviewing once.
