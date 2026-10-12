# Lifestyle cart resilience — Phase Four

2026-10-12. Builds on discovery continuity (#102), atelier (#101), purchase confidence (#100); main/production unchanged.

## Research and diagnosis

Reviewed the cart client, origin-checked API, secret httpOnly cart cookie, complete Shopify line pagination, launch/catalog/availability checks and verified checkout host handoff. Those server boundaries already work in code tests and are reused.

Gaps: simulated ARIA modality did not make the background inert; client GET could hang indefinitely; returning to a stale cart did not refresh automatically; edits/checkout remained available during a refresh; a quantity dropdown allocated options up to the existing quantity without a bound and initially offered only ten despite the API's explicit 25 limit.

Sources consulted 2026-10-12:

- [W3C H102 native dialog](https://www.w3.org/WAI/WCAG22/Techniques/html/H102) and [APG modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): background inertness, contained focus, Escape and returned focus. Use native showModal rather than extending a hand-written focus trap.
- [Baymard cart quantity research](https://baymard.com/research-articles/auto-update-users-quantity-changes): quick quantity controls and accurately completed updates reduce interaction friction. Findings support this direction, not an Aethelios conversion forecast.
- [Shopify cart guidance](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage) and [2026-10 CartWarning](https://shopify.dev/docs/api/storefront/2026-10/objects/CartWarning): mutations can complete with non-blocking warnings and adjusted contents. Display returned quantities, costs and messages; do not treat a requested quantity as confirmed.
- Installed Next 16.3.5 use-client guide: browser lifecycle and interactive state remain in the client island; server authority and secure cookies stay server-side.

## Implemented

Native modal drawer, inert page, focused close control, Escape/close/reopen restoration, scoped body scroll locking with cleanup and full-page cart alternative. No custom modal keyboard trap.

Cart reads use a 20-second deadline; newer reads cancel older reads, version checks ignore superseded results, and component cleanup aborts reads. Returning visibility/focus refreshes an open drawer or full-page cart. Controls and checkout are blocked while checking current data, updating or recovering from an error. The disabled checkout destination is removed as well as excluded from Tab order. Server checkout still independently reads/revalidates cart and validates HTTPS host.

Quick −/+ quantity actions supplement the existing accessible selector, using the established API 1–25 bounds. Current larger quantities remain visible/removable with one extra option, never an unbounded option list. Values above the update limit can be explicitly reduced using the selector. Uncertain writes are never replayed automatically; refresh is required before another write/checkout. Confirmed responses use Shopify's actual quantities/subtotal/warnings. No optimistic stock or final-total promise.

Shared Obsidian tokens, 44px quick controls, wrapping cart controls and safe product-title wrapping support narrow widths. No dependency, database/auth changes, analytics, fake savings, order success, merchant writes or checkout/payment configuration changes.

## Acceptance

Unit/SQL suite, lint/types, production build and ledger are required. Browser cases cover native modal focus isolation, Escape/close/reopen at 344/720/768/1440, returned focus/body cleanup, pending mutation lock, provider-adjusted quantities/warnings, returning stale stock, uncertain mutation read recovery, bounded high existing quantities and timed-out reads. Timeout test accelerates the client deadline in a clearly synthetic fixture. Existing Lifestyle and Obsidian regressions remain required. Hosted CI receipts and exact preview are recorded in the PR; local sandbox cannot bind the fixture server.

These tests are not a real Shopify cart/payment test or physical-device audit. Actual merchant acceptance must verify secure persistence/expiry across reload, real available and unavailable variants, quantity adjustment, price changes, no extra writes on timeout, cart-to-checkout redirect, eligible guest/express checkout, actual shipping/tax/policy display and a merchant-approved payment test. No order or payment is created by this phase.

## Next release dependency

Correct merchant naming/copy and approved brand/attribute/policy data; run the real cart-to-checkout gate. Reconcile the open stack in order before production approval. Customer Account OAuth, authenticated order connection, concierge and analytics remain unconfigured/deferred rather than fabricated.
