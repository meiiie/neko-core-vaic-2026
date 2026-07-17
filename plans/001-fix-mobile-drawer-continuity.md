# 001 — Fix mobile drawer continuity and focus

- **Status**: DONE
- **Commit**: `69cc370`
- **Severity**: HIGH
- **Category**: Accessibility, physicality and interruptibility
- **Estimated scope**: 2 files, about 60 lines

## Problem

The mobile drawer moves onto the screen but focus does not follow it. When closed, its links remain
in the tab order at negative x positions. When opened, focus stays on the Menu/Đóng button behind
the backdrop, and pressing `Escape` does not close the drawer.

```tsx
// src/components/AppLayout.tsx:60 — current
<button
  className="mobile-menu-button"
  type="button"
  aria-expanded={mobileOpen}
  aria-controls="product-sidebar"
  onClick={() => setMobileOpen((open) => !open)}
>
```

```css
/* src/styles/global.css:1408 — current */
.product-sidebar {
  width: min(86vw, var(--sidebar-width));
  transform: translateX(-105%);
  transition: transform 180ms ease;
}
```

## Target

- Opening moves focus to the current drawer route, or the first drawer link if none is current.
- `Escape`, the backdrop and route selection close the drawer.
- Closing returns focus to the Menu button when no navigation occurred.
- The closed mobile drawer is not pointer- or keyboard-interactive.
- Background workspace/header content is inert while the drawer is open.
- Drawer: `transform 180ms cubic-bezier(0.23, 1, 0.32, 1)`.
- Backdrop: `opacity 160ms cubic-bezier(0.23, 1, 0.32, 1)`.
- Under reduced motion, translation is instant but opacity/color feedback remains.

## Repo conventions to follow

- Focus styling already lives in `src/styles/global.css:123`.
- The drawer state remains owned by `AppLayout`; do not add a state library.
- Reuse `--touch-target` and add the shared curve as
  `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` beside the existing root tokens.

## Steps

1. In `src/components/AppLayout.tsx`, add refs for the Menu button and drawer.
2. Add an effect that listens for `Escape` only while the drawer is open.
3. On open, focus `[aria-current="page"]` inside the drawer, falling back to the first link.
4. Make the mobile header and `.product-workspace` inert while the drawer is open; restore them on
   close. Keep desktop navigation unaffected.
5. Replace inline `setMobileOpen(false)` handlers with a small close helper. Route selection closes
   without restoring focus to a control on the previous page.
6. In the mobile media query, combine `visibility` with the transform so closed content leaves the
   accessibility/tab order only after the exit completes.
7. Keep the backdrop mounted long enough to animate opacity out, or use a data-state wrapper that
   can represent opening/open/closing/closed. Do not use keyframes.
8. Give the “Đổi” account button `min-width: var(--touch-target)` and an accessible name of “Đổi
   tài khoản”.
9. Add UI tests for open focus, `Escape`, backdrop close and closed-drawer tab exclusion.

## Boundaries

- Do NOT change teacher routes, labels, domain data, account semantics or priority behavior.
- Do NOT add a drawer, focus-trap or motion dependency.
- Do NOT turn the one-click demo session into an authentication claim.
- If React/TypeScript does not accept the `inert` property as used, stop and add the smallest typed
  attribute helper; do not silence types broadly.

## Verification

- **Mechanical**: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build` on Node 24.18.0.
- **Feel check**: at 390×844, open the drawer and confirm the panel moves from the same left edge it
  exits; use the DevTools animation panel at 10% playback and verify there is no backdrop flash.
- **Keyboard**: Menu → current route; `Escape` → closed Menu; closed drawer links never receive
  focus; `Tab` cannot leave the open drawer for obscured page content.
- **Reduced motion**: drawer position changes without travel while backdrop opacity still explains
  the state.
- **Done when**: all exit mechanisms agree, focus is never obscured/off-screen and all controls are
  at least 44×44 CSS px.
