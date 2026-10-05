# Command home recovery · October 4, 2026

## Problem and approved direction

Neil reported that direct member entry had lost the premium home base. Inspection of main `930ca72` showed `.command-home .command-environment { display: block }` overriding the preceding cinematic grid. The greeting, large draft form, next move, links and context note preceded the Aethelios presence. Direct entry remains the correct behavior; the recovery restores the home composition without reintroducing an entrance gate.

## Research and implementation plan

Reviewed official sources October 5 UTC / October 4 in the founder's timezone:

- Oura's Today design emphasizes relevant daily information and direct access to deeper insights: https://ouraring.com/blog/sv/new-app-design/ . Apply the daily hierarchy, not its sensor metrics.
- Samsung foldable guidance emphasizes responsive layout and continuity: https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html . Preserve component identity, source selection and draft text through resizing.
- web.dev animation guidance favors bounded rendering and composited properties: https://web.dev/articles/animations-and-performance . Reuse the current bounded energy renderer and Still fallback; introduce no new animation loop.
- Installed Next.js 16.3.5 CSS, lazy-loading and server/client guides: CSS import ordering matters, global selectors persist across navigation, and lazy client workspaces must retain their existing boundary. Scope changes under Command home.

Plan: one responsive hero; next move and Aethelios visible on cover screens; side-by-side daily direction and presence on wide screens; expandable Talk draft; authored Grooming/Performance/Collection doors; saved-context explanations in a disclosure. Preserve the existing source/day/owner/version/uncertain-write checks and no automatic message send.

## Implemented behavior

- One named-area grid owns arrival label, greeting/briefing, connected energy presence, today's move and Talk. Removed the competing direct-home block layout instead of layering a second new layout over it.
- Phone composition places the presence before the move; short displays reduce decorative height and secondary briefing copy so the next-action button remains above navigation at the tested standard text sizes. Enlarged text uses natural scrolling rather than clipping content.
- Wide/Fold composition places the saved daily direction and action alongside Aethelios. Existing renderer, crest, source controls and measured connections remain.
- Talk is an accessible native disclosure with an expandable draft. It preserves the current owner-bound handoff, explicit send in Talk, session clearing and no draft URL/browser-storage persistence. Resume remains available.
- Grooming, Performance and Ascend Collection have clear authored entry links. The persistent main navigation remains unchanged.
- Saved records, preparation receipts and arrival interpretation sit inside a native disclosure; unavailable decision status remains visible. An empty approval queue is one quiet line.
- Browser testing exposed the existing lazy-depth timing problem: focusing the loading placeholder could leave the orb in view and the actual workspace below it. Focus/scroll now runs once the actual lazy workspace mounts, with animation-frame cleanup.

## Scope

Presentation and local focus behavior only. No dependency, API, domain-policy, schema, authentication, provider, public-site, membership or payment changes. No model calls from home and no new implied listening/analysis state. Base: `930ca72ada8df49c59dc2094bc2980ecf97bdd3f`.

## Verification

Final lint, strict typecheck, 343 unit/SQL tests and normal Turbopack production build pass. The migration checker confirms 28 inherited files against its recorded ledger snapshot; this is not a fresh hosted database check. No migrations changed.

Synthetic browser visual audit: 344×740, 390×844, 360×640, 768×900, 820×1180 and 1440×900, plus 360×640 at 200% text. Zero page errors and document overflow. Current primary move/action remains above the bottom navigation at tested phone sizes. Screenshots/report: `docs/validation/command-home-recovery/`. Evidence uses fictional records and the reused static Still fallback, not a real authenticated member or a live model.

Final targeted browser run: **45/45 passed**, including Command/source inspection, acknowledged completion/readback, private-session clearing, source selection and draft continuity through Fold resize, keyboard, graphics loss/Still, lazy-depth focus, disclosure navigation and shell/production harness denial. The first run identified the lazy-depth timing bug and selectors that needed to follow the new disclosure and Performance label; these were corrected without weakening owner, persistence or renderer assertions.

Real founder-session save/reload, physical Fold touch/GPU/battery and live-model evaluation remain unrun here. This focused build does not certify the entire product for public launch. Publication is a review branch/draft PR, not production promotion.
