# 003 — Move loading shimmer to the compositor

- **Status**: DONE
- **Commit**: `69cc370`
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, about 35 lines

## Problem

The full 24 rem loading surface animates `background-position`, which requires repainting a large
area throughout the indefinite 1.4 second loop.

```css
/* src/styles/global.css:633 — current */
.page-loading {
  min-height: 24rem;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, #eef1f6 25%, #f8fafc 50%, #eef1f6 75%);
  background-size: 200% 100%;
  animation: loading 1.4s infinite;
}

@keyframes loading {
  to {
    background-position: -200% 0;
  }
}
```

## Target

Use a clipped pseudo-element and animate only its transform:

```css
.page-loading {
  position: relative;
  overflow: hidden;
  min-height: 24rem;
  border-radius: var(--radius-lg);
  background: #eef1f6;
}

.page-loading::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 70%), transparent);
  transform: translateX(-100%);
  animation: loading-shimmer 1.4s linear infinite;
}

@keyframes loading-shimmer {
  to {
    transform: translateX(100%);
  }
}
```

## Repo conventions to follow

- No new image or dependency.
- The accessible loading label stays in React; the pseudo-element is decorative.
- Keep the existing radius and minimum height unless a separate layout task changes them.

## Steps

1. Replace the background-position animation with the pseudo-element transform shown above.
2. Confirm no other selector depends on the old `loading` keyframe name before removing it.
3. Under reduced motion, set `.page-loading::after { animation: none; display: none; }` and leave a
   stable neutral loading surface.
4. Check that the pseudo-element cannot capture pointer events.

## Boundaries

- Do NOT add more shimmer blocks or increase the duration.
- Do NOT animate width, left, background-position or a parent CSS variable.
- Do NOT change loading state timing or application data flow.

## Verification

- **Mechanical**: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`.
- **Performance**: use DevTools Rendering/Paint Flashing; the loading loop should not repaint the
  full panel on every frame.
- **Feel check**: normal motion stays subtle; reduced motion is static and still clearly loading.
- **Done when**: only `transform` changes during the loop and the loading label remains exposed to
  assistive technology.
