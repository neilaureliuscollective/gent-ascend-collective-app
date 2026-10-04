# Member Product Intelligence — Cabinet recovery increment

October 4, 2026. Founder authorized continuing the researched product integration build.

## Inspected base and sequencing

Base main: `6362fc5e0c65b532444a3a1ee4564c205e12df0b`. A fresh fetch still contains the public Shopify commerce spine, without the approved member-product Phase 1 implementation. No matching member-product source branch or PR was located. The saved Phase 1 plan is an approved specification, not evidence of delivery. An unpublished Work session may still have that implementation; reconcile this additive increment with it when available rather than replacing it.

Proceed with the useful prerequisite for the planned Purchase-to-Ritual Continuity phase: a private synced Cabinet extending `grooming_products`. This is an implemented recovery increment, not completion of the full Phase 1 or Phase 2 plan.

## Delivered behavior

- `/app/collection/cabinet` provides account-owned Cabinet history and a small live product shelf using the existing Shopify catalog and product pages.
- My World and Grooming link directly to the Cabinet. The stable four-item main navigation is retained.
- Saving a live product resolves its ID/title on the server. One owner/product record is enforced by Shopify product GID; repeat saves preserve use state and notes. Existing Vault records remain visible and are not silently imported or rewritten.
- Member-reported states: saved, owned, in use, running low, finished, tried, favorite and stopped. Notes and an optional owner-bound grooming ritual belong to the same existing product record. Products from elsewhere remain supported.
- Cabinet reads are bounded to 20 records per page. Private records are never stored in localStorage or service-worker caches. Public browser saves retain their existing explicit browser-only meaning; no automatic account import.
- Session-bound writes, column grants, RLS, compound ritual ownership and version checks prevent cross-person edits and stale overwrites. Catalog IDs and ownership are immutable after insertion. A stable external-product submission ID plus owner/payload confirmation makes a retried insertion safe.
- Controlled editor fields retain draft values on failure. No product insertion, order, subscription, price change or external message occurs on page view.

## Boundaries

All use/ownership state is self-reported. There are no verified purchase badges, identity-link claims, discounts, replenishment dates or AI recommendations. Saving is not buying or reserving stock. Public retail/cart/checkout behavior remains unchanged.

The Collection displays up to 12 live entries with a link to the complete existing showroom; it is not a second storefront or a complete member merchandising release. Historical handles can become stale; stable GIDs are stored for later direct ID resolution. Full catalog discovery, reviewed browser-save import and account saves directly from public product pages remain later work.

No hosted schema migration, merchant configuration, main merge or production promotion is included. Apply the additive migration before enabling this route for members. Missing schema returns an honest unavailable state. Do not equate a working disconnected shell or SQL emulation with synced live account acceptance.

## Research and architecture

Existing repository architecture/constitution/harness/roadmap and Next.js 16.3.5 installed mutating-data guide were reviewed before implementation. Normal requests use the existing `authorizedPerson` boundary and the user's Supabase session. No service credentials or new packages.

Supabase's current RLS guide explains independent role grants and ownership policies: https://supabase.com/docs/guides/database/postgres/row-level-security (reviewed October 4, 2026). Narrow update columns and owner checks accompany the additive migration. Existing applied migration files are unchanged.

For subsequent purchase continuity, Shopify Customer Account orders require `customer_read_orders` and protected-customer-data requirements: https://shopify.dev/docs/api/customer/latest/objects/order. Verify the pinned schema at implementation; do not treat a retrieved latest reference as a pinned integration test.

Webhook ordering and reconciliation: https://shopify.dev/docs/apps/build/webhooks. Signature/duplicate handling: https://shopify.dev/docs/apps/build/webhooks/verify-deliveries. Extend a verified Phase 1 identity/inbox if available; avoid duplicate ingestion pipelines. Historical prices, delivery status and confirmed use must remain separate.

## Verification

Local canonical check: lint, strict typecheck, 269 unit/SQL tests and production build pass. Migration ledger and whitespace checks pass. Cabinet tests exercise anonymous mutation denial, server-resolved IDs, preservation of legacy records, conflict-safe saves, exact external replay confirmation, owner/version mutation filters and inaccessible ritual denial.

PGlite executes the full migration set and tests actual SQL policies/grants: cross-owner reads/updates/deletes, protected identity/version fields, unique catalog saves, invalid purchase-state claims, stale versions, anonymous access and cross-owner ritual links. PGlite is not GoTrue/PostgREST.

Four browser checks are added for failed-draft retention at 360/768/1440 widths and signed-out routing/world access. Local browser execution is blocked because Chromium download returned truncated archives. Real Auth/PostgREST is blocked by absent Docker and local `.env.development.local`. Hosted account sync, live Shopify behavior, screenshot inspection and physical Fold/DeX remain open. No live acceptance is claimed.

## Next build order

1. Reconcile any unpublished member Phase 1 source with this canonical existing-ledger extension.
2. Complete verified Shopify account linking and centralized commerce entitlement/enforced quote parity.
3. Integrate member Cassius and reviewed product actions through the existing Council and conversation system.
4. Add verified purchase history; member-confirmed receipt/use; current-price reorder review; opt-in in-app replenishment check-ins.
5. Add trusted concierge operations and operational benefits after provider and fulfillment proof.

Build permission persists; production promotion requires its separate release authorization and the recorded acceptance gates.
