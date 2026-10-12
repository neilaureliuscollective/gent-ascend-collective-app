# Aethelios Intelligence Motion — Phase 1

October 12, 2026. Founder approved the audit's next safe phase: shared foundation and an isolated state gallery. Canonical baseline is main `c0a7f35`; branch `feat/intelligence-motion-foundation`. This is a review candidate, not a deployed system or completion of phases 2–3.

## Implemented

- A presentation-only operation snapshot with 15 phases, observed/preview basis, independent persistence acknowledgment and bounded supplied audio level. No fabricated percentages, timers, requests, audio APIs or provider inference.
- Compact/large CSS orb, inline activity/status and reusable task card. Obsidian/emerald/gold come from the existing official palette; crest remains unchanged. CSS uses transform/opacity for motion, static gradient depth and no WebGL, shader, particle engine or new dependency.
- A contained-flow family for thinking/generating/processing, directional orbit for connection/search/research/loading/saving, quiet waiting light, measured audio response, finite completion resolution and settled failure/cancellation. Complete with pending persistence reads Saving; Saved requires confirmed persistence. Uncertain persistence suppresses the completion flourish and reads Save unconfirmed.
- Still and dynamic OS reduced-motion preferences reuse existing appearance subscription. Hidden tabs and offscreen marks stop animation via intersection/visibility observation; listeners are cleaned up. No observer support retains static artwork. Quiet environment pauses decorative loops; forced colors retains status text and hides decoration. There is no per-frame React update or JavaScript animation loop.
- Browser-fixture gallery `/motion.html`, clearly labeled preview, with manual state selection, manual illustrative audio level, every phase, compact/large forms and concurrent voice/research/save examples. It does not enter the application route tree or confer account access. The standalone artifact embeds the original crest and requires no network.

Current Talk, Live controller/candidate, Studio, Work, Council, request/persistence contracts, Auth and production routes are untouched. Components are not integrated into those surfaces yet.

## Review locally

From the canonical checkout:

```sh
node scripts/build-motion-gallery.mjs /tmp/aethelios-motion-review.html
# Open the resulting HTML in a browser; everything is a labeled preview.
node scripts/component-test-server.mjs
# http://127.0.0.1:3102/motion.html
npx playwright test --config playwright.motion.config.ts
```

For this execution session the standalone artifact is `/workspace/aethelios-motion-review.html`. The artifact is generated, outside the repository, and not a published app.

## Integration contract for Phase 2

Operation owners provide stable IDs and observed phases. Nothing in this foundation validates or creates a real operation. Use explicit preview basis for demonstrations. A Thinking label is an interaction phase, not a claim to expose internal reasoning. Waiting is available when only request dispatch is known. Searching/researching require actual tool lifecycle evidence; generic busy must not infer them.

Keep voice connection, response generation, audio playback, transcript persistence and background jobs separate; render concurrent operations independently. Treat speech playback completion and a saved transcript as separate acknowledgments. Map the latest PR #90 controller through presentation adapters without rewriting its consent, microphone, interruption, admission, ownership or cleanup behavior. Sample measured audio outside React's frame loop; missing measurements remain zero. Do not automatically send, retry, approve a task or save memory through a motion component. Remount the presence with an operation ID when a new completed operation should receive a distinct finite resolution.

## Validation receipt and limits

- ESLint and Next route type generation/strict TypeScript pass.
- New save/audio truth-boundary tests pass; full unit suite and historical migration-ledger result recorded in STATUS.
- Standalone gallery production bundling passes (Vite correctly warns that Next's use-client directives have no server boundary in this browser-only bundle).
- `npm run build` is blocked at the existing pinned MediaPipe prebuild download: DNS EAI_AGAIN for storage.googleapis.com. The asset check was not bypassed.
- Rendered interaction checks are supplied at 344/768/1440, including no API requests, Still, manual audio, live OS preference changes and forced colors. They remain unrun here: local fixture listener fails EPERM and Chromium fails at crashpad socket creation with Operation not permitted. No screenshot, rendered accessibility, frame-rate, physical Fold/keyboard or real provider acceptance is claimed.
- React skill review: hooks unconditional; derived phase/level calculated without effects; observers/listeners cleaned up; CSS/DOM transient motion does not update React every frame; status text sits outside aria-busy content; no heavy library or mutable request state introduced.

Phase 1 implementation is available for review, but rendered acceptance remains open. Next: inspect this gallery in an unrestricted browser and verify the authored interaction checks, then approve the visual language before Phase 2 adapters. No merge/deployment or change to recently completed Talk/voice work in this phase.

## Research carried forward from the recovery audit

- https://web.dev/articles/animations-guide — bounded compositor-oriented transform/opacity motion.
- https://www.carbondesignsystem.com/building-blocks/foundations/carbon-for-ai — consistent, identifiable AI presence.
- https://developers.openai.com/api/docs/guides/realtime-conversations — generation, conversation events and persistence must not be conflated with playback.
- Local Next 16.3.5 server/client and CSS documentation; existing Imperial Obsidian identity and palette.
