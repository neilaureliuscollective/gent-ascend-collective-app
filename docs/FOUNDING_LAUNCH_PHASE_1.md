# Founding launch commerce — phase 1

Founder authorization: 2026-10-02. Canonical repo, additive branch from main 1db7da7.

## Five-phase delivery plan

1. **Offer and release foundation (this build).** Canonical USD monthly prices $19.99 / $49.99 / $74.99; readable founding comparison at /membership; editorial launch gallery at /launch combining live Shopify catalog and clearly labeled concept studies. Distinguish current invitation-access foundation, planned tier additions, one-time product ritual and unopened enrollment. Add launch-state metadata and server cart/checkout safeguards. No invented future standard prices, rate duration, bundle qualification, discounts or provider quotas.
2. **Paid membership lifecycle.** Extend existing membership schema additively with essential/signature/reserve, keeping historical tiers and beta/founder grants compatible. Map verified server-held price IDs, not submitted amounts. Stripe Checkout + portal, signature-verified idempotent webhook receipts, reconcile current provider state for reordered events, owner-readable trusted billing snapshots. Enforce server capabilities and usage budgets after cost testing. Separate founder recognition from privileged founder_access. Confirm launch terms before live charges.
3. **Member Shopify offers.** Link verified Gent identity to the correct Shopify customer through a documented identity flow; do not equate a browser-submitted email with customer authority. Sync paid eligibility securely, revoke on expiration, pre-create eligible customer records before their first purchase, apply restricted selected-product discounts, disable unwanted stacking. Display Shopify's actual applicable discount, not a calculated marketing-only amount. Cost 5/10/15% proposals SKU by SKU; percentages are not approved published terms.
4. **Paid preorders and supplier hold.** Select a preorder app with demonstrated Custom Storefront support; query actual selling-plan allocations and submit variant + sellingPlanId. Prefer full payment for the founder's cash-flow goal. Store approved estimated shipment/cancellation terms; verify preorder payment capture and supplier holds with each supplier. Confirm funds in bank before releasing fulfillment. Never use a failed supplier payment as the hold mechanism. Keep mixed supplier/ready/preorder shipments explicit. Cap launch quantities by supplier stock/capacity and reserve landed costs/refunds.
5. **Fulfillment and release operations.** Owner-bound order status, verified Shopify webhooks, supplier release workflow, shipment/tracking, delay consent/refunds, once-only earned founding bundles, consultation capacity, cost reconciliation and customer notifications. Prove visitor + member + renewal/downgrade/cancellation flows end to end, then review mobile devices and promote the commercial launch.

## Phase 1 architecture and actual behavior

- src/domains/billing/founding-catalog.ts is a presentation/catalog contract, not an authorization source. Each plan holds price in integer cents. Existing access policy and production identity remain intact.
- Public pages render server-side, with native details/summary controls and no new client library or decorative WebGL. Signature has a restrained green plane; all prices are visible without interacting. Responsive columns become a single reading flow on phone and Fold-sized widths.
- /launch reads the existing Shopify connection; local studies are labeled concepts and never substitute for live merchandise. Catalog failure shows an explicit notice. Existing 60-product catalog limit remains; pagination is needed before exceeding it. /shop and the footer link to the new launch gallery.
- Shopify remains authoritative for real merchandise prices. Existing image assets are used, not final-package guarantees. Future discounts, bundles and preorders have no fake purchase controls or invented countdown.
- Product launch metadata is queried on listings, details, fresh variant readiness and checkout cart reads. Preview/preorder/invalid-state products cannot use the ordinary buy-now path. Removal is allowed from held carts; add/update and checkout are blocked until held lines are removed. Product purchase UI and cart mirror that state. Actual server checks run independently of client controls.
- No Stripe checkout, supplier order, paid subscription, discount, preorder app installation, private data or production environment was changed. No database migration is required for this slice.

## Shopify merchant setup for this release

Create Storefront-readable plain-text product metafields:

- gent_ascend.launch_state: ready | preview | preorder
- gent_ascend.launch_window: display-only estimate. It is not a fulfillment deadline or permission to accept payment.

Existing ordinary merchandise without launch_state remains purchasable to preserve existing commerce. An empty/unknown value is blocked. A product marked preorder remains disabled until phase four; setting the metafield does not open preorder payment. All launch items must be explicitly reviewed and labeled before publication. Shopify's own storefront and checkout need matching merchant restrictions; these app safeguards do not govern purchases made through other sales channels or a previously copied external checkout URL.

Protective tags gent-ascend:preview and gent-ascend:preorder override a ready metafield. Verify that the existing Storefront token can read the requested tags and storefront-exposed metafields before promotion; a rejected query keeps commerce unavailable rather than bypassing launch checks. Requires-selling-plan products remain excluded by Commerce V1; selling-plan support arrives in phase four.

Never auto-release launch fulfillment based only on a Shopify paid status. Ordinary supplier integrations can debit the merchant before Shopify bank payout; manual release must be proven with real supplier settings and test orders.

## Decisions still requiring commercial definition

Founding-rate duration, future standard prices, approved SKU discount margins, AI/voice/image allowances, consultation slot capacity, bundle contents and qualification, shipping geography and dates. These are explicit enrollment blockers, not reasons to delay this foundation. The suggested three-paid-month bundle qualification is only a proposal and has not been enacted.

## Research checked 2026-10-02

- https://docs.stripe.com/billing/subscriptions/webhooks — signature checks, payment status, reconciliation and lifecycle.
- https://docs.stripe.com/billing/entitlements — separate feature access from prices.
- https://help.shopify.com/en/manual/products/purchase-options/pre-orders/setup — Custom Storefront support and preorder restrictions.
- https://shopify.dev/docs/apps/build/purchase-options/deferred/model-deferred-purchase-solutions — actual variant/selling-plan cart integration.
- https://help.shopify.com/en/manual/discounts/managing-discounts — customer eligibility.
- https://help.shopify.com/en/manual/discounts/discounts-faq — first-purchase customer-segment limitations.
- https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries/united-states/payouts — US payout timing and longer initial settlement.
- https://help.shopify.com/en/manual/payments/shopify-payments/payouts/payout-timing — additional bank processing time.
- https://help.supliful.com/en/articles/5424685-what-happens-when-an-order-comes-in — supplier charging and manual fulfillment requests.
- https://help.selfnamed.com/en/articles/10009931-shopify-dropshipping-integration-manual — fulfillment request triggers sync.
- https://help.selfnamed.com/en/articles/10034375-dropshipping-order-fulfillment-and-billing-process-explained — card charges and failed-order cancellation.
- https://www.selfnamed.com/en/pricing — free integration and optional Pro benefits.
- https://www.ftc.gov/legal-library/browse/rules/mail-internet-or-telephone-order-merchandise-rule — shipping estimates and delay/refund behavior.

## Acceptance

Record observed build/unit/browser checks in STATUS.md. Required merchant follow-up: existing credentials/scopes, two Shopify products (ordinary + preview/preorder), direct variant add denial, stale cart denial, remove-and-recover, live checkout and independent supplier hold testing. Browser fixtures and local checks do not prove those live flows.
