# Public scene repair — September 26, 2026

Founder approved repairing scrolling, sharing the member Aethelios orb, earlier scene choreography and a broader Reserve presentation. This is a public presentation change, not a backend or commercial activation.

## Evidence and choices

Inspected `world-journey.tsx`, `intelligence-stage.ts`, `scene-atmosphere.tsx`, public styles and the member `presence-renderer.ts`. Previous background movement spanned `top bottom` to `bottom top` with numeric scrub catch-up. The homepage had its own faceted Three sculpture rather than the member shader renderer. Backgrounds had large moving gradient layers and product copy used backdrop blur.

The reported physical Fold tearing has not been reproduced on that hardware. No before/after FPS improvement is claimed. Attempted development-server baseline capture failed to connect; verification uses the production server through the repository Playwright runner. These changes eliminate identified rendering stressors and timing mismatches rather than asserting an unmeasured GPU root cause.

## Implemented

- Removed the duplicate public sculpture renderer. The public wrapper uses `AureliusPresence`, the exact member SVG and optional `mountPresence` shader renderer. Public state is decorative `ready`, not simulated listening or private intelligence. Member request states and original deferred mount behavior remain intact.
- Public orb warms up within 1200px of the viewport. Existing offscreen/hidden/dialog pause, bounded resolution, degraded fallback and disposal remain in the shared renderer. Public Still mode disposes its canvas.
- Removed architectural background scrolling/scaling and animated Reserve clipping. Light occupies its own bounded layer; its opacity has one timeline owner. Mist/stars retain independent ambient motion paused offscreen and in Still/reduced motion. Removed product-copy and fixed-navigation backdrop blur.
- Ritual and intelligence use native sticky stages on viewports at least 701px wide and 720px high. Stage height subtracts measured header + chapter navigation. Main foreground action completes early, followed by a composed hold. On smaller/shorter screens natural flow is retained, with entry motion complete well before exit. No wheel/touch interception or synthetic scroll smoothing.
- ResizeObserver tracks navigation geometry. ScrollTrigger uses function-based start/end values, refresh invalidation, scoped cleanup and direct scrub without catch-up lag.
- New Reserve consultation image centers a desk, visitor chairs, grooming products, warmth and personal attention. Homepage and gateway copy include Neil's grooming/performance consultation, products, and Katie's salon craft. The gateway retains explicit preparation/booking availability boundaries. The independent Reserve repository is untouched.
- Tall background image sizing corrected to avoid undersized image candidates after cover cropping.

## Research applied

Accessed September 26, 2026:

- https://gsap.com/docs/v3/Plugins/ScrollTrigger/ — scroll ranges, scrub catch-up, refresh and responsive lifecycle.
- https://gsap.com/resources/st-mistakes/ — one animation owner, function-based geometry, scoped cleanup, scroll range determines duration.
- https://web.dev/articles/animations-guide — transform/opacity preference and paint profiling. Blur/layer removal is a targeted mitigation, not proof of a device-specific cause.
- https://developer.chrome.com/docs/devtools/remote-debugging/ — physical Android profiling remains the right way to confirm the founder's hardware issue.
- Installed Next.js 16.3.5 docs: use-client and lazy-loading — interactive boundaries and deferred rendering code.

## Asset provenance

Built-in image generation produced `public/media/world/reserve-consultation.webp` from this prompt: cinematic, attainable private Louisiana consultation room; walnut desk and emerald guest chairs; few unbranded black grooming bottles; notebook; bronze lighting; subtle classical/laurel detail; oak window; quiet dark left copy space. No salon chair, barber pole, medical equipment, logos or people. Converted to WebP; original generated PNG preserved in scratch. Clearly labeled atmosphere concept on the homepage, not an actual venue photograph. Earlier concept file preserved.

## Acceptance

Continuous browser tests capture Chrome timeline/screenshot traces for slow, fast and reverse scroll across ritual, collection, intelligence and Reserve. They assert stable backgrounds, visible composed holds, shared orb lifecycle, Fold-width changes and no horizontal overflow. Existing public journey and member orb tests cover product selection, destinations, reduced motion, request-state isolation and graphics fallback.

Lab rendering uses headless Chromium/SwiftShader. Passing it does not prove physical Samsung GPU smoothness, heat or battery behavior. Actual Fold and iPhone touch scrolling remain a final device review. Broader auth, live-model, installation and invitation release gates remain separate and unchanged.

Observed verification: production build, lint and strict typecheck passed; 84 unit tests and 19 browser tests passed. A saved Fold-width replay passed separately and captured 267 screenshot events over 11.14 seconds of slow/fast/reverse scrolling. Sampled frames were visually inspected; no tearing was visible in those samples. This is not evidence of physical-device FPS or a reproduction of the founder's reported artifact. Recorded migration snapshot matched 10 existing files; no migration was changed.
