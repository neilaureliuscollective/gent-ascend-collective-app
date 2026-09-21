# Aurelius 1F — the Orb

Founder approved the focused Orb proposal on 2026-09-21. This builds on the canonical logo globe and the 1E obsidian/gold/aubergine material direction. No original logo assets change.

## Delivered experience

The shared Orb has a dark aubergine core, layered internal light, three gold bands with different profiles, small orbital nodes, and a beveled four-point star. The main conversation welcome has one deferred WebGL scene. The dashboard, dock and compact panel use the matching SVG identity; there is no GPU scene on the daily dashboard. Soft surrounding illumination and a restrained floor reflection integrate the Orb into the interface.

On `/aurelius`, **Explore the Orb** opens in-memory presentation controls: Ready, Listening, Preparing, Speaking and Stopped. The control always says **Motion preview · microphone off · no audio**. Listening and Speaking use explicitly named `preview-listening` / `preview-speaking` states and an illustrative rhythm with quiet intervals. No audio API, microphone permission, model request or persistence is used. The preview does not grant account access. Closing restores the underlying application state; actual request/interruption states take priority.

The toolbar continues to reflect actual working, saved, stopped and connection states. Text streaming is not described as speech. Preview controls exist only in the full welcome; the global panel stays compact. The welcome disappears when conversation turns exist, preserving reading space. A future voice conversation surface can reuse the renderer, but is not part of this milestone.

## Materials and rendering

`platform/visual/presence-renderer.ts` is presentation-only. Gold uses Three MeshStandardMaterial and a small procedural studio reflection map, with no external image/HDR/model downloads. The core uses a bounded shader to suggest layered crystalline depth. This is an artistic depth effect, not a physically traced volume. A beveled geometry supplies the star. No new dependencies or postprocessing pipeline.

`components/visual/aurelius-presence.tsx` renders SVG immediately; one optional scene imports after the initial interaction surface is available. A static back/core/front construction preserves depth without WebGL. `orb-presentation.tsx` owns the optional preview controls. The small state module does not import Three into the initial bundle.

Rendering targets approximately 30 scene updates per second. DPR begins at at most 1.5, canvas dimensions cap at 480 pixels per axis, and repeated missed frame budgets lower DPR in 0.25 steps to 0.75. Quality does not oscillate upward during the same mounted scene. If pressure persists at the minimum, the renderer stops and the static Orb takes over until remount/appearance reset. No React state or DOM update occurs per animation frame. The read-only `data-animating`, `data-quality`, and snapshot `data-frames` attributes support lifecycle inspection.

Hidden/offscreen scenes, input focus and modal dialogs pause animation; Stopped does not continue the render loop. Still/OS reduced motion remove the canvas and preserve the SVG plus state text. Forced-color mode retains meaningful controls/text and hides decoration. Lost WebGL context returns to the SVG; restoration rebuilds the reflection render target. Unmount releases geometry, materials, reflection resources, WebGL context, observers, listeners and RAF.

## Research and decisions

Read official documentation on 2026-09-21:

- [Three physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): richer material features have per-pixel costs. Use standard metallic rendering and a narrow core shader; do not enable full transmission/dispersion for a small UI object.
- [Three reflection prefiltering](https://threejs.org/docs/pages/PMREMGenerator.html): roughness-aware environment reflections make gold read as metal. Generate a small studio map locally.
- [Three shader materials](https://threejs.org/docs/pages/ShaderMaterial.html): bounded uniforms keep transient motion inside the renderer.
- [Filament materials and light](https://google.github.io/filament/main/filament.html): separate material behavior from illumination; reserve strong highlights for deliberate light angles.
- [MDN audio visualization](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API): future speech motion should sample actual input/output audio. Current previews deliberately do not claim that integration.
- [Animation performance](https://web.dev/articles/animations-guide) and [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): keep peripheral effects bounded and provide user control.

## Validation

Observed results are recorded in STATUS.md. `scripts/orb-audit.mjs` captures the real production UI at 390/768/1440 widths, including GPU and Still versions. Browser tests cover illustrative-state isolation, absence of microphone/API writes, keyboard controls, canvas lifecycle, focus/dialog pause, context loss, reduced motion and layout. Prior conversation, dashboard, security and editor checks remain required. SQL tests still exercise all four unchanged migrations with PGlite's minimal Auth adapter, not real Supabase Auth.

Software-WebGL timing is lab evidence, not physical phone FPS, heat, battery or sustained GPU acceptance. Actual phone/foldable checks remain open. No backend/model/voice/Stripe integration, deployment or push occurs in this phase.

## Next activation boundary

After founder visual review, reconnect the official repository when ready and validate real Supabase Auth/persistence and the existing model adapter. Voice needs a separately reviewed transport, permissions, microphone lifecycle, actual audio analysis, playback interruption and accessible transcript. Never map text-token timing to a claim of speaking, display listening with an inactive microphone, or let a preview replace real request/save/error feedback.

## Observed final evidence — 2026-09-21

- ESLint, strict typecheck and production build passed. 61 unit/SQL/mock SDK tests and 46 browser tests passed.
- Browser checks use headless Chromium with SwiftShader. An accelerated RAF clock separately exercised the sustained-frame-budget fallback; it returned to visible SVG and the composer stayed usable. This is a deliberate stress fixture, not a measured slow physical device.
- Screenshots reviewed at 390/768/1440. No page errors, shader errors or horizontal page overflow. Preview controls also have explicit inner-overflow assertions. The initial audit found and corrected a narrow welcome-row layout and an over-bright purple core.
- Initial home payload: 154,433 encoded JavaScript bytes (+545 vs 1E) and 16,626 CSS bytes (+761). The dashboard still loads no canvas. Full conversation including deferred Three/scene: 331,345 encoded JavaScript bytes. These are local browser resource measurements, not field-transfer promises.
- Final 120-interval RAF samples: phone-width p95 16.8ms / max 16.8ms; unfolded-width p95 16.7ms / max 16.8ms; desktop p95 83.3ms / max 266.6ms with six intervals over 50ms. Desktop reduced its canvas from 300 to 200 pixels during the run. The desktop software-rendered run did **not** establish a smooth sustained frame budget. Physical GPU/device testing remains necessary; do not represent the 30fps target as an observed hardware result.
- Final audit images/JSON are included in the milestone handoff. Full physical-device, actual Supabase and live model/voice gates remain unrun. No push/deployment.
