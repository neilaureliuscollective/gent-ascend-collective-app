# Premium commerce Phase Five — shareable product pages

Founder authorized research, planning and execution on 2026-10-02. Continues Phase Four `ac78fdd` in the canonical application. Product research, launch states, saved selections and checkout remain intact.

## Research and architecture decision

Inspection found product pages have only basic title/description metadata and no product-sharing control. The global site is intentionally no-index. Improve referral usability and prepare truthful machine-readable product information without silently opening search indexing or collecting payments for previews.

Official references inspected 2026-10-02:

- https://nextjs.org/docs/app/guides/json-ld and installed `node_modules/next/dist/docs/01-app/02-guides/json-ld.md` — render structured data in a page script and escape less-than characters to prevent script termination/injection.
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet — Product data and offers must represent real product facts. Structured data does not guarantee a rich result. Do not fabricate ratings, reviews or commercial terms.
- https://shopify.dev/docs/api/storefront/latest/objects/Product — product and variant data remain Shopify-owned; metafields enrich content.
- https://shopify.dev/docs/storefronts/themes/pricing-payments/preorder-tbyb — preorders depend on supported selling-plan configuration. This phase preserves existing ordering gates.

The design hypothesis is that useful product links and understandable share previews support referrals and later distribution. No share-to-order conversion or ranking improvement has been measured. Native sharing is invoked only by an explicit user click; this build never sends a message automatically.

## Implementation plan and result

1. Add compact Share this product and Copy product link controls to existing product pages. Use the current origin and a strict public product path; never include current query parameters, fragments, cart IDs, account state, saved selections or private context.
2. Prefer the device's native share sheet for Share; Copy always attempts clipboard. Native-share cancellation is quiet. Missing/denied clipboard or sharing exposes a readonly, select-on-focus product URL for manual copying. Pending ref/state prevents duplicate interactions. No tracking or storage persistence is added.
3. Generate Open Graph and Twitter metadata from the same visible product purpose/benefit language. Use approved Shopify media only; concept packaging is not promoted as a real product photo. Keep existing no-index/follow settings inherited. Unknown products retain existing not-found behavior.
4. Use configured `NEXT_PUBLIC_APP_URL` only for canonical metadata and JSON-LD. Accept a credential-free HTTPS origin without paths/query/fragments; absent or invalid configuration omits canonical URLs and structured data rather than inventing a domain. Native sharing still works using the origin the customer is visiting.
5. Emit Product JSON-LD for real Shopify products with escaped serialization. Valid ready-product variants contribute actual prices/currencies and stock states. Preview/preorder/unsupported items contribute no offers. Missing/unapproved imagery is omitted. No synthetic reviews, ratings, supplier claims, shipping promises, discounts or SKU identifiers. Curated concept previews have no Product schema.
6. Verify metadata, indexing preservation, safe JSON serialization, invalid URLs/handles/prices, variant stock/release states, native/copy/manual/cancel behavior, existing education/purchase flows and responsive widths. Run full checks and ledger; record evidence in STATUS.md.

## Limits and activation

No new dependency, database migration, account integration, merchant mutation, tracking service, payment activation or production promotion. Search engines may ignore or warn about incomplete product schema, including missing approved images or commercial offers. Search indexing, sitemap generation, verified canonical-domain configuration and Google validation remain deliberate release work. Metadata is not a Merchant Center integration or a ranking guarantee.

Shopify data retains existing caching and the 50-variant detail bound; final cart/checkout validation remains fresh. Social platforms may cache older share previews. Native share destinations and clipboard permissions vary by device; physical Fold/iPhone acceptance remains pending. Mocked share/clipboard handlers test application behavior, not actual delivery to a messaging service. No live supplier/preorder/payment proof is implied.
