# N01 — NekoPath mark cleanup

Status: promoted product-identity derivative
Generated: 2026-07-17T17:38:06Z
Mode: built-in image generation, edit target visible in the conversation

## Input

- Edit target: team-supplied `E:\Downloads\ChatGPT Image 23_27_49 17 thg 7, 2026.png`
- Immutable repository copy: `brand/source/nekopath-logo-concept-v0.png`
- Source checksum and rights assumption: `docs/BRAND_SYSTEM.md#2`

## Exact prompt

```text
Use case: background-extraction
Asset type: NekoPath PWA brand mark, app icon source, and social-preview identity.
Input image: the supplied NekoPath logo is the edit target and must be preserved faithfully.

Primary request: recreate the supplied black feline mark as a clean, high-resolution, vector-like
flat brand mark on a perfectly uniform #00ff00 chroma-key background for later transparent
background removal.

Subject and invariants: preserve the exact recognizable silhouette and composition from the
source: a friendly black cat emerging from a folded-paper/path-like rounded shape, white line eyes
and small white nose detail, and the same tail/leg direction. Preserve the playful-but-serious
expression. Keep it as a single monochrome black-and-white mark. Center it optically in a square
1024×1024 frame with generous even padding, suitable for a PWA icon safe zone.

Constraints: no wordmark, letters, captions, watermark, gradients, shadows, texture, paper grain,
lighting effects, reflections, decorative elements, or extra objects. The #00ff00 backdrop must
be completely flat and uniform, with no green in the mark. Do not turn the mark into a cartoon
mascot illustration; it is a minimal professional logo mark.
```

## Derivation and review

1. Generated chroma-key draft: `generated/N01-v1-nekopath-mark-chromakey.png` (ignored local raw
   research artifact).
2. Removed the chroma key using the image-generation skill's local helper, yielding
   `public/brand/nekopath-mark-v1.png` with transparent corners.
3. Produced deterministic 512/192/maskable/Apple-touch derivatives plus a 1200 × 630 local social
   card. No remote image is referenced by the app.
4. Rejected no source detail and introduced no extra mark, text, or mascot styling. Browser review
   passed at desktop and mobile; final human visual review remains welcome.
