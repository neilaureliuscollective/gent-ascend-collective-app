# Aethelios Phase Two — commercial and Architect foundation

Implementation date: 2026-10-10. Additive review work; not a launch receipt.

## Phase One verification

Both prior implementations and documentation exist on published branches. Member PR #81 remains the Phase One review dependency. Its Vercel preview succeeded, but GitHub application and database jobs failed on `test:e2e` and `test:founder`, respectively (run 38031226746). Remote log download is denied by the environment network policy; the exact failed assertions are not established. Do not label those failures environmental or fixed without logs and rerun evidence. Corporate runner billing/spending rejection remains recorded in docs/ECOSYSTEM_VALIDATION.md and the corporate repository. Corporate main still needs a reviewed initial base/release decision.

The local Docker/Supabase PostgreSQL image could not extract within the 32 GB workspace during Phase One. No database was created or reset. Phase Two does not repeat the same failed extraction. Real Auth/PostgREST acceptance remains open. Existing local component/browser and SQL checks are different evidence.

## Implemented

- Approved four-plan commercial catalog: Access free, Essential $19.99, Signature $49.99, Architect $129 monthly USD. Public membership copy distinguishes existing behavior from future allowances.
- Historical billing catalog, Stripe identifiers, snapshots, signatures, leased reconciliation and provider state checks retained. No automatic Reserve conversion, live product creation, charge or migration.
- Prepared capability-based launch contract and strict test-price validation. These contracts do not enable Architect enrollment. Existing session/RLS-backed policy remains the production authority; workshop and education are free previews without private persistence. Agent execution is never granted by the new resolver.
- Architect static website lifecycle: description → starter → editable HTML/CSS → isolated static preview → bounded revision snapshots → checks → JSON save/reopen and independent HTML export. No provider execution cost, automatic storage or external action.
- Health: expandable Human Systems Atlas introductions and authoritative MedlinePlus links; existing temporary appointment preparation retained. No record uploads, health inference, diagnosis, prescribing or model forwarding.
- Lifestyle: Legacy Reserve product-brand introduction, including Virelis, connected to existing Collection and Cabinet. Shopify remains catalog/cart/checkout/order authority. No speculative product data or duplicated inventory.
- Corporate commercial alignment and memberships destination; physical service operators excluded from this phase's commercial surfaces. Their applications are untouched.

## What Architect actually is today

A functional static-site workshop, explicitly a free working preview, not a launched AI development agent. Template generation is deterministic. Source changes can be previewed, revised, checked and exported. Projects are held in React state only; download JSON before navigating away. Import is bounded and schema validated. Ten snapshots are retained in the tab. A reviewed Talk starter can prepare website JSON using existing model access and quotas; the member manually submits the request, reviews output and pastes it into the workshop. No call, specialist selection or personal context transfer is automatic. Live model generation was not accepted in this task. No JS execution, arbitrary package installation, shell commands, server runtime, GitHub credentials, remote repository writes, cloud project sync, deployment, native mobile publishing or managed hosting.

Preview uses an empty iframe sandbox (no same-origin, scripts, forms, popups or top navigation), a strict CSP and an allowlisted static HTML projection. External resources and active tags/attributes are excluded. Raw source is preserved in exports: export is not a security certification. Static checks find landmarks and flag active/external content; they do not establish WCAG compliance, correctness or vulnerability absence. The generated software deliverable is separate from rights to the Aethelios platform; final ownership/license terms require legal review before enrollment.

## Server-authoritative billing expansion

Keep persons.id as the canonical member identifier and persons.auth_user_id as the current provider mapping. Do not rewrite existing foreign keys or auth sessions. A future identity-provider map can be additive once required; shared branding is not SSO.

Existing signed webhooks reconcile current Stripe state, not redirect parameters. Preserve event leases, duplicate handling, customer binding, paid invoice/price/period checks and unpaid upgrade protection. Historical Reserve $74.99 price matching remains essential for existing customers. The launch contract is separate from that catalog; no tier rename masquerades as migration.

Before Architect checkout: additive schema and generated type expansion reviewed against all tier constraints/RPCs; a distinct configured test price; existing verified reconciliation extended; two-person Auth/RLS tests; an atomic owner-bound execution ledger with conservative reservations; price/customer portal/webhook acceptance; final terms/tax/support and founder launch approval. A catalog entry or test-price validator grants nothing. Future software add-ons should yield named capability grants with source subscription item, quantity, expiry and revocation; never trust client tier names or checkout redirects.

## Minimum next AI development slice

Reuse direct OpenAI adapter and consent principles. Do not repurpose the daily-action proposal quota for coding. Add an owner-bound project/version/job schema plus RLS and atomic budget reservation before any new coding provider request. Scope each request to selected project files and explicit instruction, excluding personal/health/commerce context. Bound input/output, duration, attempts, files and reservation cost; retain failed/ambiguous billed attempts conservatively. Model output is untrusted schema-validated source, reviewed before replacing a version. Owner approves each call and external consequence separately.

Initially HTML/CSS web projects; then an isolated executable runner with outbound-network, secret and resource boundaries. Preview credentials must be scoped and short-lived. GitHub App installations and repository grants are explicit; proposed patches → checks → reviewed branch/PR, never automatic main writes. Deployments are owner-approved handoffs to independently owned infrastructure before managed hosting. Native publishing is outside the initial slice.

## Deferred intentionally

New AI agent execution, paid Architect enrollment, executable server previews, cross-application SSO, cloud project storage, document ingestion, new voice allowances, new Ascendance Brief generation, clinical data, new Shopify integrations, CRM, Alliance, Ascendance and Enterprise. Existing Command already projects authorized saved goals/actions/continuity and existing confirmed memory supports inspection/correction/deletion; no invented data or duplicate profile was added. Prioritize those existing mechanisms for the Brief and Living Profile rather than another context database.

## Official research and boundaries

- Installed Next.js 16.3.5 App Router layouts/pages guide read before route changes. Separate Vercel projects/deployments retained; origins are verified configuration, not assumed DNS.
- Existing Stripe adapter/policy and migration audit: authenticated idempotent webhook reconciliation remains authority. Reference https://docs.stripe.com/webhooks and https://docs.stripe.com/billing/subscriptions/webhooks (live provider acceptance not performed).
- Shopify official Storefront client README inspected from Shopify/shopify-api-js main on 2026-10-10. Current storefront adapters remain preferable to another commerce system. Reference https://shopify.dev/docs/api/storefront . No new merchant acceptance performed.
- Twenty official main LICENSE fetched on 2026-10-10: mostly AGPLv3 with separate Enterprise terms and listed MIT packages. Commercial embedding, modified hosted distribution and paid feature rights need specific legal review; open source is not blanket proprietary resale permission. Source https://github.com/twentyhq/twenty/blob/main/LICENSE . Pin a reviewed version before any adoption.
- HighLevel API/embedding/resale terms, costs and multi-tenant suitability remain unverified; not selected as proprietary Aethelios backend. No CRM installed.
- Phase One researched Supabase RLS/OAuth server/health compliance, OpenAI Agents handoff filtering and HL7 FHIR boundaries remain applicable. OAuth/SSO is future; FHIR is an exchange standard, not consent or regulatory approval. Health clinical infrastructure requires agreements, least privilege, audit, retention/deletion, incident response and separate providers/boundaries before PHI.

### Historical commercial mapping

| Historical record | Phase Two treatment |
|---|---|
| free | Public commercial label Access; stable stored identifier retained |
| Essential $19.99 | Same approved launch price; existing subscription and entitlements retained |
| Signature $49.99 | Same approved launch price; existing subscription and entitlements retained |
| Reserve $74.99 | Historical offer only; retain price matching and paid access, no automatic Architect upgrade |
| aurelius / health | Historical identifiers and access remain valid; not new launch membership names |
| Architect $129 | New staged catalog/contract; not accepted by existing checkout/schema and no paid agent grant |

## Review receipts

Member draft PR: https://github.com/neilaureliuscollective/gent-ascend-collective-app/pull/82, stacked on Phase One PR #81's `feat/human-ascendance-foundation`. Implementation commit `598f424`. Corporate draft PR: https://github.com/neilaureliuscollective/aethelios-human-ascendance/pull/1, stacked on `feat/corporate-headquarters`. Review Phase One dependencies before retargeting/merging. No merge or production promotion authorized.

At publication, member GitHub application/database checks and Vercel preview were pending. Prior failures remain documented; pending is not pass. Corporate account billing/spending rejection recurred before any step in run 38034950383. Environment startup guidance was appended to the reusable onboarding draft; saving the draft does not apply or publish a cloud snapshot.
