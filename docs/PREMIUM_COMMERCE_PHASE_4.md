# Premium commerce Phase Four — reliable catalog discovery

Founder authorized research, planning and execution on 2026-10-02. Built on Phase Three `365b3b3` in the canonical Gent Ascend repository. Existing cinematic arrival, product education, cart validation and launch gates remain intact.

## Inspection and research

Source inspection found `listProducts` reads only the newest 60 Shopify products. Saved selections and approved relationships resolve against this window, so an older published product can disappear from those views as the assortment grows. The showroom also has chapter filters but no text search or ready-only shelf filter. This is a concrete correctness and discovery gap; paid preorder activation still lacks verified merchant/supplier setup in this checkout.

Official references inspected 2026-10-02:

- https://shopify.dev/docs/api/usage/pagination-graphql — Storefront connections support forward pagination using `after`, `pageInfo.hasNextPage` and `endCursor`.
- https://shopify.dev/docs/api/storefront/latest/objects/pageinfo — endCursor identifies the end of a connection page.
- https://help.shopify.com/en/manual/products/purchase-options/pre-orders/setup — configure the merchant's preorder app before setup/activation. No app, supported selling plan, real fulfillment capacity or shipment commitment was verified here.
- Installed Next.js client-boundary documentation and the React checklist — keep Shopify reads server-owned, serializable public catalog entries and small client-owned filter state.

The design hypothesis is that a complete supported assortment and simple, transparent narrowing improve the path from exploration to a purchasable product. No conversion or revenue improvement has been measured.

## Execution plan and implementation

1. Replace the single catalog page with bounded forward pagination. Preserve existing 60-item pages, the pinned Storefront 2026-07 API, public five-minute fetch revalidation and exclusion of products requiring unsupported selling plans. React request caching deduplicates catalog calls within one render request.
2. Add a domain collector with at most ten pages / 600 returned product nodes, deduplication by Shopify ID, missing/repeated/oversized cursor guards and empty advancing-page protection. A page failure or unfinished catalog at the limit fails the read rather than silently publishing a partial assortment. Existing routes disclose live collection failure and retain labeled previews. This is not unlimited catalog support or a guarantee of a transactional Shopify snapshot.
3. Add public product-language search to the existing showroom, intersected with chapter/saved filters. Search matches title, product kind, brand and approved benefit language, ignoring case and extra whitespace. Bound input to 120 characters. Do not search private history, medical details, ingredients as compatibility evidence or inferred fit.
4. Add an available-to-order checkbox using only existing server-projected `orderable`. Preview, preorder and unavailable items cannot become purchasable through filtering. Selection preservation is independent of visible matches.
5. Show a truthful no-match state, a clear-filter control and an updated result count. Keep all browse cards server-rendered without JavaScript, ordinary labeled controls, focus styles, reduced-motion compatibility and responsive green/gold materials.
6. Verify cursor traversal beyond product 60, repeated/missing cursors, page budgets/failure, deduplication, ready eligibility, search/saved behavior and phone/unfolded/desktop layouts. Run full checks, commerce browser regressions and migration ledger.

## Boundaries and next work

No new dependency, migration, payment entitlement, merchant mutation, identity access or analytics collection. Search/filter state is transient and not sent to a backend or saved. Browser-local saved handles stay unchanged. Shopify still owns variants, inventory and final prices; the server cart/checkout gates are unchanged.

The 600-node limit is an explicit operational bound. Beyond this size, implement a real server-paginated search/browse API and direct saved/related resolution rather than increasing this limit indefinitely. Catalog fetch revalidation means product cards may lag by up to the existing cache interval; final cart and checkout validation remain fresh. Product variants still retain their existing 50-item detail bound; this phase does not alter variant pagination. Real Shopify pagination and live checkout remain external acceptance gates; mocked API tests are contract verification only.

Preorder activation requires merchant app/selling-plan setup plus verified supplier, shipping, payment and cancellation terms before end-to-end tests and release. This phase does not imply paid preorders, account-synced selections, member discounts, reserved stock or release notification consent. Production promotion remains separate.

Observed results are recorded in STATUS.md.
