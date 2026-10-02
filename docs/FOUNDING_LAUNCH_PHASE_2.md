# Phase 2 — founding accounts and subscription lifecycle

Researched and implemented locally on 2026-10-02. This continues Phase 1 in the canonical Gent Ascend repository. It does not publish source, promote production, install Shopify apps or take real payments.

## Founder-readable plan

Phase 2 makes the digital membership a real, manageable subscription. Someone creates an account, verifies their email, reviews the actual launch terms, chooses a level and pays in Stripe. Gent Ascend unlocks the paid features only after checking payment. Members can change their plan, change their card, view invoices and cancel.

| Founding level | Monthly USD | Implemented paid access | Still planned |
| --- | ---: | --- | --- |
| Essential | $19.99 | Personal guidance, confirmed memory, progress and the existing personal workspace | Member product offers and a fuller grooming routine |
| Signature | $49.99 | Essential plus Studio image creation within current app limits | Voice, expanded allowances and coordinated weekly plans |
| Reserve | $74.99 | Signature's implemented digital foundation | Larger allowances, personal onboarding and quarterly review |

Reserve does not yet have a distinct larger quota or human service capacity. Do not open sales without a clearly approved explanation of its current value and future commitments. All three one-time product bundles remain planned; no shipment or qualification is invented. Existing grooming capabilities and independent invitations are preserved. None of these levels grants clinical care.

The five-phase sequence remains: **1. Offers and previews → 2. Paid digital memberships → 3. Verified Shopify member offers → 4. Paid preorders with supplier holds → 5. Fulfillment, bundles and operations.** Stripe membership receipts are separate from Shopify orders and supplier settlement.

## Research decisions and build order

1. Use hosted Checkout and the customer portal. This supplies payment collection and a review screen for changes without putting card fields into Gent Ascend.
2. Put all three monthly prices on one Stripe subscription product. Stripe documents that portal downgrades at renewal require prices on the same product. Use tier names as price nicknames; the app remains authoritative for the offer description.
3. Separate paid state, invitations, founder authority, ownership and clinical authorization. A browser return, user metadata or a commercial catalog entry never grants access.
4. Verify the raw webhook body and fetch current subscriptions rather than trusting event delivery order. Store event IDs with the resulting account change in one SQL transaction.
5. Persist checkout attempts before contacting Stripe. Repeated requests reuse the same session and idempotency key. Serialize provider reads and writes per person to prevent duplicate checkout and stale synchronization.
6. Make cancellation survive a paused launch or archived prices. A second, restricted portal configuration provides cards, invoices and renewal cancellation if the full change-plan portal becomes unsafe.
7. Add registration separately from pilot invitations. Use Supabase Auth signup, confirmed email and CAPTCHA on hosted registration; use the existing session/RLS adapters for private reads.
8. Finish contract, failure, SQL ownership and phone/desktop checks before exposing enrollment. Live Auth and Stripe tests are a separate acceptance gate.

These are architecture choices for this app, based on current official documentation. They are not a promise of revenue, payout timing, or equivalence to ChatGPT.

## Implemented paths

- `/membership`: all three prices and current/planned distinctions. A server configuration gate changes the enrollment link only when launch settings are ready.
- `/join`: guarded public registration and existing-account sign-in. Account creation does not take payment or grant beta access.
- `/api/membership/registration`: fixed-origin, strict email/password/CAPTCHA input; no client-supplied person, role or membership. Supabase validates CAPTCHA when enabled in Auth. Existing-account responses stay generic.
- `/auth/confirm`: preserves invitation-token arrival at `/app/welcome`; verified membership email tokens or PKCE codes return to `/app/membership`. No arbitrary return URL.
- `/app/membership`: owner-bound subscription status, current paid access end, scheduled cancellation, last verification, launch terms, recurring consent, support contact, billing portal and manual refresh. A checkout return explicitly does not confirm payment.
- `/api/billing`: same-origin commands only. Session claims, a current Auth user, confirmed email and person ownership are checked server-side. Client amounts, customer IDs and subscription IDs are rejected.
- `/api/billing/webhook`: raw-body Stripe signatures, mode validation, current-state reconciliation, refund/dispute review holds and retryable failures. This route is independent of browser-cookie middleware.
- `/app/you`: membership navigation. Paid sign-in and welcome flow now enter the member workspace instead of asking paid customers to claim a pilot invitation.
- Studio generation checks `studio.create` server-side. Essential can read its existing Studio projects through the current context boundary, but cannot spend on Studio generation. Signature/Reserve and existing eligible invitations/founder/legacy access can create. Existing image quotas are unchanged.

## Billing model and access rules

The additive migration `20261002105745_founding_membership_billing.sql` was created using the Supabase CLI. It extends the existing tier constraint without changing deployed migration files.

- `billing_profiles`: unique person, customer and subscription mapping; owner-readable summary only.
- `billing_controls`: service-only two-minute leases, persisted checkout attempt and payment review holds.
- `billing_event_receipts`: service-only processed event IDs; no raw event payload or card information.
- `billing_enrollment_receipts`: exact accepted offer, terms version/text, price and timestamp. Retrying a session does not overwrite this receipt.
- `billing_control`: narrowly scoped, service-only, security-invoker RPC. Both EXECUTE privileges and table/RLS grants are explicit. The application exports no general service-role client. Private member reads always carry that member's session.

The production database selection uses the repository's pinned project configuration. Test Stripe configuration refuses that production project. Separate local/preview projects are required. Mode mismatch, missing settings and unsafe price/portal definitions fail closed.

Stripe prices must match 1999/4999/7499 cents, USD, monthly recurring, interval count one, licensed per-unit billing, correct mode and one product. New sales additionally require active prices. The browser cannot choose another price.

| Provider outcome | App behavior |
| --- | --- |
| Active subscription, paid invoice with a matching price, future item period end | Confirm paid tier and access through that period |
| Checkout return or incomplete first payment | No paid access from the redirect |
| Upgrade awaiting payment | Keep only the previously paid tier and its original expiration; no unpaid expansion |
| Confirmed upgrade payment | Reconcile the new paid tier |
| Portal downgrade | Schedule at renewal; keep the currently paid level until the change takes effect and payment confirms |
| Renewal cancellation | Keep paid access to the current period end; provider deletion ends access |
| Past due, unpaid, paused, unsupported items/price, expired period | No paid provider access; independent invitation/founder grants remain |
| Full refund or open/lost dispute | Conservative payment review hold; prevent another subscription charge while held |
| Won/closed-warning dispute | Clear that dispute's hold using current provider status; other holds still apply |

Mapped Stripe customers are dedicated to digital membership billing; do not reuse them for unrelated merchandise or one-off charges.

Full-refund holds are deliberately conservative account review holds, including refunds of an earlier period. They do not automatically clear on another invoice. This policy must be approved and explained before sales; partial refunds do not impose this hold. A trusted operator must review refund holds and perform a controlled correction, followed by provider refresh. There is no public hold-clearing endpoint.

No free trial, automatic promotion code, lifetime founding-price promise or bundle qualification was introduced. Stripe cannot expand access using an invoice for a different price. Ambiguous multiple current subscriptions, more than 100 subscription records or incomplete invoice line listings require a review rather than an assumed entitlement.

Checkout sessions last one hour. An open attempt for a different offer blocks a new checkout until it expires. The stored attempt includes price, origin and exact terms so a changed launch configuration cannot silently alter a retry. A lost provider response uses the same idempotency key. Near-expiry unresolved attempts fail closed until expiration. Cancellation and renewal do not erase private member records.

## Activation runbook

The code is built; commercial activation is still closed. Complete the following in an isolated test environment first.

### 1. Database and identity

Apply the additive migration after reconciling the existing migration ledger. Run real Supabase migration/security checks and two-user RLS/Auth tests. This environment's PGlite checks emulate SQL, not Supabase Auth, PostgREST or hosted deployment.

For public registration, explicitly enable Auth signup and email confirmation in the intended project, configure production SMTP and exact redirect URLs, and test email delivery. The existing local harness deliberately has signup disabled; it was not changed. `MEMBERSHIP_SIGNUP_ENABLED=false` and `MEMBERSHIP_AUTH_READY=false` remain defaults. Founder development and existing invitations do not depend on these settings.

Enable Cloudflare Turnstile in Supabase Auth using its secret; set the matching `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the app. The server supplies the challenge token to Supabase. Hosted registration requires the public site key; a missing or failed challenge cannot submit. Auth's rate limits and CAPTCHA must be tested directly; their settings cannot be proven by an app flag.

Default PKCE confirmation requires the browser's verifier cookie. For cross-device email confirmation, use a membership email template pointing to the approved `/auth/confirm` URL with `token_hash={{ .TokenHash }}&type=email`. Keep invitation links on `type=invite`. Test both, expired tokens, duplicated accounts and invalid codes before setting the Auth-ready flag.

### 2. Stripe prices and portal configurations

Create one membership product and three immutable monthly USD prices. Use a Stripe test key in local/preview; a live key only in production. Do not configure production database credentials in a Stripe test deployment.

Full portal requirements:

- Invoice history and payment-method updates enabled.
- Cancellation enabled, `at_period_end`, proration `none`.
- Subscription updates enabled; allowed update is `price` only, not quantity or promotion code.
- Exactly the three founding prices on that one product; adjustable quantity disabled.
- Proration `always_invoice`; billing cycle anchor unchanged; schedule at period end when `decreasing_item_amount`.

Recovery portal requirements: invoice history, card changes and renewal cancellation as above; subscription updates disabled. This is a separate `bpc_...` configuration. Both are verified before new checkout. Recovery is checked separately when the full portal or price validation fails.

Set `BILLING_TAX_MODE=automatic` only after the Stripe Tax setup/registrations and product tax code are ready. `none` is an explicit reviewed merchant choice, never an implicit missing-setting default. Checkout collects the billing address; tax display is handled by Stripe.

### 3. Webhooks and launch settings

Stripe SDK is pinned to 23.0.0; provider calls use `2026-09-30.endive`. Configure a matching snapshot webhook destination at `/api/billing/webhook`. Enable:

`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.voided`, `invoice.marked_uncollectible`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.

Set server-only Stripe key/signing secret, Supabase service credential, canonical `BILLING_APP_ORIGIN`, three price IDs and both portal IDs. Keep all provider secrets out of `NEXT_PUBLIC_` variables. Disabling new enrollment must not remove these settings for already paying accounts.

Before activating checkout, provide a real `MEMBERSHIP_SUPPORT_EMAIL` and approved `FOUNDING_TERMS_VERSION` / `FOUNDING_TERMS_TEXT`. Explain present benefits for every level, actual usage ceilings, founding-rate duration, monthly renewal, cancellation/refund rules, future-price treatment and whether a bundle is an obligation or an uncommitted plan. Reserve's distinct value and human-service capacity remain commercial decisions. Set both `STRIPE_CHECKOUT_ENABLED=true` and `FOUNDING_LAUNCH_APPROVED=true` only after the live acceptance gates and commercial decisions are complete.

The flags record readiness; they do not prove it or authorize a deployment. No future standard price or countdown was invented.

### 4. Acceptance and recovery

Use Stripe sandbox/test clocks and two real Auth users to prove initial payment, card decline, 3DS authentication, renewal success/failure, upgrade payment/decline, downgrade scheduling, cancellation, full/partial refunds and won/lost disputes. Verify the real resulting Supabase account after each transition, including preservation of beta/founder grants and denial of clinical access. Verify returned URLs, email confirmation, keyboard use and no phone/Fold overflow. No real-card test is needed for sandbox acceptance.

Return transient webhook errors to Stripe for retry; do not acknowledge a failed database write. Check delivery failures in Stripe's dashboard, repair configuration, resend failed events, then use the owner's “Refresh payment status” for subscription recovery. Refresh preserves stored payment holds; refund/dispute events must also be redelivered when missed. Never manually mark a subscription paid to hide a delivery problem.

This slice has no scheduled fleet reconciliation, in-app operations console or automated dispute/refund resolution. Webhook delivery monitoring and a named operator are required for launch. Fleet reconciliation, audit retention/cleanup, support operations and larger-scale recovery belong to the operations phase before scaling. Retain event/enrollment receipts until an approved retention policy exists. A failed sync can temporarily deny access at expiry; it cannot mint another month of access.

## Sources checked 2026-10-02

- [Stripe Checkout subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions): hosted subscription flow.
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create): server-selected recurring price, expiry, redirects and automatic tax.
- [Stripe webhooks](https://docs.stripe.com/webhooks): raw-body signatures, retries, duplicated and unordered events.
- [Stripe subscription object](https://docs.stripe.com/api/subscriptions/object): current status and item-level billing periods; expanded invoice reconciliation.
- [Stripe API idempotency](https://docs.stripe.com/api/idempotent_requests): stable keys for retrying uncertain provider writes.
- [Stripe customer portal settings](https://docs.stripe.com/customer-management/configure-portal): same-product requirement for renewal downgrades, billing management and cancellation.
- [Stripe portal configuration API](https://docs.stripe.com/api/customer_portal/configurations/create): explicit change/cancel features and safe configurations.
- [Stripe pending updates](https://docs.stripe.com/billing/subscriptions/pending-updates): payment-dependent changes. This build uses the hosted portal and paid-invoice entitlement checks instead of a custom pending-update UI.
- [Stripe official SDK](https://github.com/stripe/stripe-node): installed 23.0.0 types/API version; current `allowed_payment_method_types` input.
- [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client): verified claims, cookie-based server clients and private caching.
- [Supabase signup API](https://supabase.com/docs/reference/javascript/auth-signup): registration, email confirmation and generic duplicate-account behavior.
- [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha): hosted bot protection passed to Auth.
- [Supabase changelog](https://supabase.com/changelog): current changes reviewed; this slice introduces no ltree indexes, legacy pgcrypto encryption, floating-point btree_gist indexes or custom operators implicated in the September database breaking-change notice. No database-engine upgrade was attempted.

## Validation record

See STATUS.md for final observed results. Provider contract tests use mocked network responses with actual Stripe signature verification; SQL tests run the migration, explicit service-role commands, lease checks and owner isolation in PGlite. Browser component fixtures are synthetic and never an identity bypass or real payment. No live Stripe, SMTP, CAPTCHA or hosted Supabase configuration was altered or verified.
