# Commerce Spine V1 — implementation and activation

The existing Next.js app owns `/shop` and product presentation. Shopify owns live merchandise, cart, checkout and orders. Supabase identity, membership and Aethelios are unchanged. Public preview records in `src/domains/catalog/preview.ts` remain explicitly non-purchasable. No order or membership tables were added.

## Activate a test store

1. Install Shopify Headless channel and create the Gent Ascend storefront. Create a private Storefront API token with product listing and metafield read scopes. Publish test products and their collections to the Headless channel and relevant market.
2. Configure `SHOPIFY_STORE_DOMAIN` (`*.myshopify.com`) and server-only `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` in the relevant Vercel environment, then rebuild. If the returned checkout URL uses a separate domain, set the exact `SHOPIFY_CHECKOUT_HOST`. Never use an Admin API token here.
3. Use supported Storefront API version `2026-07`. The collection initially displays the 60 newest products with lightweight card data; product detail fetches up to 50 variants and 6 images. Add cursor pagination before the sellable assortment exceeds 60. Assign the collection handles `grooming`, `performance`, `recovery`, or `daily-ritual` for a corresponding world. Other products still appear in the main collection. Product metadata can use the storefront-readable `gent_ascend` metafields `purpose`, `ingredients`, `directions`, `ritual` (plain text). Ingredient and health copy requires approval before publication. Product imagery must use the allowed Shopify CDN hostname.
4. Configure real Shopify shipping, taxes, payments and test orders in Shopify. The app uses Shopify `checkoutUrl`; it does not collect card data or confirm payment. Confirm the checkout domain and test the actual order status/return path before going live.

Without credentials, the shop renders the existing honest previews. A configured store with no published products also shows previews. Subscription-only products are excluded from V1 until the Headless selling-plan path is verified in the merchant setup.

## Boundaries and failure behavior

- A private Storefront token is used by server code only. Cart requests are same-origin, validated and no-store. The full cart ID, including its Shopify secret key, is kept in an HTTP-only same-site cookie. The browser never supplies price or cart ID. A missing/expired cart is replaced only on explicit add.
- Guest and Supabase-authenticated members follow the same Shopify guest commerce path in V1. No automatic Shopify customer linking, member discount, verified order history or AI memory is claimed. A later Customer Account API integration requires a separate identity and privacy design.
- Shopify's cart price/availability and checkout are authoritative. Product listing cache revalidates every five minutes, so a price or stock change may appear there later than at checkout. Shopify cart warnings are shown; checkout re-fetches the cart. Shopify can reject stale purchases.
- The checkout route only redirects to HTTPS on the configured Shopify store, `checkout.shopify.com`, or explicitly configured checkout host. It does not manufacture a success receipt after return.
- The existing service worker caches neither commerce pages nor API responses. Cart has no offline mutation queue. No new Supabase migration, webhook or service-role access is introduced.

## Release gates

Run `npm run check`, `npm run db:ledger`, the public browser suite and the commerce mock-contract tests. Then, with a Shopify test store and credentials: verify a published product/variant, unavailable variant, edited price, cart add/update/remove, refresh persistence, expired/completed cart, real checkout contents and order confirmation. Repeat as visitor and signed-in Gent Ascend member. Test folded/unfolded Samsung Fold, Android, iPhone, tablet and desktop, keyboard/focus, large text and reduced motion. Recheck Arrival, account, Command, Aethelios, PWA and Reserve. Physical devices and live merchant checkout cannot be claimed from local unit/browser fixtures.

## Research basis (2026-09-27)

- Shopify Storefront API `2026-07` stable version and version policy: https://shopify.dev/docs/api/usage/versioning
- Headless channel and credentials: https://shopify.dev/docs/storefronts/headless/bring-your-own-stack
- Cart ID key, buyer-IP header and checkoutUrl: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage
- Cart expiry/completion: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart
- Products, metafields, pickup and selling plans: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections
- Customer Account API and external SSO limitations: https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api and https://shopify.dev/docs/api/customer-authentication/single-sign-on
- Next server rendering and cache: https://nextjs.org/docs/app/getting-started/server-and-client-components and https://nextjs.org/docs/app/api-reference/functions/fetch
