# Aethelios Lifestyle — Phase One founder review

Date: 2026-10-10. Parent: AETHELIOS. Philosophy: THE HUMAN ASCENDANCE. Division: AETHELIOS LIFESTYLE. Flagship consumer brand: LEGACY RESERVE. The flagship advanced hair and beard oil identity is LEGACY RESERVE VIRELIS. Historical Vitalis preview records are not live inventory, and are excluded from this storefront. No Shopify record is renamed or fabricated.

## Founder summary and purchase status

Implemented a reviewable commerce restoration inside Public Aethelios, reusing its existing Shopify adapter, product photography, product-story modules, search, variants, cart drawer and checkout handoff. The current branch previously retired its collection/product routes and returned 410 from the cart API. This brief explicitly supersedes that retirement for Lifestyle commerce.

**Customers cannot yet be confirmed able to purchase through this build.** The founder supplied `1yjOnr-ym.myshopify.com` (normalized `1yjonr-ym.myshopify.com`). The execution environment has no Storefront token or Shopify connection. The catalog, publication status, real images, prices, inventory, vendors, suppliers, fulfillment, selling plans and merchant payment/shipping settings remain unverified. No live cart or checkout acceptance is claimed. No charge, order, discount, inventory change, deployment or production merge was performed.

## Audited capabilities and reuse

Public repository: `neilaureliuscollective/gent-ascend-collective-app`, base `bc0e561`. Existing commerce domain includes Shopify Storefront reads and cart mutations; launch-policy guards; cursor pagination; approved editorial metafields; Shopify CDN photography and optional separately approved 3D; product ingredient/direction chapters; related products; search and saved selections; account-bound Cabinet; independent Customer Account OAuth/PKCE and recent orders; secure cart cookies; Stripe membership infrastructure. Product and collection routes and the cart API had been retired in the company-platform phase; components remained reusable. `/checkout` still existed but redirected failures into the retired public shop.

Corporate repository: `neilaureliuscollective/aethelios-human-ascendance`, default `feat/corporate-headquarters`. Existing Lifestyle division introduction reused; a small verified-origin entry links to the member Lifestyle route. No duplicate shopping application.

Reference repository: `neilaureliuscollective/reserve-at-sanctum-app` inspected read-only through GitHub. Its `lib/shopify/config.ts` and `storefront.ts` implement a separate Storefront bridge, exact checkout hosts, collection pagination and one-line checkout; historical product/concept assets and Vitalis planning exist. No changes, asset copying, database migration or deployment there. No third-repository content rights are assumed.

## Implemented journey

- `/app/lifestyle`: Imperial Obsidian landing, expandable brand registry, flagship brand introduction, verified assortment preview and honest disconnected/empty/error states.
- `/app/lifestyle/legacy-reserve`: independently identifiable brand destination with real catalog discovery.
- `/app/collection`: current Shopify collection, search, category filters, availability and existing saved selection.
- `/app/collection/[handle]`: reusable photography-led detail, verified descriptions/metafields, gallery, selected variant, public price, Shopify compare-at price, explicit backorder status, ingredients/directions where present, related editorial products, delivery/returns disclosures and purchase controls. Product detail uses no-store reads; variant connections paginate rather than silently truncating at 50.
- `/app/collection/cart`: server-returned costs, quantity changes, removal, empty/loading/failure states and checkout continuation. Cart drawer reused across Lifestyle/Collection.
- `/api/commerce/cart`: restored same-origin validated Shopify mutations; stale cart replaced only by explicit add; private no-store responses; catalog-assortment and launch guards; Shopify cart ID and checkout URL excluded from browser JSON.
- `/checkout`: re-fetches current cart, validates assortment/release state, rejects empty/stale carts, verifies exact HTTPS destination with no credentials or custom ports, hands off to the Shopify-provided URL. Failure returns to the member cart.
- Historical `/shop`, product and cart links redirect into the member experience. Sharing retains valid links through these redirects.

The existing workspace identity and functional membership/AI systems remain intact. Lifestyle alone uses #07130F, #10241C, #17382B, #386049, #C4912F, #E8C980, #DCE9D6 and #AEC2AD. No reviews, certifications, urgency or scientific performance claims were invented. No fixture product appears in application catalogs.

## Merchant activation requirements

1. Confirm the supplied shop and configure the Shopify Headless sales channel/storefront. Ordinary catalog/cart calls require no Admin API token. This Next.js server uses a private Storefront token in `Shopify-Storefront-Private-Token`; public and tokenless access are other supported Shopify models but do not replace this existing metafield-dependent server adapter.
2. Set server-only `SHOPIFY_STORE_DOMAIN=1yjonr-ym.myshopify.com` and `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`. Grant the appropriate Storefront product listing/cart access and expose approved product metafields for storefront reads. Never set a private or Admin token in NEXT_PUBLIC variables.
3. Publish approved Legacy Reserve/supplier assortment to this Headless channel and relevant market. Set `SHOPIFY_LEGACY_RESERVE_COLLECTION` to its verified collection handle (default `legacy-reserve`). Collection membership is the commercial scope, not fuzzy title matching or assumed supplier ownership. A missing/unpublished collection renders empty. Only one-time-purchase products are included initially; subscription-only products are not offered.
4. Verify the returned checkout host; configure exact `SHOPIFY_CHECKOUT_HOST` only if needed. Review shipping profiles, fulfillment supplier obligations, return policies, taxes, payment setup and market eligibility in Shopify. Storefront vendor is not proof of actual supplier or fulfillment capacity; merchant review must resolve those details.
5. Permit the exact store domain and Shopify CDN in the managed environment network configuration if live tests are required. The current environment's network rules do not include the store. Storefront credential and network configuration must use the secure configuration workflow, not chat or committed source.
6. Set the corporate `AETHELIOS_APP_ORIGIN` to the verified HTTPS Public Aethelios origin. Missing origin yields an honest pending-link message, never a guessed URL.

## Research and supported architecture

Official sources reviewed 2026-10-10:

- Version policy and latest stable `2026-10`: https://shopify.dev/docs/api/usage/versioning . Requests pin this version; quarterly contract review is required.
- BYO stack, Headless publication and token models: https://shopify.dev/docs/storefronts/headless/bring-your-own-stack and https://shopify.dev/docs/api/storefront/latest . Keep Next.js; no Hydrogen rewrite or ordinary-read Admin dependency.
- Product/variant/media/prices/availability/vendor/metafields: https://shopify.dev/docs/api/storefront/latest/objects/Product and https://shopify.dev/docs/api/storefront/latest/objects/ProductVariant . Read public prices, compareAtPrice, availableForSale and currentlyNotInStock; do not infer stock counts, ingredients or vendor ownership. Existing storefront-readable `gent_ascend` metafields remain compatible: purpose, ingredients, directions, ritual, product_story and launch fields.
- Cart ID secret, creation, lines, warnings, totals and checkoutUrl: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage . Retain full ID only server-side. Cart totals are estimates; Shopify confirms discounts, tax, shipping and final totals. No custom card collection.
- Customer accounts: https://shopify.dev/docs/api/customer/latest and https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started . Supabase Auth is independent. Guest purchasing is least disruptive; the existing explicit account-connection flow stays gated until merchant OAuth/client/key configuration is accepted. No silent email matching, complete-SSO claim or wholesale customer copy.
- Selling plans: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/subscriptions . Later phase must audit allocation IDs, price adjustments, sellingPlanId on cart lines, merchant subscription app, consent/cancellation and fulfillment. Stripe remains software-membership billing only.
- Discounts/Functions: https://shopify.dev/docs/api/functions/latest/discount . Enforce future offers in Shopify, not displayed-price arithmetic. Function/app availability depends on merchant plan and distribution; verify before selection.
- Webhooks: https://shopify.dev/docs/apps/build/webhooks . Phase One needs no order database or webhook. Public catalog uses a five-minute cache; product detail/cart/checkout are no-store. Later authenticated product-change webhook revalidation requires HMAC verification, replay/idempotency guards and merchant app setup. Do not provision Admin access just for these reads.
- Premium PDP usability: https://baymard.com/research-articles/collections/product-page and https://baymard.com/research/mcommerce-usability . Prioritize clear options, photography, shipping/returns close to purchase, readable mobile details and genuine stock status; cinematic styling must not obscure purchasing. Existing gallery, sticky mobile purchase controls and product chapters are reused.
- Installed Next.js 16.3.5 docs: async params/cookies, route handlers, server/client boundaries and fetch cache behavior. No dependency upgrades.

## Membership benefit foundation — proposal only

Planned memberships: Access free, Essential $19.99/month, Signature $49.99/month, Architect $129/month; Ascendance/Enterprise future. Do not modify current Stripe billing to enact this plan. Phase One exposes ordinary Shopify public pricing; `memberCommerceBenefit()` explicitly reports no active discount.

Commercially sustainable proposal: keep Access/Essential public pricing, make education and preference tools useful, consider the same eligible seasonal offer across paid tiers rather than four permanent discounts, and evaluate Signature/Architect early-access or limited bundles only after contribution margin, supplier exclusions, shipping cost, returns and discount stacking are known. These are founder-review ideas, not promised launch benefits or lifetime commitments.

Future enforcement: resolve membership from the existing server-authenticated entitlement boundary; validate active subscription/expiry independently of role/founder status; obtain consent and a verified Shopify identity link. A controlled app can mirror only minimal validated entitlement into a Shopify customer metafield for an eligible Discount Function, or use an approved customer-bound limited-use Shopify offer. A client-supplied tier, cart attribute or arbitrary code is never authority. Apply the supported mechanism to the cart; display only Shopify-confirmed discount allocations, original public price and eligible benefit; revalidate at checkout and handle revocation/cancellation. No live discounts or codes were created.

## Intelligence readiness and identity

Typed Storefront product/variant data, explicit assortment lookup and approved product-story fields form the verified catalog interface. Future read-only tools should return product GID, handle, URL, fetchedAt, source, supported currency, current price and availability; ingredient/direction facts must include the verified metafield source. Current-price answers must use fresh lookup, not cached conversational text. Recommendations cannot override availability, launch state or eligible assortment.

A future cart-preparation tool requires an explicit member request, validated real variant/quantity, current Shopify response and same browser cart boundary. No model-generated ingredient list, price, inventory or automatic order. No catalog/customer/order data was added to AI memory in this phase. The current Aethelios AI was not changed; Concierge is not required for checkout.

The existing Shopify customer-account flow is consent-based OAuth/PKCE with separate merchant credentials and encrypted browser session. It does not establish durable cross-device identity or authorize membership benefits automatically. Keep guest browsing/purchasing; communicate any separate Shopify sign-in plainly. No new Supabase tables, migrations or service-role commerce access.

## Next commercial phase and release gates

First activate and audit the real merchant collection, photography, prices/compare-at values, variants, availability, suppliers, fulfillment and policies. Verify Virelis publication before offering it. Then verify actual published product → variant → add → quantity/remove → refresh persistence → stale/error recovery → Shopify checkout contents as guest and signed-in member, stopping before order placement. Merchant test-mode acceptance and founder review precede release.

Next prioritize product photography/editorial metafield completeness and merchant acceptance; later evaluate bundles/replenishment/selling plans, consent-based durable identity, trusted member offers, read-only Concierge, favorites/history control and additional brands. Keep Shopify as catalog/order/inventory/fulfillment authority. Do not build a second commerce backend.

Validation outcomes and remaining runner limits are recorded in LIFESTYLE_VALIDATION.md. No production deployment or merge is authorized by this report.
