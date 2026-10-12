# Lifestyle published-catalog correction — October 12, 2026

Canonical base: c13bced429ef4a8aeb22b9d7205dba19618b67d7. Founder asked to inspect missing actual Shopify products and execute the fix after authorizing the Lifestyle production release.

## Confirmed defect

Production `/shop` returned 200 with no published products. The adapter queried only `collection(handle: "legacy-reserve")` whenever SHOPIFY_LEGACY_RESERVE_COLLECTION was unset. Current Vercel metadata has Storefront token/domain variables but neither a brand collection nor global assortment variable. Missing collection responses were collapsed into empty product arrays. Product-detail and cart guards independently required membership in the same assumed brand collection. These are code defects: a working Headless product catalog could be hidden by a collection name never configured by the merchant. Previous preview HTTP 403 is a separate environment/access observation, not proof that current production credentials are invalid.

## Fix

General Lifestyle, `/shop` and member Collection now use the existing paginated `products` Storefront query by default. Shopify limits this to the configured Headless sales channel and applicable market catalog. No Admin API, draft access, supplier guess, product rename, catalog publication or new database is involved. Existing one-time-purchase support, real Shopify data, launch guards and availability checks remain.

Optional server-only SHOPIFY_LIFESTYLE_COLLECTION restricts the entire Lifestyle assortment when explicitly set. Missing/unpublished explicit collections fail closed and never fall back to all products. Product-page, related-product, variant-add and checkout/cart guards use this same explicit scope.

SHOPIFY_LEGACY_RESERVE_COLLECTION remains specific to the Legacy Reserve brand destination (default brand handle `legacy-reserve`). A missing brand collection renders empty rather than falsely relabeling the whole store. An explicit global restriction also intersects that brand catalog. Missing configured collections now have a distinct typed error instead of masquerading as zero products. The read-only acceptance script follows the corrected whole-catalog/explicit-scope contract.

## Official research

Reviewed October 12, 2026:
- Shopify Storefront `products` and market/publication context: https://shopify.dev/docs/api/storefront/2026-10/queries/products ; https://shopify.dev/docs/api/storefront/latest/queries/product . Products not published to the relevant channel/market are omitted without needing another app filter.
- Collection lookup: https://shopify.dev/docs/api/storefront/latest/queries/collection ; https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/filter-products . A collection handle is an explicit merchant-created grouping, not a substitute for the whole store's product catalog.
- Server private access and buyer-IP guidance: https://shopify.dev/docs/api/storefront/2026-10 . Keep the existing server-only token header and current supported stable version. Never print or copy token values into public/client code.

## Verification and limits

Service regression tests cover default published catalog, explicit restriction failure without broadening, empty versus provider failure, absent brand isolation, closed configuration and cart scope. Existing direct-variant denial test now explicitly configures the restriction it asserts. No launch or quantity/ownership guard is weakened. Local lint/types/unit results, exact-head CI, Vercel preview and any production/live-product receipt are recorded in the review PR. Fixture tests are not evidence of actual published products or paid transactions. No merchant setting changes or payment actions are part of this fix.

This document supersedes the prior Phase One assumption that a brand collection must define all Lifestyle commerce. If the corrected global catalog is still empty, merchant acceptance must verify Headless publication, Markets and supported selling plans. Do not claim a product exists or is purchasable from its name in the brief.
