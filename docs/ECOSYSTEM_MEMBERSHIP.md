# Ecosystem membership immersion — 2026-10-15

Isolated review on `cursor/ecosystem-membership-immersion-5b08` from verified `origin/main` `804c8770754aced1837e82dffa4a416c24baa595`. Presentation and journey only. No merge, production deploy, hosted migration, Stripe product/price change, credential setup, paid provider call or purchase.

## What this branch implements

Public `/ecosystem` and member `/app/ecosystem` share one interactive experience:

- Cinematic opening: “One world. Greater possibility.” Official Aethelios crest, labelled illustrative project, no invented travel brand.
- Intent choices (brand / tool / project) change the brief, artifacts, monitor stage and Talk starter. Local example notes stay on the page.
- Supported handoffs: Talk with `ecosystem-brand|tool|project` starters; Studio and Architect open the real workspace without a simulated transfer. Unsigned visitors are sent to `/enter`.
- Preview catalog: Access Free, Ascend $29, Create $59, Architect $129, Continuum $249 Coming soon. `canOpenPurchase` is always false.
- Find your fit recommends the least expensive suitable name. Continuum stays coming soon and offers Architect as the available alternative.
- Selection persists in `sessionStorage` key `aethelios.ecosystem.selection` and the URL. Join and Your membership acknowledge `from=ecosystem`.

Founding billing on `/membership` still shows Essential $19.99 / Signature $49.99 / Reserve $74.99. Access policy and Stripe identifiers are unchanged.

## Branding repaired here

- Join kicker: Aethelios / Your account
- Your membership kicker: Aethelios / Your membership
- Claim world kicker: AETHELIOS / YOUR WORLD
- Closed registration copy remains explicit before any proceed action
- Reserve page: one-sentence clarification that membership does not include the visit, a Partnership tier, or a promise that Neil will build a client website

Unrelated homepage, grooming, presence and You-account kickers were left alone.

## Dependencies not absorbed

Talk conversational-creation / elevation / live-voice, Motion #139, Architect Construct/Connections, Studio, Health and Lifestyle branches stay on their own stacks. Existing Ecosystem drafts #81/#82 were not copied. Graphite / Imperial Emerald selectors now include `.eco-*` surfaces so this page is no longer excluded from solid and forced-color treatment.

## How to preview

1. `npm run build && npm run start -- --port 3100`
2. Open `/ecosystem` (public) and `/app/ecosystem` (member shell)
3. Choose an intent, edit the example purpose, complete Find your fit, select Continuum, then Access
4. Confirm no checkout control appears

## Smallest later steps to make the proposed memberships purchasable

These are not authorized by this work:

1. Founder-approved commercial terms for each new name, including what Access actually includes today
2. New Stripe products and prices — do not rename or remap Essential / Signature / Reserve prices
3. Additive access-policy entitlements and a dated migration for existing subscribers
4. Explicit enrollment flags, tax, support email and portal configuration for the new products
5. A reviewed mapping only after current paid members are grandfathered or migrated with consent

## Honest limits

Continuum cannot be bought. Preview names do not grant capabilities. Registration and paid enrollment remain closed unless their existing env flags are already on. Lifestyle products remain separate. No live model, deploy or background job is started from this page.
