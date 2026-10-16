# Member Lifestyle experience

Founder authorized production merge of PR #133 on 2026-10-15. No hosted migration, provider activation, purchase or catalog mutation. Shopify catalog/media work remains paused.

## Direction

Signed-in `/app/lifestyle` is a member environment: products, Cabinet and Grooming first. Customer-facing brand is **Aethelios Lifestyle / Aethelios Human Ascendance**. Legacy Reserve is retired as a current brand name. Public `/lifestyle` no longer promotes a Legacy Reserve tile. Technical Shopify handles, including `legacy-reserve`, are unchanged.

## Implemented

- Compact member masthead with Cabinet, Grooming, cart and orders, then one emerald product stage (~340px on desktop). House packshots from `/public/media/world/*-cutout.webp` bind to published catalog handles; they never invent a Vitalis (or other) purchase link.
- Authentic packaging is shown as photographed, including any Legacy Reserve text still printed on physical labels. Prices and availability are confirmed only in the catalog.
- Cabinet/Grooming continuity sits directly under the stage. Empty personal states stay compact and uninvented. Kept-product counts come from a Cabinet count query, not the first preview page.
- Collection browsing and product detail share the same smoked-glass environment: emerald product wells, gold actions, graphite reading surfaces. Nested photo frames are reduced. Featured catalog products are not repeated as a second hero.
- Cabinet save renders once beside purchase. Browser save, Cabinet save and buying stay distinct.
- Catalog return is scoped to public vs member context. Retired `/lifestyle/legacy-reserve` and `/app/lifestyle/legacy-reserve` URLs redirect to `/shop` and `/app/collection`.
- Public `/shop` header again includes Cabinet and orders. Member collection keeps Cabinet, Grooming, cart and orders.
- Fixture evidence uses the complete seven-item Aethelios navigation plus cart launcher. Synthetic catalog images remain labelled SYNTHETIC PHOTO and are separate from house photography.

## Not in this assignment

Talk #131, Architect #130 and Studio #132 are untouched. No Shopify publication, paid image generation, production brand-asset replacement, product training, or production release.

## Remaining gates

Live merchant photography, prices and checkout still require the existing Shopify configuration. This environment may render the unconfigured catalog honestly while house packshots establish art direction. Physical Fold/Safari acceptance and hosted Auth are separate from fixture screenshots. The unapproved simplified logo was not used.
