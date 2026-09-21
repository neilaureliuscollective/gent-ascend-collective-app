# Aurelius 1E — obsidian, metal and connected light

Founder-approved visual correction, 2026-09-21. The founder found the purple pervasive and the gold too pale/flat, then approved the researched direction: obsidian lead, metallic gold, localized purple, coherent lighting and orbital connections. This phase changes presentation only.

## Shipped

- Neutral obsidian environment and charcoal reading surfaces; preserve the official #150319 enamel in Aurelius focal areas and the unchanged logo.
- Gold controls now use bronze-to-gold material stops, narrow highlights, a dark lower bevel and cast shadow. Warm gold navigation details and a restrained metallic wordmark. Ordinary reading text remains solid and readable.
- One bounded warm light field and a static orbital SVG backdrop. Selected arcs follow the four main navigation destinations. These are decorative navigation cues, not claims that services or personal-data sources are connected.
- A one-shot 1.8-second arrival light sweep per route; optional slow ambient light drift; one-shot button-hover glint; acknowledged daily-save feedback. No input delay, splash gate, per-frame React updates, animated blur, new renderer, video, body model or package dependency.
- A more detailed static orbital motif on the daily orientation card. The existing optional Aurelius welcome globe remains unchanged.
- Still/reduced-motion suppresses new effects. Existing focus/visibility pause now also observes dialog open/close, so motion pauses throughout modal reading. Solid, higher-contrast and forced-color paths remain usable.

## Research and interpretation

- [Apple's material design](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/): dynamic highlights, depth and distinct control/content layers. We apply the principles in our own black/gold/enamel treatment; we do not claim Apple's native Liquid Glass is implemented in this web app.
- [Google Filament](https://google.github.io/filament/main/filament.html): metallic appearance depends on specular reflection and roughness, not a flat gold hex. The web UI uses an inexpensive visual approximation with gradients/edges; not physically accurate material rendering.
- [Microsoft Mica](https://learn.microsoft.com/en-us/windows/apps/design/style/mica): layered material identity can use mostly opaque surfaces and conservative rendering. We retain substantial reading surfaces instead of stacking full-screen backdrop blurs.
- [web.dev animation performance](https://web.dev/articles/animations-guide): new movement uses opacity and transforms on bounded wrappers; inspect runtime cost rather than assuming CSS is free.
- [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): retain persistent user motion control and reduced-motion support. The entry effect is finite and does not block use.

References reviewed during the preceding proposal and applied here. No new retention/health/psychology outcome claim.

## Acceptance and evidence

Observed: lint, strict typecheck, production build, 59 unit/SQL/mock SDK tests and 40 browser tests pass. Reviewed current 390/768/1440 screenshots; no overflow or page errors. Home JS 153,888 encoded bytes (+749 vs 1D); CSS 15,865 (+684). Both budgets pass. The 120-frame local samples recorded p95 intervals of 16.7ms at 390px and 16.8ms at 1440px, no intervals above 50ms, and zero dashboard canvases. The entry sweep ended at opacity zero.

Use `npm run check`, `npm run test:e2e`, and the local dashboard/material audit scripts after a production build. Actual results are recorded in STATUS.md and the handoff evidence. Baseline 1D initial home JS was 153,139 encoded bytes; added-JS target ≤10 KB, added-CSS target ≤4 KB. No new initial canvas/network vendor.

Calculated opaque-reference contrast against #1d1d1c: body 14.98:1, secondary labels 8.74:1, gold labels 7.49:1. Dark button text against the darkest metallic gradient stop is 5.03:1. These are color calculations, not a blanket accessibility certification of every composited or disabled control.

Screenshots inspect phone, unfolded and desktop states. Browser gates cover the daily flows and Aurelius plus route-based decoration, finite arrival animation, modal pause/resume, Still and forced colors. The material audit records requestAnimationFrame intervals in headless Chromium; it does not measure actual paint/GPU time, battery drain or physical-device smoothness. Live Supabase/model and physical-device gates remain open and unrelated to this visual change.

## Scope and next step

No schema, auth, capability, billing, prompt or persistence change. No push/deployment. Review on Neil's physical foldable next, particularly real contrast, scrolling and battery behavior, then continue the existing service activation/intelligence-evaluation path. Do not add more effects merely because they are available.
