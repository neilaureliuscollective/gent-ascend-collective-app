# Arrival + Command — September 26, 2026

Founder approved implementation of the first milestone in the September 26 ecosystem plan. This document supersedes the old assumption that Command is the public homepage and commerce must wait for the full LifeOS.

## Implemented

- Public world at `/`: cinematic Louisiana concept poster, restrained orbital motion, editorial narrative, product/intelligence/experience paths, existing official crest, green/gold/obsidian system, responsive public navigation.
- Public pages: `/shop`, three honest collection previews, `/reserve`, `/gent-ascend`, `/aethelios`, `/membership`, `/about`.
- Current workspace moved under `/app`; services, database IDs, API URLs, memory controls, founder bridge and ownership contracts remain intact.
- Old `/you`, `/goals`, `/progress`, `/world`, `/welcome`, `/captures`, `/ascend-profile`, `/founder/*` redirect to their corresponding `/app` routes. `/aurelius/*` redirects to private Aethelios. Old `/aethelios` links containing conversation/starter/link query parameters redirect to private Aethelios; plain `/aethelios` introduces the intelligence publicly.
- `/enter` routes returning authenticated users into the member guide and signed-out users to their account. Successful sign-in sends members without a priority or active pilot/founder access to the guide. Existing signed-out shell previews remain read-only; domain services and RLS enforce personal access.
- `/app/ascend` connects the six existing loop stages; World now connects products, the Reserve, Ascend and member arrival, with future verticals explicitly unavailable.
- Installation guide at `/app/install` and in member arrival. Android install-event enhancement, manual Samsung/Chrome/iPhone/Mac guidance, standalone detection and honest reconnect behavior.
- Manifest start URL `/app`; explicit stable ID `/` preserves the old implicit identity, root scope retains same-origin auth/public navigation, shortcuts for Command and Aethelios.
- Service worker only stores offline.html and one icon. It never caches private HTML, API, auth, conversation or account responses. No offline mutation queue.
- Mobile Aethelios opens a dedicated route from the global launcher. Desktop retains the quick dialog. The full route adapts to the visual viewport keyboard area (without taking over pinch zoom), has a latest-message control, and records selected conversation IDs in its URL.

## Honest availability boundaries

The catalog module is editorial preview data, not a fake Shopify adapter. No price, inventory, add-to-cart, checkout or subscription claims. Product forms are CSS packaging studies labeled as such. Final images and merchandise will enter through the Shopify slice.

The Reserve page introduces the flagship physical experience. Its independent repository is not changed. Set `NEXT_PUBLIC_RESERVE_URL` only to an approved HTTPS origin; otherwise the page stays a complete local introduction. No live service menu, appointment times, rates or booking guarantees are fabricated.

Membership copy describes private invitation and the current software. No public waitlist, billing or promised unapproved lifetime benefits. Existing beta grants continue to authorize Aethelios. Formal Founding Member benefit grants belong in the membership slice after the offer is defined.

## Ownership and cache boundaries

Public layouts are static and do not read Supabase cookies. Public pages index only in Vercel production; preview environments and all member routes retain noindex. The proxy refreshes sessions and marks `/app/*`, `/enter`, auth and API responses private/no-store. Private records retain session-bound domain reads and RLS.

Commerce later: Shopify owns merchandise, variants, inventory, carts, contextual price and checkout. Gent Ascend owns editorial presentation and software identity. Use a supported pinned Storefront API, Cart API, and checkoutUrl. Preview availability remains an explicit editorial decision. Product subscription selling plans and software membership entitlements are independent.

## Verification and release gate

See the current entry at the top of STATUS.md for exact results. Local browser tests use synthetic/intercepted conversations and disconnected account states; they do not prove hosted Supabase, a real model reply, email delivery, real hardware keyboard behavior or PWA installation.

Before production promotion:
1. Verify existing founder login and private bridge at the new paths.
2. Invite a fresh non-founder account, accept, set password, confirm pilot, complete priority/baseline/goal, install, reopen and sign in if needed.
3. On physical Samsung Fold (folded and unfolded), Chrome/Samsung Internet and iPhone Safari: install/reopen, keyboard typing, long streaming reply, history return, navigation and offline recovery.
4. With two real accounts, verify isolated goals, daily records, memory and conversations. Complete action/review and see Progress after reload.
5. Verify Supabase email redirect configuration still targets `/auth/confirm` (it routes to `/app/welcome`). Existing invite templates pointing to `/welcome` remain supported by redirect.
6. Confirm launch content and Reserve origin. Public checkout remains unavailable.

No new database migration is required for this milestone. Existing migrations must already be applied. This implementation does not establish that the entire 15-step external release gate has passed.
