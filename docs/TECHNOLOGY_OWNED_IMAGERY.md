# Public Aethelios Technology Phase 6 — owned imagery and publication review

## Recovered baseline and current state

Recovered exact Phase 5 PR #70 candidate `f84899c2443e85d70527583de0cf9fdf947352fd`, tree `61ed9fac3af469fe266567877cea4efe197c4a08`, onto dedicated `feat/technology-owned-imagery`. PR #70 is open and unmerged. Prior creation work is a stacked chain (#64 → #65 → #67 → #68 → #69 → #70); recover its code rather than blindly merging overlapping branches. Public production remains READY main `3e826f5e7944c3c37634bf8efb984b1c72141bd5`, containing the corrected official icon. Public identity and unrelated product sections are preserved. No private Founder Aethelios or Reserve project was modified.

## Research and decision — 2026-10-09

Primary references:

- [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals): session-authorized downloads retain ownership; signed URLs expire and should not become durable website references.
- [sharp constructor](https://sharp.pixelplumbing.com/api-constructor/), [output](https://sharp.pixelplumbing.com/api-output/), [security](https://sharp.pixelplumbing.com/security/) and [0.35.5 changelog](https://sharp.pixelplumbing.com/changelog/v0.35.5/): bounded raster decoding, strict errors, dimensions and metadata-free normalization. Pin sharp 0.35.5 explicitly; it was already a framework dependency and introduces no paid service.
- [Vercel for Platforms](https://vercel.com/docs/platforms): an available future hosting/domain approach, requiring explicit tenant/domain authorization and spending controls. No platform hosting or domain was activated.

Build natively on existing private Studio storage and exact-version static builds. A customer explicitly prepares one of their personal Studio references or completed generations, selects its website copy and supplies meaningful alt text, then saves and reviews a new website version. Four imports per project and twenty per person, including failures, keep the invited pilot bounded. Image selection is manual review; Talk may discuss the selected asset reference but cannot invent, replace or generate images. No extra AI call or billing change.

## Asset and import contract

`technology_images` stores one immutable normalized JPEG snapshot, its SHA-256, source identity and import receipt. RLS grants owner SELECT only. Normal users cannot insert/update/delete snapshots or report completion. A source must belong to their personal Studio project (company_id NULL); unfinished generations, other customers and company Studio sources are denied server-side. Import uses only an owner-resolved Storage key from SQL, never a caller URL, signed URL or service-key download.

`technology_image_begin` uses the authenticated session and pilot authority, exact saved project revision, a person lock, source deduplication, one active per-owner lease and the two storage quotas. A 30-second lease fences completion; resume uses the same receipt ID and allows at most three attempts. No automatic retries or quota refunds. Failed, expired or uncertain imports remain visible and recoverable within those bounds. A ready replay returns its receipt without downloading or decoding again. The service key is limited to validated completion; it does not read customer source images.

Processing accepts PNG/JPEG/WebP signatures, at most 10MB and 16MP, rejects malformed or reported multi-frame inputs, uses strict decoder warnings and an eight-second native processing timeout, rotates by source orientation, fits within 1000×1000 without enlargement, flattens transparent areas onto petrol and emits JPEG quality 65 with default metadata stripping. A normalized copy above 100KB is refused. Original images are not sent to OpenAI. Native raster decoding is not arbitrary generated-code execution; source byte/pixel/time quotas remain necessary. The Vercel request budget is 30 seconds; interrupted download/completion is recovered through the lease, not silently repeated.

Optional brief image is `{assetId,alt}`: UUID, 3–160 single-line characters, strict keys. The generated version column plus composite foreign key bind the asset to the exact person AND website project. A BEFORE INSERT guard requires a ready snapshot. Removing selection creates an image-free new version; earlier image-bearing versions retain the same snapshot. Removing the Studio object or project does not remove saved website imagery. Removing the website/account eventually cascades its private copies; this phase adds no independent deletion/refund UI.

## Preview, export and compatibility

Preview reads JPEG through session-bound `/api/technology/images?id=UUID`, verifies its digest, uses private/no-store/nosniff headers and bypasses shared image optimization. Build reads the referenced ready asset with owner/project filters, verifies bytes/digest and embeds the bounded JPEG data URL. Export is portable and requires no private cookie, remote URL or expiring Storage link to display the image. Consequently, choosing to download/share an export deliberately includes that selected image copy.

Image-free HTML bytes remain unchanged, including the pinned legacy hash. Keep the existing deterministic compiler/template identifiers: this extends the strict static contract rather than executing a new program. CSP stays default-deny, adding only `img-src data:` for image-bearing artifacts. The validator rejects external image sources, executable handlers, srcset, missing alt text, unresolved navigation and oversized output. Image-free artifacts retain 100KB output bounds; image-bearing artifacts have a 250KB bound. The additive migration raises the database payload ceiling to 250KB while preserving every ready/non-ready shape guard. No forms, JavaScript, payments, booking operations or live publishing are added.

Before rollback, disable image-bearing entry points or release a compatible reader. Phase 5 cannot validate/edit image-bearing briefs or export larger images. Keep additive snapshots and saved versions; do not strip references or rewrite existing receipts. Build leases, hash checks, deduplication, five attempts, AI limits and account isolation remain intact.

## Publication review and release gates

Authenticated GET `/api/technology/publication?build=UUID` prepares `website-publication-review-v1` only for an owned READY, hash-verified build with its exact reviewed source. It binds owner/project/version/revision/build/SHA-256. Target is unconfigured, domain NULL, budget zero, publishEnabled false and approval required. There is no POST/publishing action. This is an operator readiness contract, not a customer feature claiming live hosting. Domain ownership, approved hosting budget, isolated hosted acceptance and explicit founder release decision are enumerated gates. Deployment/domain adapters, customer approval records, idempotent publish jobs and rollback remain unimplemented.

Migration order is the seven unchanged source migrations from Phase 5, then `20261009023308_technology_owned_images.sql`. Read-only hosted preflight at `2026-10-09T02:50:51.722690Z` confirms all 34 prerequisites and finds all 39 additive checks absent across eight release stages. No hosted migrations, grants, seeds or resets were applied. The shared hosted ledger contains separately owned Reserve entries: never blind db push/reset. Source hashes, object grants, RLS, owner FK and build ceiling are in the expanded release preflight.

Automated validation and exact candidate/CI/preview receipts are recorded in the Phase 6 PR. Tests cover real raster normalization, malformed/oversized inputs, pixel limits, digest tampering, source/owner/company denial, lease fencing, retry/import caps, immutable snapshots, strict refs and AI refusal of invented assets. Responsive browser journeys at 320/720/1440 test alt review, selection/removal, saved recovery and embedded export rendering without remote image requests. A real disposable Supabase Auth/browser journey imports through actual Storage and the application broker, saves/reviews/builds/exports, removes the source object, reloads the retained copy, verifies the disabled manifest and rejects a second account. Fixture interception and PGlite are not hosted/provider acceptance.

Hosted staging remains a separate release gate: require a confirmed isolated project, approved provisioning cost if any, exact candidate environment, all eight migrations in order, two verified synthetic test accounts and protected deployment access. Do not reuse production or either private application. No staging account passwords or service credentials belong in reports/Git. CI reset/seed applies only to disposable local Supabase. Physical Fold/iPhone review and live provider pricing/quality evaluation also remain pending.

## Phase 7

Rehearse the integrated candidate on approved isolated hosted staging, evaluate real website-copy requests and image quality/cost, then implement controlled publishing for exact approved static builds: owner-domain proof, target/budget approvals, idempotent deployments, receipts and rollback. Activate no paid provisioning or customer production publishing until those prerequisites are concrete and approved. Arbitrary applications remain a later sandbox/network/storage/spend architecture.
