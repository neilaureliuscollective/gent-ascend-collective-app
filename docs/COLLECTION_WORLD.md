# The Collection — native member product world

Founder-authorized research, plan and implementation, 2026-10-04.

## Product decision

Use **The Collection** as the experience name and **Collection** as the permanent main navigation label. This is an editorial brand decision, not a scientifically proven conversion claim. It conveys considered ownership while remaining legible beside Command, My world, Progress and You. Add a fifth destination rather than remove an existing workflow.

The existing commerce environment already had showroom, formula, ritual, gallery, saved selection, related-product, cart and purchase capabilities. The gap was placement: members reached public commerce through a collapsed World link and lost the workspace shell. This implementation gives commerce a native member home without another storefront or a competing source of merchandise truth.

## Research and resulting implementation

- Baymard mobile app UX research: https://baymard.com/research-articles/mobile-app-ux-trends — a bottom navigation destination for categories helped participants find products. Applied as persistent Collection access, visible chapter controls, and explicit filtering scope.
- Baymard mobile search/navigation: https://baymard.com/research-articles/mobile-ecommerce-search-and-navigation — product finding failures can make users believe a catalog lacks products. Applied as a search field, result count, availability toggle, clear reset, and saved-selection empty states.
- Baymard mobile usability: https://baymard.com/research/mcommerce-usability — product information, price, shipping and purchase controls must stay accessible. Preserve the established product education/purchase components and lift mobile purchase controls above the app dock.
- Shopify Cart API: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage — Shopify remains responsible for the cart and checkout URL. The member routes use the same catalog services, API, cookie and checkout flow.

Research reviewed 2026-10-04. No claim that the design has measured conversion lift, established supplement superiority or purchase addiction. The repeat-use direction is useful daily rituals, clear product information and straightforward return visits.

## Implemented phase

1. `/app/collection`: gallery environment, green/gold/obsidian, a compact introduction, direct catalog search, category chapters, availability filter, saved browser selection and discovery guide.
2. `/app/collection/[handle]`: shared server product reader and existing cinematic product experience inside the workspace. Catalog, related-product and saved-selection links remain member-native.
3. `/app/collection/cart`: the existing cart review. Shopify checkout remains the payment spine.
4. Collection is a top-level World destination and a permanent fifth main navigation button. Descendant product/cart routes retain its active state.
5. Responsive commerce CSS keeps floating cart and mobile purchase controls above bottom navigation. Product information remains in document flow, keyboard accessible and usable with reduced motion.
6. Public `/shop` stays intact, with public route defaults for all shared components. No migration, authorization change, new dependency or new price is introduced.

## Next coherent phases

- Verified member economics: connect the account-owned product pricing/benefit layer after its build is integrated; show public and applicable member prices only when server-authoritative rules can carry the correct buyer identity to Shopify checkout. Never simulate savings in the UI.
- Ritual continuity: integrate account-owned Cabinet/routine records, past orders and accurate reorder affordances once those services are live. A browser wishlist is not account ownership, order history or replenishment evidence.
- Merchandising refinement: publish approved product imagery, actual ingredient/directions/caution data and verified product relationships through Shopify. Instrument the existing aggregate commerce events to measure discovery → product → cart → checkout without fabricated scarcity or medical claims.

## Verification

Lint, typecheck, production build, 260 unit tests and migration ledger passed. The 3 final member browser journeys and 18 public commerce/navigation regression checks passed. Phone, tablet and desktop screenshots were inspected. See the dated STATUS entry for details. Local disconnected catalog tests prove route continuity, search/filter behavior and preview purchase denial, not production Shopify inventory, a payment transaction or authenticated member-specific pricing. Physical Samsung/iPhone install behavior and checkout payment remain separate checks.
