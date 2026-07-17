# NekoPath brand system

Status: implementation contract for the VAIC 2026 MVP  
Owner: Neko Core  
Last reviewed: 2026-07-18 (ICT)

## 1. Brand decision

**Neko Core** remains the team name. **NekoPath** is the product name shown to learners,
teachers, judges and in the deployed application.

The supplied black feline mark is the product's source identity. It gives the otherwise
evidence-led product one memorable, human signal, but it must never turn the application into a
mascot, chatbot, or gamified school experience. The mark is a quiet signature; the teacher's
next decision is still the visual priority.

Product promise, for use only where the implementation demonstrates it:

> NekoPath helps a teacher trace a learner's current error to an evidence-backed next learning
> step, then organize a mixed-ability class around the action that matters first.

This is deliberately not a claim of validated learning gains, whole-curriculum coverage, or an
AI replacement for teachers.

## 2. Source mark and provenance

| Field | Value |
|---|---|
| Source | Team-supplied concept image, `E:\Downloads\ChatGPT Image 23_27_49 17 thg 7, 2026.png` |
| Source dimensions | 1448 × 1086 px |
| SHA-256 | `d416f85c97ac60d372e2c1933b023a944e7485eb2fb0fb30f0ccce761ec5a41b` |
| Rights assumption | Team-provided for NekoPath use; do not treat it as a third-party asset |
| Immutable original | Copy into `brand/source/` before deriving any product asset |
| Derivative rule | Never overwrite the source or an existing PWA icon; use versioned sibling files and record each promotion |

The supplied raster is a source concept, not an authoritative vector master. Before a production
asset is promoted it must pass: faithful silhouette review, transparent/solid-background edge
check, 16/24/32/44 px legibility, contrast on paper and dark surfaces, and the PWA icon safe-zone
check. A failure means retain the prior icon and mark the candidate `revise`.

## 3. Visual language

### Positioning

**Calm classroom intervention notebook.** The product should feel durable, local and
teacher-respectful rather than like a generic AI dashboard. The cat mark lives at the boundary of
the product (login, shell, install/share surfaces); evidence, uncertainty and the next classroom
action dominate task screens.

### Semantic palette

These names are the stable contract; the CSS custom properties are the implementation source of
truth.

| Token | Starting value | Meaning |
|---|---:|---|
| `brand-ink` | `#17211D` | mark, primary text and the serious classroom tone |
| `brand-paper` | `#F4F0E6` | warm, low-glare canvas |
| `brand-surface` | `#FFFCF5` | reading and decision surfaces |
| `evidence` | `#006B61` | sufficiently evidenced path or primary action |
| `review` | `#9A5A00` | uncertainty, teacher review or offline caveat |
| `danger` | `#B42318` | destructive action or actual error only |
| `focus` | `#1358BE` | keyboard location only; never brand decoration |

The supplied mark stays monochrome. Do not recolor individual learners, use red/green as an
ability label, add gradients, glass, glow, or a decorative cat illustration behind classroom
content.

### Type, rhythm and motion

- Offline system stack only; Vietnamese diacritics and mathematics remain readable without a
  network font request.
- Keep the 4 px spacing quantum and 16/24 body, 18/28 emphasis, 24/32 section, 32/40 page type
  rhythm defined in `PRODUCT_UI_CONSTITUTION.md`.
- Use a 3 px focus ring with 2 px offset, 44 px task targets, and text plus color for every
  status.
- Motion is reserved for direct response to a user action, completes quickly, and disappears
  under `prefers-reduced-motion`; no decorative entrance sequences or simulated AI activity.

## 4. Mark usage

| Context | Treatment | Reason |
|---|---|---|
| Login / role entry | Mark on a small paper tile against the dark story panel; product wordmark adjacent | establishes identity without reducing contrast |
| Persistent desktop/mobile shell | Standalone 32–40 px mark beside the wordmark; decorative (`alt=""`) because text names the product | recognisable and screen-reader quiet |
| Installed PWA / favicon | Square, padded, high-contrast derivative only after safe-zone validation | recognisable at small system sizes |
| Social preview / deck cover | Mark plus real product promise and an explicit synthetic-demo qualifier | creates a truthful share card |
| Student question / teacher intervention | No decorative mark in the decision region | protects task hierarchy and cognitive focus |

Minimum clear space is one quarter of the mark's displayed width on all sides. The mark must not
be stretched, shadowed, placed over busy imagery, used as a button without an accessible label,
or treated as proof of an AI capability.

## 5. Asset pipeline

```text
team source image (immutable)
  -> reviewed clean mark candidate
  -> small PNG PWA derivatives (192 / 512 / maskable / apple touch)
  -> social-preview composition
  -> metadata + shell integration
```

Every generated or composited candidate is registered in `labs/imagegen/ASSET_REGISTER.md` with
its source/prompt, output path, review decision and promotion commit. Product assets must be
local, versioned and under the performance budget: no remote image, no decorative hero raster,
and no critical-shell image above 200 KiB.

## 6. Copy system

- Product name: `NekoPath` (no space, capital P).
- Team attribution: `by Neko Core` only in README, deck, about/share contexts; not in the
  learner's primary task.
- Preferred verbs: `lần theo`, `kiểm tra`, `gợi ý`, `nhóm theo nhu cầu`, `cần thêm bằng chứng`.
- Avoid: `SOTA`, `chắc chắn`, `thông minh hơn giáo viên`, `tự động dạy thay`, `AI-powered` as a
  headline, or claims of real student outcomes.

## 7. Acceptance checklist

- [x] The original has been copied without mutation and its checksum matches this document.
- [x] Every promoted derivative is readable at 16 px and 44 px, has no visible edge/fringe, and
      has a documented source.
- [x] The login, mobile header and sidebar use the same component/asset rather than divergent
      logos.
- [ ] PWA manifest, favicon, Apple touch icon and social metadata resolve locally over HTTPS.
- [x] Brand changes do not add a remote request, break CSP, weaken offline behavior, or displace
      the teacher's primary action.
- [x] A visual review at 1440 × 900 and 390 × 844 confirms hierarchy, focus and reflow.
