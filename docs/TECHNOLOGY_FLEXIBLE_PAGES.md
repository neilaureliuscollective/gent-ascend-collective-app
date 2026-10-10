# Public Aethelios Technology Phase 5 — flexible informational pages

## Baseline and scope

2026-10-09: recovered exact Phase 4 remote candidate `03da4bd77bb483181dd6ac40afb7bb3e5a0bd8b4`, tree `979a47b228b2361354408ba905a9c258221ac3ab`, from draft PR #69. Phases 1–4 remain a stacked dependency chain (#64 → #65 → #67 → #68 → #69). Do not merge overlapping branches independently. Main and the latest READY production deployment still use `3e826f5e7944c3c37634bf8efb984b1c72141bd5`; the official corrected icon is preserved. This feature is development work, not live.

The useful next slice is bounded informational page composition. Four core pages remain intact; up to three additional pages have a unique address, title, stacked/card layout and one to three text sections. Customers edit, reorder, remove, save and review pages in Technology. Talk may propose pages and existing metered exact-version revisions may apply a selected request. Every result needs user review before building. No automatic publishing, operational forms, arbitrary code, new infrastructure or billing changes.

## Current research and architecture decision

Reviewed primary documentation on 2026-10-09:

- [Lovable Plan mode](https://docs.lovable.dev/features/plan-mode): project investigation, editable plans and explicit implementation decisions support keeping Talk proposals distinct from saved website mutations.
- [Replit Visual Editor](https://docs.replit.com/design/visual-editor): deterministic edits avoid agent credit consumption; adopt manual page/text/layout edits without an additional model call. This is a structured editor, not a claim of equivalent canvas editing.
- [Vercel Sandbox](https://vercel.com/docs/sandbox): isolated execution is an option for future arbitrary code, with separate lifecycle/network/spend controls. Current text-only compilation does not need paid sandbox compute.

Decision: extend the existing strict brief/compiler rather than integrate a competing builder or introduce executable model output. Reuse Supabase session/RLS, immutable versions, Mission/Talk context, Saved Work summaries, existing static build lease/deduplication/recovery and private hash-checked export. Direct OpenAI remains the approved provider. No changes to authentication, billing or company data boundaries.

## Contracts and compatibility

Optional `pages` is a strict array of at most three objects. Slugs are 2–48 characters, lowercase hyphenated words, unique and exclude the four core addresses. Titles are 2–60 characters; layout is `stacked` or `cards`. Each page has 1–3 sections, heading 2–80 and body 3–600 characters. Unknown keys, executable layout values, duplicate/reserved addresses and invalid bounds fail closed in both Zod and Postgres.

`20261009013900_technology_flexible_pages.sql` follows the six prior reviewed migrations. It retains the design/core validators, rebinds the version constraint and leaves RPC privileges, ownership, quotas and data unchanged. All prior migration hashes are unchanged. Read-only hosted catalog observation at `2026-10-09T01:42:40.794257Z` finds all 25 existing prerequisites correct and all seven additive release stages absent. No hosted migration was applied. The shared ledger includes Reserve-owned entries: never blindly push/reset it.

Legacy briefs omit pages. Their compiled HTML bytes are unchanged and pinned to the independently computed Phase 4 SHA-256 in tests. Empty pages produce those same bytes. Retain `service-business-export-v1` and `static-service-v1`: this is a backwards-compatible extension of text-only informational sections, not a new executable compiler. Navigation verification now additionally rejects duplicate IDs and unresolved internal links. Existing stored receipts still export if hash and current static checks pass. A ready build remains bound to its immutable source version; adding pages creates a different version/build.

Preview uses page buttons; the standalone export remains one portable HTML document with anchor sections, including each additional page. It does not create independent hosted routes. Text is escaped, no model CSS/HTML/scripts/images/URLs are executed, CSP remains default-deny, forms disabled. Cards reflow using bounded responsive CSS. Manual working drafts may be invalid until corrected; Save validates all fields.

Rollback: Phase 4 does not understand the new `pages` property. After page-bearing versions exist, do not roll back to Phase 4 without disabling affected editing/build entry points or releasing a compatible reader first. Keep additive schema and immutable data; do not strip pages or downgrade hashes. Production promotion requires an integrated candidate built from the dependency chain, isolated hosted rehearsal and explicit founder release decision.

## Cost, testing and remaining gates

Manual page edits and static builds require no AI call. A requested AI page revision uses the existing one-call, zero-retry, 85-second timeout, 14KB input/4000-token output, $1 reservation/$10 UTC monthly pilot policy. Five projects/100 versions and existing build attempt/lease limits remain. Unknown outcomes retain reservations; no automatic retry/refund. Large briefs may exceed the pre-existing Talk/AI byte bounds and be refused without truncation or spending. Live model pricing/usage reconciliation and provider quality evaluation remain release gates; this phase does not widen the budget.

Tests cover schema and SQL bounds, owner/stale/idempotency/immutable history, escaped hostile text, navigation integrity, legacy hash compatibility, model settlement and refusal of unsolicited pages during ordinary copy refinement. Browser journeys exercise editing/reorder/removal/save/reload at 320/720/1440px. Real Supabase CI acceptance extends the existing authenticated creation/export/reload/second-account denial journey with a page-bearing version. PGlite and intercepted browser fixtures are not hosted Auth/provider acceptance.

Owned imagery remains a distinct Phase 6 deliverable: existing Studio assets are private owner-scoped Storage records. A website needs explicit asset selection consent, immutable asset digest/version references, safe MIME/size processing, deletion/lifetime behavior, bounded export packaging and revised image CSP. Do not place expiring signed URLs or arbitrary remote URLs in briefs, infer ownership from client data, or fetch model-selected addresses. No decorative image generation was requested or performed.

Phase 6 should implement that asset lifecycle, then rehearse the integrated release on isolated hosted staging. Publishing follows with owner/project/version/hash/domain/target/budget manifests, explicit publish decisions, idempotent deployment, domain validation and rollback. Provisioning paid infrastructure and production release need separate founder approval. READY preview is a build receipt, not hosted database acceptance or live customer capability.
