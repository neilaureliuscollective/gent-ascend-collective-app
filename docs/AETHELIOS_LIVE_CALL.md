# Aethelios Live call globe — 2026-10-16

Original-emblem pass on `cursor/aethelios-live-call-globe-1aa9` after reviewed head `c8b447b4d4c8681f812b76bb7bb34e3a5c5434b3`. Axis-tick, Still-resize and capture-lint fixes stay in place. Main/PR152 Talk attachments remain merged. Concept image is direction only. No merge, deploy, credential, Cedar, session-duration or hosted SQL change.

## Planet

The first-pass 640×320 single-color polygon map is the offline fallback only. The interactive globe samples a locally hosted NASA Blue Marble plate:

- File: `public/visual/nasa-blue-marble-land-shallow-topo-2048.jpg`
- Source: NASA Visible Earth image 57752, public domain
- Rights: [NASA_BLUE_MARBLE_ATTRIBUTION.md](../public/visual/NASA_BLUE_MARBLE_ATTRIBUTION.md)

The texture is downsampled to 1024×512, graded to restrained emerald land / obsidian water / cooler ice, then lit with directional wrap, terminator depth, a tight specular and a thin atmosphere. It is not a screenshot of the concept image and does not invent geography.

Latitude uses screen-down `y`, so `lat = asin(-ny)`. `tests/live-globe-projection.test.ts` checks that the top of the disk is north and that Greenland/Scandinavia sit above Cape Horn, with Tasmania southern when Australia faces the camera.

Thin straight ticks outside the globe in the `82cdbc9` production/gallery shots were not a map seam. `liveGlobeSphereCoords` previously clamped `nx/ny` and then tested `r2 > 1`, so axis pixels just outside the disk snapped onto the limb and painted a 1-pixel cross. The disk test now rejects unclamped `r2 > 1`. `ticks-before/` holds the reproduced shots; root captures are the after.

## Emblem

The previous Live composition used the rounded-square install icon `aethelios-official-20261015-512.png` because that was the available reference. That plate is opaque RGB and includes a miniature Earth, so punching it put a second planet on the globe.

Inspected assets: no SVG of the gold A exists in the repository. Crest and lockup are WebP wordmark plates. The founder-supplied original is a 1254×1254 PNG (color type 6) with a real alpha channel, no wordmark, and the exact A + compass star. Live hosts that file as `public/visual/aethelios-original-emblem.png` without rewriting global brand or install icons.

The original already yields a clean emblem: corners are fully transparent, about 75% of pixels are alpha 0, and the gold is not redrawn or font-substituted. Live draws the supplied alpha, shades it with the globe's light, and keeps it upright and clipped to the sphere. A vector original is still preferable for infinite scale; none is in the tree, so this RGBA original is used rather than approximating one.

## Call chrome

Immersive Live keeps the charcoal-glass call stage with circular tappable actions. Compact Talk uses a persistent voice dock above the composer: the existing globe, truthful listening/speaking/muted/connecting status, Mute/Unmute, End and Expand. The full-screen stage labels Minimize rather than Compact. Transcript opens or focuses the Talk conversation timeline when docked, and the live transcript log when undocked. Diagnostics, background-job copy and privacy notes live in a labelled Details disclosure; closed details are inert. Mute state is `aria-pressed`. End is a distinct hang-up action. Scene-switching buttons exist only on the `?mode=live-call-globe` fixture.

Layout changes do not reconnect, restart consent or end the call. Compact docking and Escape-to-compact stay presentation-only.

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

`data-reactive` is `true` only when a measured transport sample is driving listening or speaking. Reduced motion and Still paint one frame. Hidden pages skip the loop. Pixel budget stays at 480.

## Motion and polling

`setMotion` and a `prefers-reduced-motion` listener apply Still immediately without remounting. Hidden pages cancel the single rAF loop. Renderer tests use a nonuniform texture and fixed energy, then compare distinct painted frames while Ambient and unchanged frames after Still or reduced motion settle. Browser tests read the real canvas after assets load. A host `ResizeObserver` paints once when Still/reduced-motion size is stale (CSS or drawing buffer), then disconnects on dispose; it does not restart the loop. `createLiveLevelPoller` reuses `audioLevels()`, takes one sample when Still, pauses while hidden, and drops in-flight results after dispose. No second AudioContext.

## Evidence

`docs/evidence/live-call-globe/before/` is the first-pass fixture at `e11a82b`. Root files are the current production-priority captures. `live-voice-*` uses the real LiveSurface with a fake transport. The webm is a labeled fake-transport tour, not a live OpenAI voice call. Capture waits for `data-earth` / `data-emblem` loaded-or-fallback state instead of sleeping.

## Out of scope

Cedar/Marin voice choice, OpenAI session configuration, authentication, usage limits, transcript filtering/persistence, knowledge continuity, Architect handoff, production merge and deployment. Talk composer height, selected-work chips, attachment truncation and the persistent compact dock are in this pass; they are mocked-transport layout proof, not a physical-device or paid-voice test.
