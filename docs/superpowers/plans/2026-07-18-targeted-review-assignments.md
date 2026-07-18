# Targeted Review Assignments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a teacher-first flow that starts from lessons with review signals, explains which learners and errors caused the signal, recommends a lesson question package, preselects a random practice set, and lets the teacher review and assign it only to the intended learners.

**Architecture:** Keep SQLite/Fastify as the authority for question, evidence, recipient, and assignment data. Treat each curriculum knowledge component (`kcId`) as a question package, because every existing question already belongs to one lesson. Pass a stable support-group context into the assignment builder, but persist explicit learner recipients and enforce them on every student assignment endpoint.

**Tech Stack:** React 19, React Router, TypeScript, Fastify, Zod, Node SQLite, Vitest, CSS.

---

## Chunk 1: Backend authority and diagnosis contract

### Task 1: Persist targeted assignment recipients

**Files:**
- Modify: `server/db.ts`
- Modify: `server/app.ts`
- Test: `server/app.test.ts`

- [x] Add a failing API test that creates an assignment with `learnerIds`, verifies only those learners see it, and verifies a non-recipient receives `403` from open/detail/answer endpoints.
- [x] Add additive `recipient_ids_json` migration to `assignments`; an empty array keeps older assignments visible to the whole class.
- [x] Extend `assignmentSchema` with unique learner IDs, validate that every recipient is an enrolled student, and persist the list.
- [x] Filter the student assignment list and protect assignment detail/open/answer routes with the same recipient rule.
- [x] Return `recipientCount`/`recipientNames` to teachers and use recipient count as the progress denominator.
- [x] Run `npx vitest run server/app.test.ts` and verify all server tests pass.

### Task 2: Expose lesson-level review recommendations

**Files:**
- Modify: `src/features/teacher/teacher-api.ts`
- Modify: `server/teacher-dashboard.ts`
- Modify: `src/test/api-stub.ts`
- Test: `server/app.test.ts`

- [x] Add DTO fields for evaluated-learner rate, wrong-evidence rate, recommended lesson IDs, and matching backend question IDs.
- [x] Build recommendations only from real latest answer evidence plus backend questions; never synthesize learners or wrong answers.
- [x] Add assertions showing a K02 support group recommends the K02 package and backend question IDs.
- [x] Run focused server tests.

## Chunk 2: Stable teacher workflow

### Task 3: Keep the teacher in context after an override

**Files:**
- Modify: `src/features/teacher/useTeacherDashboard.ts`
- Modify: `src/features/teacher/TeacherGroupDetailPage.tsx`
- Test: `src/features/teacher/TeacherClassPage.test.tsx`

- [x] Reproduce the bug where saving an override moves the learner to another support group and the current route becomes “Không tìm thấy nhóm này”.
- [x] Make `refresh()` return the refreshed dashboard.
- [x] After saving, locate the learner's resulting group and navigate there when the group ID changed; otherwise keep the current page.
- [x] Show a clear success status describing where the learner moved.
- [x] Run the focused teacher detail test.

### Task 4: Make the support overview lesson-first

**Files:**
- Modify: `src/features/teacher/TeacherClassPage.tsx`
- Modify: `src/features/teacher/TeacherGroupDetailPage.tsx`
- Modify: `src/styles/global.css`
- Test: `src/app/App.test.tsx`

- [x] Rename the overview around “Bài học có học sinh cần ôn” and show learner count/rate plus the most common wrong-answer signals.
- [x] On lesson detail, show the exact learner list, wrong-answer rate, common errors, and the system's proposed support action before any assignment controls.
- [x] Link to assignment creation with a stable `group` query parameter so recipients and recommendation can be rebuilt after refresh.
- [x] Verify the lesson → learners/errors → proposed review action flow in an app test.

## Chunk 3: Package selection, review, and targeted delivery

### Task 5: Build the staged assignment composer

**Files:**
- Modify: `src/features/teacher/TeacherAssignmentsPage.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/test/api-stub.ts`
- Create: `src/features/teacher/TeacherAssignmentsPage.test.tsx`

- [x] Fetch the teacher dashboard alongside questions and assignments; resolve the `group` query to real learner IDs and recommended lessons.
- [x] Present question packages by lesson. Selecting a package reveals its questions rather than one undifferentiated list.
- [x] For a recommended group, preselect its learners and randomly choose up to five matching questions once; provide “Chọn tất cả” and “Chọn ngẫu nhiên” controls plus individual checkboxes.
- [x] Allow the teacher to add/remove recipient learners before review.
- [x] Split submission into “Xem lại bài sẽ giao” and a final “Xác nhận và giao bài” step showing recipients, lesson, questions, estimated time, and deadline.
- [x] POST explicit `learnerIds` and keep a clear success message stating how many learners received the assignment.
- [x] Test automatic recommendation, random-count selection, individual question selection, review, and payload recipients.

### Task 6: Make the question bank visibly package-based

**Files:**
- Modify: `src/features/teacher/TeacherQuestionsPage.tsx`
- Modify: `src/features/teacher/TeacherQuestionsPage.test.tsx`
- Modify: `src/styles/global.css`

- [x] Add a compact “Gói câu hỏi theo bài học” overview derived from backend questions, with counts and an “Xem câu hỏi” action that applies the existing topic filter.
- [x] Keep the existing detailed table, editing, pagination, and selection behavior unchanged below the package overview.
- [x] Test that selecting a package filters to the correct questions.

## Chunk 4: Verification and local handoff

### Task 7: Verify the complete workflow

**Files:**
- Modify: `docs/superpowers/plans/2026-07-18-targeted-review-assignments.md`

- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval`, and `npm run build`.
- [x] Restart only the local server owned by this worktree on `127.0.0.1:4173`.
- [x] Verify health, authentication, teacher dashboard, targeted assignment creation, recipient-only student visibility, and SPA routes using HTTP/API calls only.
- [x] Commit the scoped changes on `codex/teacher-backend-data`.
