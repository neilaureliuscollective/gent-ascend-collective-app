# Lifestyle Phase Two — product atelier

Founder requested current research and execution of the next build phase on October 12, 2026. Phase One PR #100 is unmerged; this is a stacked candidate based on its verified head `05332fe04c65df8af8a2400014acced8136b736d` / tree `5d3ed0a4ffef75b425914ad945a45341d159484e`. The canonical unified application remains the only implementation. Do not merge this independently before Phase One.

## Research and phase choice

- [Baymard visible thumbnails](https://baymard.com/research-articles/always-use-thumbnails-additional-images) and [hidden-thumbnail signposting](https://baymard.com/research-articles/truncating-product-gallery-thumbnails): photography must be discoverable on mobile, with clear access to additional views. Retain actual thumbnails and add numbered previous/next controls rather than dots or automatic rotation.
- [Baymard video placement](https://baymard.com/research-articles/embedding-product-page-videos): product video belongs with the gallery rather than a distant page section. Video support is conditional on a real approved Shopify asset, captions and transcript; no sample media reaches production.
- [NN/G progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) and [product-page guidance](https://www.nngroup.com/articles/ecommerce-product-pages/): retain immediate price/selection/purchase, then expose optional inspection and approved sensory/formulation details. Conversion improvement is a hypothesis, not a measured result.
- [WAI carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/): native controls, stable focus, user-controlled changes and meaningful labels. No carousel auto-rotation.
- [Shopify media](https://shopify.dev/docs/api/storefront/latest/interfaces/Media), [Video](https://shopify.dev/docs/api/storefront/latest/objects/Video), [Model3d](https://shopify.dev/docs/api/storefront/latest/objects/Model3d): images, hosted video and real models have different source fields. Use separate GraphQL aliases for video sources; keep external embeds out of this phase.
- [web.dev video loading](https://web.dev/articles/lazy-loading-video) and [responsive imagery](https://web.dev/learn/design/responsive-images): load video only after explicit selection with preload none, no autoplay; preserve responsive images and defer enlarged image mounting until inspection opens.
- Installed Next.js Image documentation and React quality review: retain intrinsic image dimensions, native error handling, small client islands and renderer cleanup.

The initial design did not need another commerce backend. Its largest gallery gaps were image sequencing inside enlarged inspection, controlled detail zoom, failed-photo recovery and inaccessible optional media. Live merchant naming/policy/category issues from Phase One are not solved by visual work and remain release dependencies.

## Implemented

- Numbered image counts, native previous/next controls and retained thumbnail selection across phone, unfolded/tablet and desktop compositions.
- Enlarged inspection includes previous/next buttons, left/right arrow keys, fit/2× controls and an internally scrollable high-resolution view. Escape/close restores focus to the current photograph. Browser pinch zoom remains available; this is not a custom gesture recognizer.
- Failed photographs show a truthful error while other views and purchase controls remain usable. No generated image replaces merchandise. A no-JavaScript direct image link remains available.
- Gallery projection supports up to twelve photographs and twelve media records. It does not claim to retrieve an unlimited complete media library.
- Optional merchant-approved Shopify MP4 shares the gallery. Player mounting is user-triggered, has native controls, no autoplay and preload none. Switching back to photography unmounts it; hidden/offscreen playback pauses. Failure retains product inspection and purchasing.
- Optional films require an approved transcript and Shopify-hosted caption track with explicit language/label. External media, missing accessibility assets and unapproved stories do not activate film. Existing real GLB approval and ten-megabyte guard remain intact.
- Approved texture, scent and selected formulation-role information appear in a compact disclosure after purchasing. The full existing formula and ritual chapters remain. Missing content is never inferred from handles or supplier names.
- The competing membership promotion is replaced with a short account/Cabinet continuity link, explicitly separating saving from purchase. Supabase ownership, member gates and Shopify checkout rules remain unchanged.
- Shared Obsidian materials, contrast roles, touch targets and reduced-motion behavior are retained. No dependencies, migrations, merchant writes, reviews, discounts or AI tools added.

## Media activation contract

Existing version-one approved stories remain compatible. To enable a real product film, the merchant must approve its actual content and provide `mediaApproved: true`, `videoTranscript` (at most 6000 characters), and `videoCaptions: { url, language, label }` in `gent_ascend.product_story`. The caption URL must be HTTPS on the existing allowed Shopify CDN. This shape is a content contract, not approval of any asset or claim.

Attach the actual video to the Shopify product; the implementation selects an allowed MP4 rendition no larger than 1920×1080. It does not infer an audio description or caption accuracy. Verify caption synchronization, contrast, transcript accuracy, sufficient description of visual content, CORS, device playback and network behavior before activating media. Optional 3D still requires approved authentic GLB media and is never necessary to buy.

## Acceptance and limits

Meaningful tests cover approval/accessibility/host/dimension gates, oversized models, gallery sequencing, 2×/fit behavior, keyboard closure/focus return, failed photographs and deferred video mounting. Browser tests use labeled synthetic assets, never claims of real supplier media or checkout. Standard lint/types/unit/build, migration ledger, Lifestyle and Obsidian checks are required before review.

Local environment constraints from Phase One remain: no configured Shopify runtime credentials; shell Git proxy unavailable; normal prebuild may fail at Mirror asset DNS; Playwright server binding returns EPERM. Hosted CI and exact-head preview receipts are recorded in the PR. Screenshots generated by CI are distinct from inspected images. Physical Fold/Safari, real video/caption/model assets, actual stock/cart/checkout and field performance remain separate acceptance gates. Production promotion is not part of this build request.

Next useful work after acceptance: merchant content curation and real checkout certification, then personal collection continuity or a bounded read-only shopping concierge. Neither wishlists nor member-recorded ownership become verified purchases.
