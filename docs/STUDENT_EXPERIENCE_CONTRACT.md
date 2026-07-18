# Student adaptive learning experience contract

This contract names what a student sees. The deterministic diagnosis remains the authority; the
UI may explain its result but may not invent a root, path, mastery state or completion event.

## One task, four safe states

| Computed state | Student language | Primary action |
| --- | --- | --- |
| `NEEDS_CHECK_IN` | **Kiểm tra nền tảng** — at most three short questions to find the part to review; it is not graded. | Answer the next discriminating question. |
| `READY` / `IN_PROGRESS` | **Kế hoạch học của em** — show the root skill, source grade band, reason, time and exactly one current action. | Explain/read, guided practice or independent post-check. |
| `FAST_PATH` / `COMPLETED` | **Bài vận dụng tiếp theo** — do not repeat content already demonstrated as mastered. | Transfer challenge or scheduled review. |
| `TEACHER_REVIEW` | Evidence is not safe enough to choose one root. | Wait for teacher review; never force a root. |

## Step completion

Every remediation step follows `EXPLAIN -> GUIDED_PRACTICE -> POST_CHECK -> DONE`. Opening a text,
PDF or video records resume state only. A step becomes `DONE` only after a correct independent
`POST_CHECK_ANSWER`; reading or watching never updates mastery.

## Language hierarchy

The first screen answers: what will I learn, why is it here, how long will it take and what do I do
now? Event IDs, rule codes, probability and technical evidence counts belong in the second-level
“Xem căn cứ kỹ thuật” disclosure or on a teacher surface. Student-facing copy uses “Vì sao em học
bước này?” and does not use “giả thuyết đang phân biệt” as the main explanation.

## Offline truth

Text lessons may be mirrored automatically. PDF/video is offline only after an explicit download
finishes and its hash is verified. The UI must distinguish `not downloaded`, `downloading`,
`partial`, `ready` and `no space`; it must never label uncached media as offline-ready.

## Curriculum truth

All current graph nodes, edges, items, hints and lessons are synthetic `UNREVIEWED` content. Demo
mode may show them with the existing warning. Pilot/production content must fail closed until a
named mathematics reviewer records an `ACCEPTED` decision.
