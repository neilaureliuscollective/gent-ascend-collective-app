# Lifestyle Phase One — purchase confidence

Founder approved execution of the October 12 audit's first build phase. Canonical base: `c0a7f35f9de0b314703814667bce82a79133adea`. This is the existing unified application. No merchant publication, product rename, payment configuration, new database, migration or AI integration is part of this implementation.

## Implemented

- Lifestyle leads directly to the populated catalog and presents actual Shopify photography. Legacy Reserve remains a separate brand destination; an empty brand offers a real route to the general catalog rather than resetting an empty view.
- Catalog search includes bounded merchant descriptions and approved size/scent facts. Introductory excerpts remain merchant text, not generated claims. Unsupported discovery chapters are hidden; no category is inferred from names or handles. Sorting supports name and price where a single currency permits comparison. Brand filtering appears only when multiple actual attributions exist.
- Product purchasing precedes sharing. Short introductory text no longer repeats the entire merchant description above price. The full description remains inspectable. Missing structured ingredients/directions no longer claim the product's formula is unfinished. Actual merchant policies are fetched independently from Shopify and linked only through valid HTTPS URLs. Missing policies remain disclosed.
- Public product metadata uses real title, description and photography. Explicit assortment restrictions and unavailable-product no-index behavior apply to metadata too.
- Synchronous duplicate-click protection and bounded requests prevent immediate repeated additions. An uncertain add response locks another add until the customer reviews their cart. Known validation failures remain retryable. Cart-update errors require a fresh cart read before another mutation.
- Fresh cart reads include current variant availability and bounded line pagination. Checkout never proceeds on a partially read cart. Additions are bounded at 100 lines; excess existing lines remain readable/removable. Existing exact-host handoff, HttpOnly cart secret, same-origin validation and Shopify pricing stay authoritative.
- Reduced photographic decoration uses shared Obsidian tokens. The missing-media mark is brand-neutral. Existing reduced-motion, gallery/3D fallbacks, Cabinet/ritual ownership and disabled Customer Account connection remain.
- Lifestyle component tests explicitly visit the fixture server even when discovered by the broad browser config. Production navigation asserts all five destinations, including Lifestyle; no check is disabled.
- The read-only merchant acceptance script additionally reports duplicate titles and missing product type, attribution and story fields.

## Research and boundaries

Current research was completed before implementation: [Baymard product pages](https://baymard.com/research-articles/current-state-ecommerce-product-page-ux), [mobile usability](https://baymard.com/research/mcommerce-usability), [NN/G product pages](https://www.nngroup.com/articles/ecommerce-product-pages/), [Shopify 2026-10](https://shopify.dev/docs/api/storefront/2026-10), [cart](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage), [media](https://shopify.dev/docs/api/storefront/latest/interfaces/Media), [Customer Account setup](https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), and [Web Vitals](https://web.dev/articles/vitals). Installed Next metadata/JSON-LD guidance and React quality review informed the server/client boundaries. Conversion benefit is unmeasured.

The audit observed ten live entries with missing useful product types, story/discovery fields and distinct labels, plus an empty Legacy Reserve collection. Merchant descriptions are usable facts for browsing; they do not constitute independent substantiation of formulation/certification claims. The implementation does not invent a brand mapping or parse prose into formulation facts. Virelis is not established as live merchandise; historical Vitalis concepts are not Virelis or the separate Vitalis health initiative.

## Merchant acceptance still required

1. Approve canonical product names, brand versus supplier attribution and genuinely distinct size/scent labels. Resolve duplicate titles and the conditioner handle displaying a shampoo title in Shopify.
2. Populate approved `productType` and `gent_ascend` purpose, ingredients, directions, ritual and approved `product_story` fields. Curate/publish the Legacy Reserve brand collection separately from general Headless availability. No silent catalog broadening.
3. Publish real shipping/refund policies, product exceptions and support information; verify link destinations and checkout rates, taxes and Markets.
4. In an approved configured deployment, verify actual product/variant → add → update/remove → refresh persistence → checkout contents as guest and member, including changed stock/price, backorder, expiry and failure recovery. Stop before payment unless merchant test-mode orders are separately authorized.
5. Verify physical Fold cover/unfolded/orientation, Samsung Internet keyboard, iPhone Safari, tablet and desktop, plus keyboard focus, enlarged text and sticky-control clearance.
6. Measure field LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at p75; lab checks are preliminary and insufficient field traffic is not a pass. Commerce CustomEvents remain hooks, not a configured revenue analytics sink.

## Verification receipts

Fresh initial lint, strict types, 429 unit/SQL-emulation tests and the recorded 28-file migration ledger passed. New focused confidence/cart cases passed 9/9. Final expanded checks are recorded in the PR receipt.

Standard local `npm run build` is blocked by the inherited Mirror asset fetch (`storage.googleapis.com` EAI_AGAIN). Direct optimized webpack compilation is checked separately. Local Playwright cannot bind its fixture server (`listen EPERM`); this is not rendered acceptance. Hosted CI must run the unchanged standard build, focused synthetic interactions, real built closed-configuration routes and supporting regressions. Real Shopify mutations, customer identity, paid orders, physical devices and performance remain distinct gates.

Current production baseline is not fully green: 305 broad browser passes/104 failures, founder 7 passes/4 failures, and a stale production four-link assertion. This phase fixes the identified Lifestyle fixture routing and navigation assertion, not unrelated Memory/Command/entrance workflows. No release gate is suppressed. Review branch/preview publication is within approved implementation; production promotion remains a separate review after acceptance.
