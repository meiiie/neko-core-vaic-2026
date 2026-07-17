# SEO and share audit — NekoPath

Audit date: 2026-07-18 (ICT)  
Canonical public URL: `https://nekopath.holilihu.online/`  
Scope: VAIC judging demo, not a public school service or marketing site.

## Decision

NekoPath is a public, synthetic-data hackathon demonstration. It is useful when opened directly
by a judge, but it is not a consented school product, a stable public curriculum resource, or a
marketing landing page. The correct current SEO posture is therefore:

1. make the canonical URL, title, description, social preview, install metadata and icon
   internally consistent;
2. explicitly ask search engines **not to index or archive** the interactive demo; and
3. keep the page shareable for judges through Open Graph and Twitter/X metadata.

This is a safety and truthfulness choice, not an attempt to suppress discoverability. If Neko Core
later publishes a separate public explanation/landing page, that page can be indexable after it
has real owner/contact, privacy, curriculum-review and content-maintenance commitments. Do not
remove the demo's no-index policy merely to chase a search snippet.

## Findings before remediation

| Area | Observed state | Risk / consequence | Remediation |
|---|---|---|---|
| Canonical URL | No canonical link in the served document | Shares/crawlers can treat edge/origin variants as separate documents | Add exact canonical URL |
| Title and description | Present but generic and not aligned with the current product promise | Weak judge/share context | Replace with truthful Vietnamese copy |
| Open Graph / Twitter | Missing | Chat/social shares lack a coherent preview | Add local, absolute OG/Twitter fields |
| Indexing policy | No meta or HTTP `X-Robots-Tag` policy | Synthetic demo can be indexed/archived as if it were a school product | Add both HTML and origin header policy |
| `robots.txt` / sitemap | Origin's SPA fallback returned HTML for both paths; Cloudflare added its own managed robots prelude | Invalid crawler artifacts and ambiguous policy | Publish explicit robots and an intentionally empty valid sitemap response |
| PWA identity | Manifest and favicon use the generic “N” mark | Installed app and shared product are visually inconsistent | Replace only after a reviewed NekoPath mark derivative passes safe-zone checks |
| Performance field data | PageSpeed API returned HTTP 429 because no quota/API key was available | No speed conclusion can be inferred | Run a local/browser performance smoke; do not claim a score from this failed call |

The live edge already had useful safety headers: HTTPS/HSTS, CSP, `nosniff`, frame denial,
referrer policy and permissions policy. Metadata work must preserve those headers and must not add
third-party analytics, remote fonts or remote share images.

## Metadata policy

| Field | Required value policy |
|---|---|
| `<title>` | Product + concrete teacher value; no unsupported performance claim |
| description | Vietnamese, concise, mentions sample/demo data truthfully |
| canonical | Exact HTTPS canonical URL only |
| robots | `noindex, nofollow, noarchive, nosnippet` on the demo |
| Open Graph | `website`, `vi_VN`, local HTTPS image, same factual promise as visible content |
| Twitter/X | `summary_large_image`, same title/description/image as OG |
| JSON-LD | Do **not** fabricate `Organization`, `Course`, `SoftwareApplication`, FAQ or review schema for an unindexed hackathon demo. No structured-data claim is better than inaccurate schema. |

## Verification after each deploy

```powershell
curl.exe -sS -I https://nekopath.holilihu.online/
curl.exe -sS https://nekopath.holilihu.online/robots.txt
curl.exe -sS https://nekopath.holilihu.online/sitemap.xml
```

Confirm: canonical and OG assets use HTTPS absolute URLs, every asset returns 200 with the expected
MIME type, no crawler endpoint falls through to SPA HTML, `X-Robots-Tag` is present, and the
canonical page has no extra remote network dependency. Use a link-preview debugger only after the
production deploy, because it will cache the result.

## Deferred, intentionally

- Google Search Console, keyword research and content pages: no appropriate public/indexable page
  exists yet.
- Structured data: would be misleading for a synthetic, no-index demo.
- Analytics: out of scope; it would add a privacy and performance surface without strengthening
  the 48-hour judging proof.
- A PageSpeed score: API quota failure is not a speed measurement. Browser/lab checks are the
  correct fallback for this release.
