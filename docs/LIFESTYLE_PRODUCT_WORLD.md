# Aethelios Lifestyle product world — 2026-10-16

Elevates the existing Shopify-backed Lifestyle foundation into one immersive storefront. Customer-facing identity is **Aethelios Lifestyle** under **AETHELIOS — THE HUMAN ASCENDANCE**. No Talk, voice, globe, Architect, Studio or knowledge files were changed.

## Implemented

- Typed merchandising maps approved house packshots to exact published Shopify handles. A photograph becomes a product destination only after a live catalog match. Unverified catalogs show house photography as art direction without purchase links.
- The special-case `vitalis`-first catalog sort is removed. Featured placement lives only in the opening scene resolver.
- Shopify default vendor names (`My Store`, `Shop`, `Store`) present as Aethelios Lifestyle. Real supplier names remain visible.
- Public `/lifestyle` and member `/app/lifestyle` share a compact header plus an asymmetric emerald product scene. Scene products are not repeated in the following assortment.
- Collection search, URL-backed filters, sort, return navigation, Cabinet, browser save and Shopify cart/checkout are preserved. Mobile shoppers get a visible Filters control, active chips and reset. Search and availability stay on the first row.
- Product pages keep the existing gallery, variant, uncertain-add and related-product contracts. The sticky purchase control hides while the software keyboard is open and continues to clear member bottom navigation.
- The bag keeps server-confirmed quantities, validated `/checkout` handoff and HttpOnly cart protection. The heading remains Cart; checkout copy still distinguishes estimated subtotal from Shopify’s final total.

## Assets in this checkout

Approved packshots used for art direction and handle-matched merchandising:

- `/media/world/vitalis-cutout.webp` — pump bottle, hair & beard oil, 30 ml
- `/media/world/obsidian-creme-cutout.webp` — jar, face moisturizer, 60 ml
- `/media/world/obsidian-wash-cutout.webp` — pump bottle, body wash, 473 ml
- `/media/world/hydros-cutout.webp` — tub, hydration powder, 300 g
- `/media/world/ascend-cutout.webp` — tub, performance powder, 368.5 g

Printed labels still read Legacy Reserve. That physical print is shown as photographed. It is not current customer-facing brand copy. Current Aethelios packaging photographs were not present in this repository or this chat.

## Verification in this environment

| Gate | Result |
| --- | --- |
| Unit tests | 1388 passed, 1 skipped |
| Lifestyle Playwright (27) | passed with system Chrome |
| Lint / types / production build | passed |
| Storefront token | absent — live Shopify catalog and checkout were not exercised |
| Authenticated member preview | fixture shell only |

Fixture page `goto` / `domContentLoaded` on the component server, after the change:

| Surface | Phone | Fold | Desktop |
| --- | --- | --- | --- |
| Member opening | 1537 / 977 ms | 1094 / 525 ms | 1044 / 483 ms |
| House-art opening | 954 / 427 ms | 991 / 469 ms | 922 / 398 ms |
| Public opening | 939 / 419 ms | 973 / 453 ms | 897 / 377 ms |
| Catalog | 986 / 416 ms | 1038 / 445 ms | 921 / 386 ms |
| Product | 942 / 386 ms | 995 / 439 ms | 921 / 376 ms |
| Bag | 938 / 410 ms | 908 / 386 ms | 938 / 403 ms |

These are local fixture timings, not hosted LCP or a live catalog comparison. No before-timing was recorded on this machine; do not read them as a speed claim.

## Outside this code task

Shopify catalog publication, media uploads, merchant-data edits, purchases, hosted credentials and production merge remain closed. This environment has no Storefront token, so live product handles, prices and checkout were not verified here. Fixture and unconfigured-catalog states are honest and labelled.

If the live shop still uses default vendor “My Store”, change that in Shopify admin. If Vitalis / Obsidian / Hydros / Ascend handles differ from the mapping above, send the current handles — do not invent SKUs in code.
