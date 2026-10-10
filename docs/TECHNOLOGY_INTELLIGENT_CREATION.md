# Public Aethelios — Technology Phase 3

## Inspection and recovered foundation

Inspected October 8–9, 2026. Public repository only. PR #64 (`af89b761`) and #65 (`e429cfae`) remain open against main; #67 (`e19a695a`) is stacked on #65 and contains both. Phase 2's exact-head Quality gates run 37854218494 is completed/success. Recover that source, then integrate production main locally; the only merge conflict was STATUS.md and both receipts were retained. Do not merge overlapping PRs separately.

PR #66 remains open but its proposed artwork is superseded by current main's official icon correction `3e826f5e7944c3c37634bf8efb984b1c72141bd5`. Vercel production deployment `dpl_2Up4d3znSn85YdRXKF83GwZ1vr4X` is READY at that commit. All its assets and installation changes are retained in this candidate. The creation platform is not live. Read-only catalog inspection on public project `volpzkfsnmtztrovexcw` found Mission proposals/deliverables and Technology projects/builds absent. No hosted schema write occurred.

## Research and architectural decision

Current primary sources reviewed:

- https://docs.lovable.dev/features/preview-toolbar — explicit target selection, natural-language requests and inline edits share project continuity; paid edits consume credits. Apply scoped requests and retain manual edits without provider spend.
- https://docs.replit.com/learn/projects-and-artifacts/version-control — checkpoints and restore support iteration. Apply immutable reviewed sources and exact-version outputs rather than overwriting a site.
- https://vercel.com/docs/sandbox and https://v0.app/docs/sandbox — untrusted generated code needs isolated compute. Defer arbitrary code, packages, servers and executors until cost/network/lifecycle controls are approved.
- https://supabase.com/changelog.md — fetched current index; scoped-token availability and adapter deprecations do not change this existing SSR/RLS slice.
- Installed Next 16.3.5 route-handler/data-security guides — session-bound domain services, private responses, validated same-origin mutations, no server credential exposure.

Build the structured generation/compilation path natively on the existing database, AI SDK and direct OpenAI adapter. No additional framework, provider, vendor or paid service. A strict design contract gives the model meaningful layout choices while only audited renderer code executes. This is a safe intermediate engine, not unrestricted autonomous coding.

## Implemented scope

1. Natural-language refinement of an exact reviewed website revision: copy, audience/goal notes, CTA and composed design. One provider call appends an unreviewed immutable version. Confirmed business name/category/vision/service names/order/prices/contact/hours/booking link cannot change through AI. Unsupported pages/imagery/integrations are visibly outside this slice.
2. Versioned design contract: three audited palettes, three hero compositions, two heading families and two spacing modes. Rationale and original request persist with the version. These compose 36 design combinations. Manual controls incur no model spend. Model output never supplies HTML/CSS/scripts/fonts/remote image URLs.
3. Talk → Technology handoff for a Mission-linked website: the project opens its originating conversation; a completed user request can be selected for review/application. The server rechecks project ownership/revision, Mission ownership and exact source conversation/turn before reservation. Pending, detached, oversized, foreign and stale sources fail closed. Only selected user text and the website brief are provider context. Ordinary Talk does not automatically receive the site brief or apply changes.
4. Existing Work/Mission/Saved Work project links and independent Studio remain intact. Historical previews cannot trigger review/generation/build. Exact-version verified static HTML exports use the composed design. Legacy briefs without design render identically to Phase 2.
5. Five-stage release preflight includes the new validator/constraint and exact source hash, preserving all earlier migrations unchanged.

## Cost, recovery and security

Existing founder/person-grant pilot authorization remains independent of customer billing. Existing SQL atomic $1 reservation/$10 UTC month allowance, one unresolved run per owner, zero provider retries, 85s timeout, 4000 output-token bound, 14KB prompt bound, token accounting and ambiguous-outcome lock remain. No new allowance or billing change. The model selection/accounting schedule is inherited; provider pricing reconciliation remains a release gate. The instruction adds at most 1000 characters to bounded input. Strict output facts checks prevent provider changes to confirmed business data.

Existing five projects/100 versions, build deduplication, five fenced resume attempts, 100KB artifacts and owner-bound private export/hash checks remain. No arbitrary code execution, outbound fetch, public share URL or background worker. Palette values are audited constants; CTA is escaped. New JSON schema is validated in SQL, including direct RPC callers. Session clients retain read-only table access; existing narrow write RPCs and trusted service settlement remain unchanged.

## Migration and rollback

Apply unchanged reviewed dependencies in order, only after isolated hosted rehearsal:

1. `20261007190000_mission_continuity.sql`
2. `20261007210000_mission_deliverables.sql`
3. `20261008180000_technology_foundation.sql`
4. `20261008221240_technology_verified_build.sql`
5. `20261009001910_technology_design_engine.sql`

New migration retains the original core validator, adds a strict optional design validator and rebinds the table constraint. No existing records are rewritten. Earlier application rollback retains schema/data, but earlier clients do not understand design-bearing briefs; suspend Technology editing/exports during rollback until a compatible forward fix. Never drop saved work to roll back. The shared hosted ledger contains separate Reserve history; never blind push/reset it.

## Release disposition and Phase 4

Dedicated development PR, not production. Hosted staging, real provider quality/cost reconciliation, Samsung/iPhone acceptance and an explicit founder release decision remain. No paid staging provisioning, billing changes, production promotion or customer-site publication.

Phase 4 should finish a metered conversational business interview before project creation, full site-context Talk proposals, extensible page/section composition and owned imagery. Then rehearse the exact integrated candidate on isolated hosted staging and implement a reviewed publishing manifest (owner/project/version/content hash/domain/target/budget) with explicit publish approval, idempotent deployment and rollback. Choose native static hosting first; arbitrary application-code execution requires separately approved managed sandbox infrastructure. Do not imply booking/payment forms are operational until an actual integration is built and verified.
