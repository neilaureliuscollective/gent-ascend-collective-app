# Member Lifestyle experience

Development branch only. No production merge, hosted migration, provider activation, purchase or catalog mutation.

## Direction

Signed-in `/app/lifestyle` is a member environment: products, Cabinet and Grooming first. It no longer reuses the public promotional landing. Public `/lifestyle` and `/shop` keep the existing editorial introduction.

## Implemented

- Distinct member home: confident heading, short purpose, authentic product wells when photography exists, and honest empty/unconfigured/error states.
- Hierarchy: Explore the collection → Cabinet and Grooming → genuine catalog brands/categories → cart and orders as utilities.
- Smoked-glass shell tokens (`#111111` / `#1A1A1A` / `#242424`) scoped to `.member-collection`, with emerald for selection/depth and Reserve Gold for brand emphasis and primary actions.
- Collection browsing keeps search, filter, sort, availability, prices and contain-style photography; first products can occupy a larger well when images exist.
- Product detail keeps gallery, enlargement, keyboard/focus restoration, variants and purchase controls. Cabinet/Grooming sit next to the purchase decision. Labels distinguish browser save, Cabinet save and purchasing.
- Returning from a product restores the last collection list URL and scroll when that list path is valid. Cart and orders stay on member collection routes.
- Existing Shopify catalog/cart/checkout, Cabinet and Grooming implementations are reused. No second commerce system, no invented prices/stock/orders, no membership paywall.

## Not in this assignment

Talk #131, Architect #130 and Studio #132 are untouched. Public site redesign, product training, recommendations, conversational commerce, commissions and production release remain out of scope.

## Remaining gates

Live merchant photography, prices and checkout still require the existing Shopify configuration. This environment may render the unconfigured catalog honestly. Physical Fold/Safari acceptance and hosted Auth are separate from fixture screenshots.
