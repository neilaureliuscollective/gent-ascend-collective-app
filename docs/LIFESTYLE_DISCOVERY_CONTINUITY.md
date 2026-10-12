# Lifestyle discovery continuity — Phase Three

Implemented 2026-10-12 on the Phase Two atelier stack; production unchanged.

## Research and choice

Baymard's [Back button expectations](https://baymard.com/research-articles/back-button-expectations) identifies filters/sorts and return-to-list context as navigation expectations. Its [applied filters research](https://baymard.com/research-articles/how-to-design-applied-filters) supports a visible, individually removable overview. Consulted 2026-10-12. These are usability findings, not a measured conversion forecast for Aethelios.

[Comparison research](https://baymard.com/research-articles/provide-comparison-features) targets spec-driven catalogs; mobile list optimization is often a better first investment. With ten current grooming products and incomplete approved attributes, do not add a comparison system or invent specifications.

Next.js [native History API](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api), corroborated by installed 16.3.5 docs, supports URL changes without catalog refetch. React's external-store subscription provides hydration-safe browser state and removes listeners on unmount.

## Implemented

- Public/member/brand catalog use the same bounded URL state: q, chapter, available, sort, brand.
- Filter/sort changes create history entries; search typing replaces the current entry to avoid a history entry per keystroke. Reload and Back/Forward reconstruct controls and results together. Product navigation followed by browser Back retains list filters via the URL.
- Applied filters can be removed individually; existing reset clears catalog options while preserving unrelated query parameters and fragments.
- Unsupported brands/chapters/sorts fall back to actual catalog options. Mixed-currency price sorting stays unavailable.
- Saved chapter references only this browser's existing saved selection. No saved product identifiers, purchase history, profile data, or new preferences are encoded. Search text is public URL context, visible in copied links and browser history; no analytics sink was added.
- Existing shared visual tokens, semantic controls, live result count, genuine catalog data, Cabinet ownership and Shopify actions remain authoritative.

## Acceptance and verification

Automated: URL round-trip/default clearing, unsupported values, 120-character search bound, mixed-currency guard; browser reload, Back, removable filters and widths 344/720/768/1440. Existing Lifecycle/atelier and Obsidian suites remain release checks.

Local sandbox cannot bind the fixture server; browser checks require hosted CI. A production build without the network-dependent Mirror prebuild is a compilation check only. Record actual CI and preview results separately in the PR.

Live merchant gates remain: correct inconsistent product copy; approve structured attributes and brand collections; publish supported shipping/return policies; validate real cart persistence, stock/price revalidation, checkout handoff and eligible express payments. No payment or order has been created by this phase.

## Next useful phase

Merchant data and checkout validation take priority over recommendation/AI work. Only after those gates: merchant-approved related/complementary products and a grounded concierge with explicit cart review. Customer Account activation, authenticated order verification, private analytics, 3D/video assets and production promotion need their corresponding configuration and release review; they are not claimed complete.
