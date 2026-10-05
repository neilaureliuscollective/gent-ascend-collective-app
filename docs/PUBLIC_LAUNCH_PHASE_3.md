# Public launch Phase 3 — revenue verification

October 4, 2026. Recovered Phase 2 commit `127f4b4` on Phase 1 PR #52. The interrupted session had committed the connected-day build but had not published its branch or completed hosted acceptance. Preserve those changes and open separate stacked review candidates; do not deploy before the consolidated build sequence finishes.

## Research and plan

The existing Stripe adapter already supports owner-bound idempotent checkout, audited terms, a service-only serialized webhook projection, account refresh, renewal cancellation, a recovery portal, refund/dispute holds and duplicate/out-of-order events. Shopify retains actual catalog/cart/checkout and private recent orders. Existing tags/metafields keep paid preorders unavailable; no verified selling-plan/fulfillment path or provider acceptance receipt exists. Reuse this architecture.

Official references checked October 4: https://docs.stripe.com/billing/subscriptions/webhooks and https://docs.stripe.com/api/invoices/object support provider-backed entitlement reconciliation and subscription invoice association. https://shopify.dev/docs/api/storefront/2026-10/objects/SellingPlan and https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/subscriptions describe purchase options and selling-plan-aware carts. Those docs establish API contracts, not this merchant's readiness. Installed Stripe23 types and Next16 route-handler guidance were also inspected.

Build plan: strengthen invoice association; provide explicit founder-only provider readiness checks; preserve independently managed grants, prices, cancellation and Shopify authority; test denied access, uncertainty and retries; save recovered work before release work continues.

## Built

Paid entitlement projection now checks the subscription's customer against the trusted billing mapping and the subscription mode against configured deployment mode. A newly paid invoice must additionally match that customer, subscription and mode, plus the existing configured price/cadence and unexpired period checks. An unpaid upgrade may retain only previously verified unexpired access. This never expands an independent founder or beta grant.

The membership screen includes a founder-only Revenue readiness disclosure and explicit check. Server-side founder authority is reverified for each same-origin POST to `/api/billing/readiness`; client visibility grants no authority. The check reads prices, safe management/recovery portals and up to100 webhook registrations. It requires a matching origin/path/mode, enabled status and coverage of application events. Provider errors, missing endpoints and capped lists remain unknown. Prices, keys, customers, raw provider errors and other personal data are omitted. Responses are private/no-store; no automatic request during page rendering, shared cache, charges, customer creation, record writes or launch-flag changes.

Configuration verification is separate from actual payments. The report always retains unknown subscription lifecycle and merchant acceptance, and blocked paid preorders. It does not certify the webhook signing secret, delivery, database processing, tax correctness or fulfillment. Recovery portal validation is shared with the existing cancellation path.

Existing three-tier prices and access definitions are preserved; public offer consolidation requires a founder decision. No new offer, discount, allowance, launch date, fulfillment promise, migration or dependency is introduced. Shopify member economics and selling-plan commerce remain later verified merchant work.

## Verification

Local lint, strict TypeScript, all316 unit/SQL/provider-contract tests, 28-file recorded migration ledger and production webpack build pass on recovered Phase2 plus this revenue implementation. Dependency tree is exactly lockfile-matched and linked from the prior checkout; standalone clean install and normal Turbopack build remain CI checks.

New contract tests cover customer/subscription/mode invoice mismatch, denied founder access, cross-origin requests, unknown provider responses, disabled enrollment, no side effects and credential redaction. Added browser acceptance for explicit readiness, failed check/retry, unknown lifecycle and narrow-screen layout. Browser installation returned truncated archives in this runner; local browser and real Supabase acceptance remain unrun. Existing CI performs clean installation, full browser tests and actual local Supabase Auth/PostgREST/founder journeys. Fixture/provider-contract tests are not real Stripe or Shopify acceptance.

## Remaining acceptance and next phase

Phase3 code is reviewable; revenue activation remains open. On a dedicated test environment: prove checkout→verified webhook→account activation; duplicate/reordered delivery; renewal and failure; period-end cancellation and expiry; refund/dispute review; account isolation; receipt and support reconciliation. Merchant acceptance must separately verify ready-product totals and checkout; paid preorder activation requires supported purchase options, selling-plan-aware cart flow, charge timing, shipment terms and supplier readiness. Never infer payment from a return URL.

Phase1 hosted signup and Phase2 live model/research/device checks remain open. Phase4 is the last consolidated build package: release readiness, measured phone/in-app-browser performance, support/data controls, monitoring and rollback. A phase count does not close acceptance gates. No production release is claimed. Roll back this UI/provider change without deleting member records or altering merchant configuration.

## Publication receipt

Revenue implementation commit: `bdce103942cc55b0d066dc1f7631edbabb2ada76`. Authenticated repository metadata confirms the canonical repository is owned by the connected `neilaureliuscollective` account with admin/push permission and is public. Automatic approval review nevertheless rejected the push because the current instruction did not explicitly authorize public code publication. No connector write or alternate upload route was used to bypass the rejection. Remote review branches and CI remain pending explicit public-publication authorization. All completed source and validation remain in this local checkout; an incremental Git recovery bundle contains Phase2 and Phase3 on the known Phase1 head.
