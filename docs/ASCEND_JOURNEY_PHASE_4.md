# Ascend Journey · Phase 4 (2026-09-27)

## Decision

The physical and cultural close now follows the Phase 3 ritual. The Reserve moves from an abstract green doorway to a consultation setting, with a secondary men's salon frame. The Collective is a human conversation, not an unbuilt member network or a social feed. Legacy retains the single Louisiana oak and the final door returns to the crest and core materials, with direct paths into `/enter`, `/shop`, and `/about`.

This phase is public storytelling. The Reserve remains planned. The concept frames are explicitly labeled as concepts, and the Collective campaign image is not identified as an actual member, founder, expert, or partner. No appointments, community feature, signup entitlement, commerce availability, or private data access was added. `/enter` retains the existing invitation and account state handling.

## Architecture and research

The two new chapters are ordinary sections in the existing native scroll journey. The existing `WorldJourney` observer and light copy motion include them. No new renderer, WebGL scene, ScrollTrigger pin, smooth scroll override, dependency, or data integration is needed this late in the arc. A second long pin would lengthen the route and create extra resize and mobile address-bar risk without communicating more. The physical and human imagery carries the transition while chapter links and persistent commerce access remain available.

Current references consulted: [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image) for responsive `sizes` and native lazy loading; [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) for the costs and recalculation behavior of pinning; [W3C reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) for retaining content and destinations without motion. The decision uses the existing client island and CSS architecture rather than adding a plugin merely because it exists.

The images are responsive and lazy below the opening. Mobile shows the image first and the copy in natural flow, with a separate salon frame; tablet/Fold and desktop use a side composition. The second chapter adds no animated canvas. Navigation, linked destinations, headings, labels and concept disclosures remain in the document and work in Still and reduced-motion modes.

## Asset provenance

- `public/media/world/reserve-consultation.webp` and `sanctuary.webp`: existing architectural concept assets, reused. They do not depict a built venue.
- `public/media/world/collective-table-v1.webp`: generated campaign visualization, 65,244 bytes, converted to WebP from an image-generation output on 2026-09-27. Prompt direction: three adult men of diverse ages and backgrounds in a calm focused conversation at a dark mineral and walnut table; one full hair and beard; grouped to the right with dark negative space on the left; future luxury with human warmth; no real founder, member, provider, logo, text, HUD or trees. This is a newly generated image, not a portrait of existing members.
- `estateMedia.legacy`: existing dawn/origin media, retained as the single prominent live oak return.

## Verification and limits

`npm run check` passes lint, strict types, 84 unit tests and a production build; `npm run db:ledger` verifies all ten recorded migration files. All 11 targeted public journey Playwright scenarios pass in software-rendered Chromium, including the new 344, 768 and 1440 CSS-pixel image decoding, anchor, destination and horizontal overflow checks. Viewport captures at those widths were inspected for the Reserve, Collective and final door. The complete browser and local-database CI suite is the independent PR gate.

Hardware Fold open/closed viewport changes, touch feel, mobile Safari, field Core Web Vitals, and final founder art direction need review before production. The generated image should be replaced with commissioned human photography when actual releases and participant consent permit it.
