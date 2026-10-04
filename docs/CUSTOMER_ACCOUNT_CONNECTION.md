# Shopify customer connection and recent orders

October 4, 2026. Canonical base: `4eaf807c9571e20c3f336ef6470c065b90d855a3`. Founder authorized research, planning and execution of the next product integration build phase after Collection-to-Ritual Continuity. Earlier live-release authorization continues after passing gates.

## Inspection and phase choice

Native Collection, Shopify cart/checkout, synced Cabinet and ritual links are live. There is no Shopify customer-account client or trusted order history. The connected Vercel project's environment metadata contains no `SHOPIFY_CUSTOMER_*` variables. No callable merchant connector is available. An app account or matching email cannot establish Shopify customer identity.

Build an explicit browser-scoped customer connection and read-only recent-order view before implementing price privileges. This closes the missing authentication path without turning saved interests into purchase evidence. This increment is deliberately not a durable, unique person-to-Shopify identity mapping or full commerce-entitlement stage.

## Plan and implementation

1. Add **Your orders** inside the existing Collection, also reachable from Cabinet. Preserve the current navigation and Shopify commerce spine; disable order-link prefetch so reads start with an explicit visit.
2. Resolve the real Gent person through the existing session/capability boundary before connection, disconnect or order reads. OAuth starts through a same-origin POST; callback checks the current owner, encrypted ten-minute state, S256 PKCE and nonce. Return only fixed app destinations; do not accept redirect, email or customer-ID authority from callers.
3. Discover Shopify authentication/API endpoints from the configured shop. Allow only HTTPS on the configured shop, Shopify's issuer host or one explicitly configured custom account host; refuse network redirects. Verify RS256/ES256 OpenID signatures with discovered keys, issuer, audience/authorized party, expiry, issued-at and nonce. Confirm customer ID through authenticated Customer Account GraphQL. Every order read checks that ID again.
4. Keep only encrypted, authenticated, Secure/HttpOnly/SameSite=Lax, host-only cookies, bound to purpose, shop/client/origin and Gent owner. Access session lasts at most one hour, no longer than the provider access token. Only a callback with valid owner-bound state consumes an attempt. Unsolicited/stale callbacks cannot erase a newer connection, and provider failures never delete account cookies. Reject tampering, oversized cookies, account changes and expired tokens. No refresh token is retained, no automatic reconnection or long-lived server identity claim. Disconnect removes this browser's connection; it does not log out of Shopify itself or revoke Shopify's own login.
5. Read at most ten recent orders, sorted by processed date. Display order name, UTC date, amount/currency, cancellation, payment and fulfillment separately. No shipping address, phone, line items, email query, checkout action, order mutation, Cabinet import or AI ingestion. Errors remain distinct from an empty history. No discount, delivery or paid-member authority is inferred.
6. Validate signed-token failure cases and routes, responsive views, no automatic writes, actual hosted denial and real Gent Auth closed-configuration acceptance. Existing full gates remain required. Provider fixtures are not merchant login proof.

## Activation prerequisites

This build ships **disabled** until the following are configured and proved. Do not invent credentials or turn on the readiness flag from an unrelated token.

- Enable Shopify's new customer accounts and configure a **public Headless Customer Account client with PKCE**, the API permissions for customer/profile and order reads, and applicable protected customer data access. This is not an Admin or Storefront token and not a confidential-client flow.
- Add exact HTTPS callback `https://www.gentascend.com/api/commerce/customer/callback` to that client's allowed callbacks, plus the corresponding canonical origin/JavaScript-origin settings. Use separate approved preview configuration for staging; do not share a production callback with arbitrary previews.
- Set server configuration: `SHOPIFY_CUSTOMER_CLIENT_ID`, independent cryptographically random 32-byte `SHOPIFY_CUSTOMER_SESSION_KEY` as 64 hex characters, existing `SHOPIFY_STORE_DOMAIN` and exact `NEXT_PUBLIC_APP_URL`. Optionally set `SHOPIFY_CUSTOMER_ACCOUNT_HOST` only when discovery returns the verified store's custom account hostname. The key stays server-only; rotation invalidates sessions.
- Then set `SHOPIFY_CUSTOMER_ACCOUNT_ENABLED=true` and run actual merchant acceptance: explicit login, correct account display, populated/empty history, expired/revoked token, account change, cancellation/refund, disconnect, second-device reconnect and mobile app redirect return. No real purchase is needed just to validate existing orders. Do not claim acceptance from mocked provider responses.

## Official research

Reviewed October 4, 2026:

- Shopify Customer Account authentication, endpoint discovery, public/confidential clients, required scope and token header: https://shopify.dev/docs/api/customer/latest . Latest discovery includes a supported version; use its URL directly. Headless-client refresh tokens are optional, while app-client flows may not receive one; this phase uses neither.
- Merchant setup/new customer accounts, callbacks and HTTPS requirements: https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/getting-started .
- Order/customer fields and sorting: https://shopify.dev/docs/api/customer/latest/objects/order , https://shopify.dev/docs/api/customer/latest/objects/customer , https://shopify.dev/docs/api/customer/latest/enums/OrderSortKeys . Current object references identify API 2026-10.
- OpenID Connect Core ID-token validation: https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation .
- Installed Next.js 16.3.5 cookies/Route Handler guide: async cookies, outgoing changes only in handlers/actions, no private shared cache. No dependency or migration is added.

## Next phase

After merchant acceptance, choose durable identity linking/token lifecycle with controlled server persistence and unique account-link policy. Then implement trusted commerce entitlement/quote enforcement and exact checkout proof before activating member prices. Verified order-to-product provenance and reviewed current-price reorder can follow. Keep all member product intelligence inside the existing Aethelios/Council; historical Cassius planning does not authorize a separate engine or access to founder dossiers.

## Release evidence

Exact checked tree, CI outcomes and connected deployment are recorded in the release PR. Real Shopify activation remains pending merchant configuration, regardless of a successful application deployment. Existing Cabinet and purchasing stay usable.
