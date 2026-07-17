# 002 — Preserve useful feedback under reduced motion

- **Status**: DONE
- **Commit**: `69cc370`
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 30 lines

## Problem

The current global rule removes every transition, including non-vestibular color and opacity
feedback.

```css
/* src/styles/global.css:1543 — current */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

## Target

Reduced motion removes position/scale travel but keeps feedback that aids comprehension:

```css
@media (prefers-reduced-motion: reduce) {
  html:focus-within {
    scroll-behavior: auto;
  }

  .product-sidebar {
    transition-duration: 0.01ms;
  }

  .button-primary,
  .button-secondary,
  .button-danger,
  .answer-choice,
  .demo-account {
    transform: none;
    transition-property: background-color, border-color, opacity;
    transition-duration: 160ms;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  }

  .page-loading {
    animation: none;
  }
}
```

Adjust selectors to the final source; do not leave movement on another component merely because it
is absent from this excerpt.

## Repo conventions to follow

- Add one shared `--ease-out` token at `:root`; do not repeat the cubic-bezier.
- Keep the existing focus outline and status semantics.
- Reduced motion is a gentler equivalent, not an absence of feedback.

## Steps

1. Inventory every movement/animation selector in `src/styles/global.css` again at execution time.
2. Replace the universal duration override with targeted movement suppression.
3. Retain color, border and opacity transitions at 160 ms using `var(--ease-out)`.
4. Ensure pressed controls do not translate or scale under reduced motion.
5. Add a CSS/source assertion or browser check that the drawer travel is instant while button
   color feedback remains non-zero.

## Boundaries

- Do NOT remove visible focus, status announcements or error feedback.
- Do NOT add JavaScript media-query handling when CSS covers the behavior.
- Do NOT change non-motion visual tokens.

## Verification

- **Mechanical**: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`.
- **Feel check**: emulate `prefers-reduced-motion: reduce`; verify no drawer travel, scale or shimmer,
  but hover/press/status color and opacity remain legible.
- **Done when**: reduced motion removes vestibular movement without reducing the interface to
  instantaneous, feedback-free state changes.
