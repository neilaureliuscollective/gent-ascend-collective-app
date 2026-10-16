# Aethelios Live call globe — 2026-10-16

Emerald-gold elevation on `cursor/talk-voice-dock-compact-42b1` after dock head `84e694aa3916eabe4eef2b77aa18d41c3be8ae66`. Compact dock/composer work is preserved. Concept image remains direction only. No merge, deploy, credential, Cedar, session-duration or hosted SQL change.

## Planet

The first-pass 640×320 single-color polygon map is the offline fallback only. The interactive globe samples a locally hosted NASA Blue Marble plate:

- File: `public/visual/nasa-blue-marble-land-shallow-topo-2048.jpg`
- Source: NASA Visible Earth image 57752, public domain
- Rights: [NASA_BLUE_MARBLE_ATTRIBUTION.md](../public/visual/NASA_BLUE_MARBLE_ATTRIBUTION.md)

The texture is downsampled to 1024×512, graded to restrained emerald land / obsidian water, then lit with directional wrap, terminator depth, a tight warm-gold specular, a thin atmosphere and a refined gold rim. The A/star stays the strongest gold focal point. It is not a screenshot of the concept image and does not invent geography.

`gradeEarth` through `84e694aa` snapped `luma > 196 && |R-G| < 24` to flat `[90, 102, 100]`. Bright deserts share that luma/chroma (Nubian 20°N 32°E on NASA 57752 is RGB 255,243,185) and painted as gray digital patches. The diagnostic mask is `docs/evidence/live-call-globe/grade-earth-ice-mask.png`. The current grade keeps relief in luma, warmth in deserts, and a continuous polar lift instead of an ice snap. Geography is not blurred away.

Latitude uses screen-down `y`, so `lat = asin(-ny)`. `tests/live-globe-projection.test.ts` checks that the top of the disk is north and that Greenland/Scandinavia sit above Cape Horn, with Tasmania southern when Australia faces the camera.

Thin straight ticks outside the globe in the `82cdbc9` production/gallery shots were not a map seam. `liveGlobeSphereCoords` previously clamped `nx/ny` and then tested `r2 > 1`, so axis pixels just outside the disk snapped onto the limb and painted a 1-pixel cross. The disk test now rejects unclamped `r2 > 1`. `ticks-before/` holds the reproduced shots; root captures are the after.

## Emblem

The previous Live composition used the rounded-square install icon `aethelios-official-20261015-512.png` because that was the available reference. That plate is opaque RGB and includes a miniature Earth, so punching it put a second planet on the globe.

Inspected assets: no SVG of the gold A exists in the repository. Crest and lockup are WebP wordmark plates. The founder-supplied original is a 1254×1254 PNG (color type 6) with a real alpha channel, no wordmark, and the exact A + compass star. Live hosts that file as `public/visual/aethelios-original-emblem.png` without rewriting global brand or install icons.

The original already yields a clean emblem: corners are fully transparent, about 75% of pixels are alpha 0, and the gold is not redrawn or font-substituted. Live draws the supplied alpha, shades it with the globe's light, and keeps it upright and clipped to the sphere. A vector original is still preferable for infinite scale; none is in the tree, so this RGBA original is used rather than approximating one.

## Call chrome

Immersive Live keeps the charcoal-glass call stage with circular tappable actions. Compact Talk uses a persistent voice dock above the composer: the existing globe, truthful listening/speaking/muted/connecting status, Mute/Unmute, End and a visible Expand caption on phones and short landscapes. The full-screen stage labels Minimize rather than Compact. Transcript focuses the live log inside the immersive dialog, and the Talk conversation timeline when the dock is compact. Diagnostics, background-job copy and privacy notes live in a labelled Details disclosure; closed details are inert. Long details, errors and approval copy scroll as secondary content; Mute, End, Expand and recovery actions stay outside that scroller. The compose region shares a viewport-aware height budget with the dock so the conversation keeps reading space, including with the keyboard open. Attachment filenames shrink instead of covering Remove / Use in Studio; the full name is in a native details disclosure. Truncated selected-work chips use the same disclosure pattern. The presence drawer reports voice-active / muted from the live session rather than a hardcoded microphone-off line. Mute state is `aria-pressed`. End is a distinct hang-up action. Scene-switching buttons exist only on the `?mode=live-call-globe` fixture.

Layout changes do not reconnect, restart consent or end the call. Compact docking and Escape-to-compact stay presentation-only. Mocked-transport tests count microphone acquisitions, peer connections and session-start requests across Minimize, Expand and Escape.

## Audio

The extra Web Audio monitor is removed. Atmosphere energy reuses `LiveController.audioLevels()` (WebRTC `getStats` `media-source` input / `inbound-rtp` output) and `liveMotionOperation`. These are **transport audio levels**, not proof of audible speaker output. Presentation does not create an `AudioContext`, request a microphone, attach a playback route or open a second voice connection.

## Honest reactivity

| State                           | Visual                                                  | Energy                                      |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| Connecting / reconnecting       | Restrained rotation, labeled Connecting or Reconnecting | State only                                  |
| Listening                       | Gentle inward atmosphere                                | Transport input when measured               |
| Speaking                        | Outward emerald illumination                            | Transport output when measured              |
| Waiting (`responsePending`)     | Subtle rest, no speaking pretence                       | State only                                  |
| Interrupted                     | Immediate return to listening                           | New measured input, speaking output dropped |
| Muted / blocked / ended / error | Distinct, quieter or still                              | Not audio-reactive                          |

`data-reactive` is `true` only when a measured transport sample is driving listening or speaking. Reduced motion and Still paint one frame. Hidden pages skip the loop. Pixel budget stays at 480. Listening/speaking ease measured energy over ~160ms; leaving speaking zeros outward on the same `setVisual` so interruption does not keep a speaking highlight.

## Motion and polling

Rotation is timestamp-based at `stamp - last >= 33` (~30fps). Sphere lighting and limb indices are cached; ImageData is reused; host size is measured on mount/`ResizeObserver`, not every paint. `setMotion` and a `prefers-reduced-motion` listener apply Still immediately without remounting. Hidden pages cancel the single rAF loop. Renderer tests use a nonuniform texture and fixed energy, then compare distinct painted frames while Ambient and unchanged frames after Still or reduced motion settle. Browser tests read the real canvas after assets load. A host `ResizeObserver` paints once when Still/reduced-motion size is stale (CSS or drawing buffer), then disconnects on dispose; it does not restart the loop. `createLiveLevelPoller` reuses `audioLevels()`, takes one sample when Still, pauses while hidden, and drops in-flight results after dispose. No second AudioContext. Resolution was not raised and 60fps was not forced.

## Evidence

`docs/evidence/live-call-globe/before/` is the first-pass fixture at `e11a82b`. `emerald-before/` is the dock-complete globe at `84e694aa` (gray desert patches). `emerald-after/` is this elevation at the same initial rotation `0.35` and reduced-motion Still, plus `frame-timing.json` and `emerald-motion.webm`. Root files are the current production-priority captures. `live-voice-*` uses the real LiveSurface with a fake transport. The webm is a labeled fake-transport tour, not a live OpenAI voice call. Capture waits for `data-earth` / `data-emblem` loaded-or-fallback state instead of sleeping. Emulated 884×690 is not physical Fold testing.

Headless Chromium 153 on this cloud VM (Linux 6.12.94+ x86_64, 4× Xeon, 16 GB, not a physical phone or Fold):

- 2.5s 390×844 / 300px buffer: **29.99 fps**, p50 6.3ms / p95 6.4ms (insufficient as sustained proof).
- 30s 390×844 / 300px buffer: **30.00 fps** (901 paints), p50 6.3ms / p95 6.7ms / max 9.8ms.
- 30s emulated Fold 884×690 / 262px buffer: **29.98 fps** (900 paints), p50 4.8ms / p95 5.8ms / max 8.6ms.

Target floors: 28 fps and p95 < 12ms. Typing, mute, speak, interrupt, short-keyboard resize (buffer 160), Still (`looping: false`), hidden-page (`looping: false`; 3 settle paints in 500ms), and Escape-to-compact were exercised on the fake-transport Talk surface. `noUncheckedIndexedAccess` reads packed `lon0[i]` only after an undefined-guard; the cache is densely filled for `0..count-1`, so the skip does not invent a meridian. The prior renderer at `84e694aa` was not remounted for a 30s same-environment baseline. Pixel budget remains 480. Receipt: `docs/evidence/live-call-globe/frame-timing-30s.json`.

## Out of scope

Cedar/Marin voice choice, OpenAI session configuration, authentication, usage limits, transcript filtering/persistence, knowledge continuity, Architect handoff, production merge and deployment. Talk composer height, selected-work chips, attachment truncation and the persistent compact dock are in this pass; they are mocked-transport layout proof, not a physical-device or paid-voice test.
