# Commerce visual refinement — 2026-10-02

Founder approved the photography-led cinematic refinement after inspecting the live five-phase commerce release.

## Implementation

Shopify's published featured images and galleries display independently of editorial story approval. CDN URL validation remains. Real 3D models remain optional and separately gated; fabricated concept vessels and the Vitalis atelier no longer replace merchandise photography in the commerce experience. Missing photos use a labeled typographic placeholder. The showroom selects a product with photography for its hero when available.

The green/obsidian/gold environment now uses arched lighting planes, dimensional shelves, larger photographs, staggered desktop product compositions, an intentional phone stack and stronger typography. Native scrolling drives light sweeps, product depth and chapter reveals. Gallery changes have a short photographic transition. No label replacement, background removal or invented product mockup is performed.

The client motion island loads GSAP on demand, scopes selectors and cleanup, reverts for Still mode and OS reduced motion, adapts at phone breakpoints, and bounds collection animation to the first 36 objects. No per-frame React updates, auto-spinning product renderer, scroll interception, new dependency or database migration.

## Verification and limits

Lint, typecheck, 223 unit tests and production build pass. Migration ledger confirms the existing 28 files. Browser tests verify responsive overflow, gallery controls, launch gates, saved selections, sharing and reduced motion. A dedicated missing-story fixture verifies Shopify media survives absent editorial approval at 344/768/1440 widths. Fixture photos are explicitly synthetic and do not prove supplier artwork quality or physical-device frame rate.

Live inspection before this change confirmed Shopify products were present while all card photos were being suppressed. Production publication uses the founder's existing approval to make this commerce work available on the live domain. Final deployment verification is reported separately.

Research: Shopify MediaImage and Product Storefront API documentation; GSAP ScrollTrigger and matchMedia documentation; web.dev animation performance guide. The intended motion uses transform/opacity and respects the existing public world's Still control.
