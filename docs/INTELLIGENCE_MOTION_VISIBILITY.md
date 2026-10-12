# Intelligence motion visibility correction

October 12, 2026. Founder tested the deployed system and found an almost invisible orbit in a corner. That is a failed product experience, even though the original state and accessibility tests passed.

## Diagnosis

Talk mounted its primary operation mark in a 44px toolbar control, away from the response and easily scrolled out of view. The large presentation required opening a drawer. The response itself had a static small orb and text notice. Worse, waiting animated `.im-halo`, while artwork mode explicitly hid that layer. Tests established state wiring and lifecycle, but did not require a visible moving element at the response. A static screenshot cannot establish the device's animation setting; no user error is inferred.

## Primary research and decisions

- Microsoft Fluent [Wait UX](https://fluent2.microsoft.design/wait-ux), retrieved October 12: immediate feedback in conversational AI; keep feedback at the relevant content/action, maintain context and avoid competing indicators. Applied: primary motion lives with the active answer, appears before headers, and toolbar identity stops competing. No synthetic estimated time or model-generated status is introduced.
- Apple [progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) and [motion](https://developer.apple.com/design/human-interface-guidelines/motion): predictable location, clear feedback, optional animation. Applied: readable phase labels remain with a static signature in reduced motion. Apple's rich Motion shell was supplemented by indexed official text; a full rendered interactive example is not claimed inspected.
- Apple [Siri's active edge light](https://www.apple.com/newsroom/2024/10/apple-intelligence-is-available-today-on-iphone-ipad-and-mac/): a primary-source example of intelligence identity integrated into the interaction. This supports attention placement, not copying Apple's colors or implying capabilities.
- Meta [AI app announcement](https://about.fb.com/news/2025/04/introducing-meta-ai-app-new-way-access-ai-assistant/): integrated voice/product context; no public engineering specification for its branded animation was established. No claim to reproduce Meta's private renderer or copy its artwork.
- Google/web.dev [animation engineering](https://web.dev/articles/animations-guide): transform/opacity animation and controlled layer cost. Applied: static gradients on three bounded light planes, composited movement, existing visibility lifecycle, no video, WebGL loop, new dependency or per-token animation state.
- Samsung [foldable design](https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html): responsive window size and continuity. Applied: existing draft/transport continuity and 344/768/1440 tests; browser emulation does not certify physical hardware.

The design is an Aethelios-specific interwoven emerald light signature with a restrained gold edge, on carbon/obsidian. It has a visible 100–148px × 76px footprint in the active answer and a smaller shared version in existing Work and Studio activity slots. Request waiting, provider-observed thinking/search/generation, saving, uncertainty and completion use the existing contract. Readable output is never shimmered or concealed. Saved records do not become ongoing work. The current voice/controller/consent/cleanup implementation is preserved; the original immersive Live orb stays focal and its background task slots use the shared signature.

## What the founder should see

Send a message in Talk: a luminous emerald signature appears where Aethelios's next reply is forming, with truthful waiting text, without tapping the header orb. It continues beside the answer while real response events arrive. Saving receives the gold accent. Acknowledged completion settles, with Saved shown only after persistence acknowledgment. Existing Work/Studio request slots use the same identity. Still/reduced motion keeps the visible shape and text but stops movement.

## New acceptance gate

Require the response signature to be in the viewport at phone/Fold/desktop sizes; check its minimum physical footprint, visible ribbon and actual changing transform while waiting, phase transitions through streaming/save acknowledgment, and nonrepeating completion. Hold response headers to verify immediate feedback. Reduced-motion feedback must remain visible and readable. Existing broad draft/focus/owner/voice recovery gates remain enabled. Rendered CI artifacts and functional checks are reported independently of subjective visual approval; unit counts alone are never presented as proof of a premium aesthetic.
