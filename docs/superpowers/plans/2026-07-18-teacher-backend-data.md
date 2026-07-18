# Teacher Backend Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the teacher support-group flow use only server-authoritative roster, questions, answers, assignments, and teacher adjustments, with a clear evidence-first workflow.

**Architecture:** Fastify exposes a protected teacher dashboard endpoint assembled from SQLite rows and the existing deterministic diagnosis functions. React consumes one typed API response, never imports synthetic learners/events for teacher screens, and renders a truthful no-data state when the event log is empty.

**Tech Stack:** React 19, React Router, TypeScript, Fastify, Node SQLite, Zod, Vitest, Testing Library.

---

### Task 1: Specify server-authoritative teacher data

**Files:**
- Create: `src/features/teacher/teacher-api.ts`
- Modify: `server/app.test.ts`

- [x] Add a shared `TeacherDashboardDto` contract containing `dataSource: 'SERVER'`, `generatedAt`, class summary, real roster labels, groups, question evidence, and latest overrides.
- [x] Add a failing server test asserting a fresh database returns 40 roster students, zero answer events, and zero support groups rather than synthetic evidence.
- [x] Add a failing server test that submits a real assignment answer and then expects that learner and answer in the teacher dashboard response.
- [x] Run `npm test -- --run server/app.test.ts`; expect the new `/api/teacher/dashboard` calls to return 404.

### Task 2: Persist teacher adjustments and build the dashboard API

**Files:**
- Modify: `server/db.ts`
- Modify: `server/app.ts`
- Modify: `server/app.test.ts`

- [x] Add `teacher_overrides` with teacher, class, learner, target KC, decision, optional root KC, reason, and server timestamp.
- [x] Add protected `GET /api/teacher/dashboard`, reading only enrolled students and their server events, parsing answer payloads, joining question and assignment text, and deriving groups only from learners with answer evidence.
- [x] Add protected `POST /api/teacher/overrides`, validate class membership and KC identifiers, then append an audit row.
- [x] Return per-question evidence with each learner's selected answer, correct answer, timestamp, attempt source, and correctness.
- [x] Run `npm test -- --run server/app.test.ts`; expect all server tests to pass.

### Task 3: Remove synthetic teacher data from React

**Files:**
- Create: `src/features/teacher/teacher-api.ts`
- Modify: `src/features/teacher/useTeacherDashboard.ts`
- Modify: `src/test/api-stub.ts`
- Modify: `src/app/App.test.tsx`

- [x] Replace Dexie/HERO imports in `useTeacherDashboard` with `fetch('/api/teacher/dashboard', { credentials: 'include' })` and explicit loading, error, empty, refresh states.
- [x] Keep an empty dashboard while loading; never call `buildHeroClassDashboard()` as a fallback.
- [x] Extend the test API stub with a server-shaped teacher dashboard fixture.
- [x] Add an app test asserting the list uses `Xem chi tiết và hỗ trợ` and does not render synthetic group evidence when the server fixture has zero events.
- [x] Run the focused app tests.

### Task 4: Make the teacher workflow self-explanatory

**Files:**
- Modify: `src/features/teacher/TeacherClassPage.tsx`
- Modify: `src/features/teacher/TeacherGroupDetailPage.tsx`
- Modify: `src/features/teacher/TeacherPage.tsx`
- Modify: `src/styles/global.css`

- [x] Add a short purpose statement and three-step usage explanation to the support-group list.
- [x] Change the row action to `Xem chi tiết và hỗ trợ`.
- [x] Show a server-data timestamp and a no-evidence state with `Giao bài kiểm tra nhanh` when the backend has no answers.
- [x] Replace repeated student chips with a compact expandable roster.
- [x] Make each wrong-question row expandable into a table of learner, selected answer, correct answer, time, and assignment source.
- [x] Put `Giao bài ôn cho nhóm` first and rename the correction form to `Điều chỉnh gợi ý của hệ thống`.
- [x] Save adjustments through `POST /api/teacher/overrides`, refresh the server response, and preserve plain Vietnamese labels.

### Task 5: Verify and publish-ready commit

**Files:**
- Modify: `src/features/teacher/TeacherClassPage.test.tsx`
- Modify: `docs/superpowers/plans/2026-07-18-teacher-backend-data.md`

- [x] Test the real-evidence detail flow and backend override request.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval`, and `npm run build`.
- [x] Start or keep the local Vite/API services and verify list, detail, and teacher API URLs with HTTP only.
- [x] Commit all scoped files on `codex/teacher-backend-data`.
