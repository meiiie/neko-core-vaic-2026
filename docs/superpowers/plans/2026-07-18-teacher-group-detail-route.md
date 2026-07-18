# Teacher Group Detail Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every support-group card open a dedicated, easy-to-read detail page while keeping the group list compact.

**Architecture:** Keep `TeacherClassPage` focused on filtering and navigation. Add `TeacherGroupDetailPage` for group evidence and teacher actions, and route all dashboard group links to `/teacher/class/:groupId`.

**Tech Stack:** React, React Router, TypeScript, Vitest, Testing Library, existing CSS tokens.

---

### Task 1: Define the navigation behavior with tests

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/features/teacher/TeacherClassPage.test.tsx`

- [x] Replace the inline-disclosure test with a test that verifies the list omits detail controls, activates the group link, and renders the dedicated detail page.
- [x] Render `/teacher/class/:groupId` in the override test and verify the existing teacher correction workflow still persists data.
- [x] Run the two focused test files and confirm the new navigation expectations fail before implementation.

### Task 2: Split list and detail responsibilities

**Files:**
- Modify: `src/features/teacher/TeacherClassPage.tsx`
- Create: `src/features/teacher/TeacherGroupDetailPage.tsx`
- Modify: `src/app/App.tsx`

- [x] Replace each native disclosure with a full-row `Link` whose accessible name identifies the lesson.
- [x] Move learner evidence, wrong-question aggregation, CSV export, override form, and assignment action to `TeacherGroupDetailPage`.
- [x] Add the protected `teacher/class/:groupId` route and a clear not-found state with a link back to the group list.
- [x] Run the focused tests and confirm they pass.

### Task 3: Route all teacher-dashboard group entry points consistently

**Files:**
- Modify: `src/features/teacher/TeacherPage.tsx`

- [x] Point the priority CTA, time-plan rows, and group previews to the dedicated group route.
- [x] Keep `/teacher/class` as the fallback when an allocation no longer maps to a current group.
- [x] Run teacher and app tests.

### Task 4: Apply the existing design system and verify

**Files:**
- Modify: `src/styles/global.css`

- [x] Style the linked summary rows with visible hover and keyboard focus states using existing tokens.
- [x] Add a restrained detail header and responsive evidence layout; do not add images, new fonts, icons, gradients, or dependencies.
- [x] Run formatting, linting, type checking, all unit/evaluation tests, and production build.
- [x] Verify the existing local server and the new detail URL return HTTP 200 without using a browser.
- [x] Commit the completed change on the current feature branch.
