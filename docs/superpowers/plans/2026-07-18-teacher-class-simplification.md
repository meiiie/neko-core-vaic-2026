# Teacher Class Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/teacher/class` understandable at a glance for teachers with limited technology experience by presenting compact group rows, plain Vietnamese, prominent lesson names, and on-demand details.

**Architecture:** Keep the existing dashboard data, filters, deep links, exports, assignment links, and teacher overrides. Reshape only the presentation layer: aggregate repeated wrong-answer evidence by question, move secondary actions into the expanded section, and use native `<details>/<summary>` for a large keyboard-accessible disclosure target.

**Tech Stack:** React 19, TypeScript 6, React Router 7, CSS, Vitest, Testing Library.

---

### Task 1: Lock the simplified interaction with an integration test

**Files:**
- Modify: `src/app/App.test.tsx`

- [x] **Step 1: Add a failing test for the compact default state**

Add a test that starts at `/teacher/class` with the teacher API stub and verifies:

```tsx
expect(await screen.findByRole('heading', { level: 1, name: 'Nhóm học sinh cần hỗ trợ' })).toBeTruthy();
expect(screen.getByRole('heading', { level: 2, name: 'Bài: Phân số bằng nhau' })).toBeTruthy();
const firstDetails = screen.getAllByText('Xem chi tiết')[0].closest('details');
expect(firstDetails?.hasAttribute('open')).toBe(false);
expect(firstDetails?.querySelector('.group-actions')).toBeTruthy();
```

Click the first `Xem chi tiết` summary, then verify the student heading, grouped wrong-question heading, assignment link, and export button appear.

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test -- src/app/App.test.tsx
```

Expected: FAIL because the current page title, lesson heading, and default action placement do not match the simplified design.

- [x] **Step 3: Commit the test with the implementation after Task 3**

Do not commit a red test alone; keep it as the acceptance gate for the following presentation changes.

### Task 2: Simplify the teacher group information model

**Files:**
- Modify: `src/features/teacher/TeacherClassPage.tsx`

- [x] **Step 1: Replace learner-by-learner repetition with question summaries**

Replace `wrongQuestionsByLearner` with a helper that returns one record per wrong question:

```ts
function wrongQuestionSummaries(learnerIds: readonly string[]) {
  const learnersByQuestion = new Map<string, string[]>();
  dashboard.learners
    .filter((learner) => learnerIds.includes(learner.id))
    .forEach((learner) => {
      const questionIds = new Set(
        learner.events.filter((event) => !event.correct).map((event) => event.itemId),
      );
      questionIds.forEach((questionId) => {
        learnersByQuestion.set(questionId, [
          ...(learnersByQuestion.get(questionId) ?? []),
          learner.id,
        ]);
      });
    });

  return [...learnersByQuestion].map(([id, ids]) => ({
    id,
    prompt: practiceById.get(id)?.promptVi ?? id,
    learnerIds: ids,
  }));
}
```

This preserves all evidence while rendering each question once.

- [x] **Step 2: Reduce the filter bar to two plain-language choices**

Remove `minimumSize` and its dropdown. Rename labels and options to:

```tsx
<label>
  Bài học
  <select>{/* Tất cả bài học + graph nodes */}</select>
</label>
<label>
  Mức cần hỗ trợ
  <select>{/* Tất cả nhóm / Cần hỗ trợ trước / Có thể xem sau */}</select>
</label>
```

Keep the visible result count as `Có {filteredGroups.length} nhóm`.

- [x] **Step 3: Build each group as one compact native disclosure**

Use this structure:

```tsx
<article className={isHighlighted ? 'intervention-row is-highlighted' : 'intervention-row'}>
  <details open={isHighlighted || undefined}>
    <summary className="intervention-summary">
      <span className="rank-cell">01</span>
      <span className="intervention-copy">
        <span className="eyebrow">Cần ôn lại</span>
        <span className="intervention-title" role="heading" aria-level={2}>
          <strong>Bài:</strong> Phân số bằng nhau
        </span>
        <span className="intervention-guidance">
          <strong>Gợi ý:</strong> Ôn lại cho nhóm nhỏ hoặc cả lớp
        </span>
      </span>
      <span className="intervention-metrics">{/* three compact facts */}</span>
      <span className="intervention-disclosure-label">
        <span className="when-closed">Xem chi tiết</span>
        <span className="when-open">Thu gọn</span>
      </span>
    </summary>
    <div className="intervention-detail">{/* evidence, override, actions */}</div>
  </details>
</article>
```

For groups without a root lesson, use `<strong>Nhóm:</strong>` instead of `<strong>Bài:</strong>`. Move `Giao bài cho nhóm` and `Tải danh sách` into `intervention-detail` so the collapsed list stays scannable.

- [x] **Step 4: Render concise details**

Use headings `Học sinh trong nhóm ({count})` and `Câu nhiều học sinh trả lời sai`. For each question summary, show the prompt once, the affected count, and the learner labels. Keep the teacher override form and representative-evidence note unchanged in meaning.

### Task 3: Match the compact course-list rhythm in the existing design system

**Files:**
- Modify: `src/styles/global.css`
- Test: `src/app/App.test.tsx`
- Test: `src/features/teacher/TeacherClassPage.test.tsx`

- [x] **Step 1: Replace the three-column card CSS**

Make `.intervention-row` a contained surface with no internal outer grid. Make `.intervention-summary` a four-column grid on desktop: rank, lesson copy, compact metrics, disclosure label. Use existing tokens only (`--surface`, `--rule`, `--s-*`, `--radius-*`, `--primary`) and no images, new fonts, gradients, or dependencies.

- [x] **Step 2: Style the detail as a clearly separated secondary area**

Add a top border and quiet background to `.intervention-detail`. Keep the existing two-column evidence grid at desktop and one column below `52rem`. Style the grouped question list as compact rows with count badges and wrapping learner names.

- [x] **Step 3: Make responsive rows reflow without horizontal overflow**

At `68rem`, move metrics beneath the lesson copy. At `52rem`, use a single-column summary, keep the rank and lesson on the first row, and ensure every control remains at least `44px` tall. Preserve native focus outlines and reduced-motion behavior.

- [x] **Step 4: Run the focused test and the full verification suite**

Run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run eval
npm run build
```

Expected: all commands exit `0`.

- [x] **Step 5: Review changed files against Web Interface Guidelines**

Confirm semantic headings, native disclosure keyboard behavior, visible focus, labelled filters, status announcements, tabular numerals, long-text wrapping, and responsive grid behavior. Record only remaining actionable findings.

- [x] **Step 6: Commit the finished change**

```powershell
git add src/app/App.test.tsx src/features/teacher/TeacherClassPage.tsx src/styles/global.css docs/superpowers/plans/2026-07-18-teacher-class-simplification.md
git commit -m "feat(teacher): simplify support group overview"
```

### Task 4: Start the local review build without browser automation

**Files:**
- No source changes expected

- [x] **Step 1: Start Vite on a stable local port**

Run:

```powershell
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

- [x] **Step 2: Verify only service readiness**

Request `http://127.0.0.1:4173/` over HTTP and require status `200`. Do not open or inspect the new UI in any browser; the user performs visual review.
