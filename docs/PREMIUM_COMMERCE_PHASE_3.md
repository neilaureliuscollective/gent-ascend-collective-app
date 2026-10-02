# Premium commerce Phase Three — purchase review and checkout handoff

Founder authorized research, planning and execution on 2026-10-02. Continues the recovered Phase Two commit `5954f5d` in the canonical Gent Ascend application. This is a source candidate, not a production release.

## Research and scope decision

Official sources inspected 2026-10-02:

- https://shopify.dev/docs/api/storefront/latest/objects/cart — cart costs are estimates and can change at checkout; Shopify's checkoutUrl completes the purchase. Preserve the existing server-validated `/checkout` redirect and avoid presenting a subtotal as a final charge. The application remains pinned to Storefront 2026-07; no API upgrade is required for this phase.
- https://help.shopify.com/en/manual/products/purchase-options/pre-orders/setup — genuine preorders require merchant-side preorder configuration and supported payment handling. The current application blocks selling-plan/preorder items. Source inspection found no verified merchant preorder setup or supplier shipment commitments, so opening paid preorders would be premature.
- Installed Next.js client-boundary documentation and the React review checklist informed ordinary server-rendered policy disclosure, serializable props and bounded client state.

The useful Phase Three slice is the decision-to-purchase handoff. Keep cinematic arrival, showroom, product education and selection discovery intact. Give customers delivery/payment/return information at the purchase point, clarify quantity subtotal, identify specific held cart lines, and recover the cart without stale read results overwriting mutations. These are usability hypotheses, not a measured conversion uplift.

## Implemented plan

1. Add a native expandable delivery/payment/returns disclosure beside existing product purchase controls. Reuse only the strict merchant-approved product-story fields. Missing delivery or return information is stated explicitly; no invented dispatch window or refund promise. Normal links reach existing full release details.
2. Show selected variant, quantity and item subtotal above the buy controls at every width, retaining the existing mobile purchase bar. Shipping/tax copy distinguishes item subtotal from final checkout total.
3. Identify each held cart item by its existing launch label, with a named removal control and a clear adjustment explanation. Keep quantity edits blocked while any held item exists, matching the server's existing policy. Successful removal restores checkout for the remaining items.
4. Invalidate in-flight cart reads when mutations start. Serialize mutations with an immediate ref guard. Stale responses cannot restore removed merchandise or overwrite a newer load. Checkout clicks remain blocked while a mutation or unresolved cart error is present.
5. Add clear return paths from cart review to the collection and saved collection, with subdued green/gold styling and no account wall.
6. Verify approved terms, variant quantity totals, held-cart recovery at phone/unfolded/desktop sizes, existing purchase/error and no-JavaScript flows; run lint, types, unit tests, production build and ledger.

## Boundaries and next phase

No new dependency, database migration, identity access, tracking service, payment integration or merchant configuration. Prices and variants remain Shopify-owned; final availability and checkout remain server-validated. No client input bypasses release gates. A saved selection remains browser-local and conveys no notification consent or stock reservation. Browser intercepts and synthetic products test interaction only, not live checkout or fulfillment.

Paid preorder activation remains a distinct next slice requiring genuine preorder-app/selling-plan configuration, approved supplier capacity, shipping and cancellation commitments, then live/test-shop end-to-end payment verification. Member product discounts and account-synced selections remain separate existing roadmap items. No invented launch dates, sales counters or conversion claims.

Executed verification and open gates are recorded in STATUS.md.
