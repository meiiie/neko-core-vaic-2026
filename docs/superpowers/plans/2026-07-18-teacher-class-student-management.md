# Teacher Class and Student Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hard-coded class flow with teacher-owned classes, real roster import, per-lesson student progress, and a direct review-assignment recommendation flow.

**Architecture:** SQLite remains the source of truth. Add teacher ownership to classes and expose teacher-scoped class, roster, progress, and student-detail APIs. React pages select a class through URL state, render compact progress summaries, and pass the selected class/student/lesson to the existing assignment composer. Existing endpoints keep a first-owned-class fallback during migration, but all new UI sends an explicit class ID.

**Tech Stack:** React 19, React Router 7, TypeScript 6, Fastify 5, Node SQLite, Zod, read-excel-file, Vitest, Testing Library.

---

## Task 1: Migrate from a seeded class to teacher-owned classes

**Files:**
- Modify: `server/db.ts`
- Modify: `server/seed.ts`
- Test: `server/app.test.ts`

- [ ] Add a failing API test proving a teacher with no class receives `200 { classes: [] }`, not a dashboard 500.
- [ ] Add `teacher_id`, `subject`, `school_year`, and `created_at` to `classes` with additive migrations for existing databases.
- [ ] Backfill legacy classes to the first teacher account after seeding.
- [ ] Add ownership helpers that reject access to another teacher's class.
- [ ] Run `npm test -- server/app.test.ts` and verify the new test passes.

Expected schema:

```sql
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'Toán',
  school_year TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT ''
);
```

## Task 2: Add class, roster, and Excel import APIs

**Files:**
- Create: `server/student-import.ts`
- Create: `server/student-import.test.ts`
- Modify: `server/app.ts`
- Test: `server/app.test.ts`

- [ ] Write parser tests for a valid `.xlsx`, invalid email, duplicate row, and missing required columns.
- [ ] Parse columns `Họ và tên`, `Email`, and optional `Mật khẩu tạm thời`; preview every row before commit.
- [ ] Generate a temporary password only for new accounts when the file or manual form omits one; return it once in the success response.
- [ ] Add teacher-scoped endpoints:

```text
GET  /api/teacher/classes
POST /api/teacher/classes
GET  /api/teacher/classes/:classId/students
POST /api/teacher/classes/:classId/students
POST /api/teacher/classes/:classId/students/import/preview
POST /api/teacher/classes/:classId/students/import
```

- [ ] Enroll existing student accounts by email without changing their password.
- [ ] Reject duplicate enrollment, non-student accounts, invalid classes, and cross-teacher access with explicit status codes.
- [ ] Verify tests with `npm test -- server/student-import.test.ts server/app.test.ts`.

## Task 3: Compute real per-lesson progress and student detail

**Files:**
- Create: `server/class-progress.ts`
- Create: `server/class-progress.test.ts`
- Modify: `server/app.ts`

- [ ] Write tests for no assignment, not started, in progress, completed, and needs-support states.
- [ ] Derive progress from persisted assignments and latest answer events, grouped by question `kc_id`.
- [ ] Mark a lesson as needing support only when there are at least two answered questions and the correct rate is below 60%.
- [ ] Return transparent counts (`assigned`, `answered`, `correct`) with every percentage.
- [ ] Add endpoints:

```text
GET /api/teacher/classes/:classId/dashboard
GET /api/teacher/classes/:classId/students/:studentId
```

- [ ] Include the student's assigned work, teacher message, completion state, and recommended lesson/question IDs.
- [ ] Run `npm test -- server/class-progress.test.ts server/app.test.ts`.

## Task 4: Build the multi-class overview and student-management UI

**Files:**
- Modify: `src/features/teacher/teacher-api.ts`
- Modify: `src/features/teacher/useTeacherDashboard.ts`
- Modify: `src/features/teacher/TeacherPage.tsx`
- Create: `src/features/teacher/TeacherStudentsPage.tsx`
- Create: `src/features/teacher/TeacherStudentDetailPage.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppLayout.tsx`
- Modify: `src/styles.css`
- Modify: `src/test/api-stub.ts`
- Test: `src/features/teacher/TeacherPage.test.tsx`
- Test: `src/features/teacher/TeacherStudentsPage.test.tsx`
- Test: `src/features/teacher/TeacherStudentDetailPage.test.tsx`

- [ ] Add API DTOs/functions for class list, create class, roster, import preview/commit, and student detail.
- [ ] On `/teacher`, show a useful empty state with `Tạo lớp học` when the teacher has no classes.
- [ ] When classes exist, keep the chosen class in `?classId=` and reload the dashboard for that class only.
- [ ] Add `Quản lý học sinh` navigation.
- [ ] On `/teacher/students`, use a compact class list plus a roster table with search, progress, support status, and `Xem chi tiết`.
- [ ] Provide two clear add methods: one-student form and Excel preview/confirm.
- [ ] On `/teacher/students/:studentId`, show per-lesson progress, assigned work, teacher messages, and a recommendation callout.
- [ ] Preserve the current NekoPath design tokens and plain Vietnamese wording; use the legacy LMS only for information architecture.
- [ ] Run focused React tests.

## Task 5: Make assignment creation class-aware

**Files:**
- Modify: `server/app.ts`
- Modify: `src/features/teacher/TeacherAssignmentsPage.tsx`
- Modify: `src/features/teacher/TeacherClassPage.tsx`
- Modify: `src/features/teacher/TeacherGroupDetailPage.tsx`
- Test: `server/app.test.ts`
- Test: `src/features/teacher/TeacherAssignmentsPage.test.tsx`

- [ ] Accept `classId` in assignment creation and validate teacher ownership plus recipient enrollment.
- [ ] Make teacher assignment listing optionally filter by class; make student listing span all enrolled classes.
- [ ] Make the roster and override endpoints accept an explicit class ID with a safe legacy fallback.
- [ ] From student detail, navigate to `/teacher/assignments?classId=...&learner=...&kc=...` and preselect recommended questions.
- [ ] Confirm the saved assignment appears only for the chosen student(s), including the teacher's message.

## Task 6: Full verification and local handoff

**Files:**
- Modify only if verification finds a defect.

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Restart the local server and verify `/api/healthz`, the no-class response, class creation, student creation/import, progress detail, and assignment creation using HTTP requests only.
- [ ] Confirm `git diff --check` and review the final diff for unrelated changes.
- [ ] Commit the implementation on the current feature branch; do not push or merge until the user requests it.

## Self-review checklist

- [ ] No endpoint trusts a caller-supplied class without checking teacher ownership or student enrollment.
- [ ] No teacher-facing progress value comes from a frontend fixture.
- [ ] Empty class, empty roster, malformed file, duplicate account, and network error states have understandable Vietnamese copy.
- [ ] Existing seeded demo accounts continue to work after migration.
- [ ] The implementation remains surgical: no global state framework, no speculative course hierarchy, and no redesign outside the teacher class flow.
