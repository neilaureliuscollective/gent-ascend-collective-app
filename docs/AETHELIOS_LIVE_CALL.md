# Aethelios Live call globe — 2026-10-16

Finishing pass on `cursor/aethelios-live-call-globe-1aa9` after merging main/PR152 (`e85c2f1`). Previous globe head was `4c9f5d55c7a00d4782d89bce280d06192edc8ea6`. Concept image is direction only. No merge, deploy, credential, Cedar, session-duration or hosted SQL change. Talk image attachments and Studio reference handoff from PR152 are preserved.

## Planet

The first-pass 640×320 single-color polygon map is the offline fallback only. The interactive globe samples a locally hosted NASA Blue Marble plate:

- File: `public/visual/nasa-blue-marble-land-shallow-topo-2048.jpg`
- Source: NASA Visible Earth image 57752, public domain
- Rights: [NASA_BLUE_MARBLE_ATTRIBUTION.md](../public/visual/NASA_BLUE_MARBLE_ATTRIBUTION.md)

The texture is downsampled to 1024×512, graded to restrained emerald land / obsidian water / cooler ice, then lit with directional wrap, terminator depth, a tight specular and a thin atmosphere. It is not a screenshot of the concept image and does not invent geography.

Latitude uses screen-down `y`, so `lat = asin(-ny)`. `tests/live-globe-projection.test.ts` checks that the top of the disk is north and that Greenland/Scandinavia sit above Cape Horn, with Tasmania southern when Australia faces the camera.

## Emblem

Inspected brand assets: every `aethelios-official-20261015-*.png` is opaque RGB (PNG colortype 2, no tRNS). Crest and lockup are WebP plates. There is no SVG or dedicated transparent official gold-A.

**Missing asset:** a transparent or vector official gold-A that can sit in the globe without a plate and without redrawing the mark.

Live therefore composites `aethelios-official-20261015-512.png` inside the sphere by punching the dark plate to alpha. The mark is not cropped. It stays upright and does not rotate with the continents. The same light direction and a soft emerald/gold wash are applied after the punch so the emblem reads as part of the scene. The official mark includes its own star and miniature Earth; those remain because cropping them would damage the mark.

## Call chrome

Immersive and compact Live use charcoal-glass spacing, circular tappable actions and accessible names (`Mute microphone` / `Unmute microphone`, `End session`, `Compact` / `Expand`, `Transcript`). Mute state is `aria-pressed`. End is a distinct hang-up action. Transcript is secondary. Diagnostics stay behind the existing `Voice diagnostics` disclosure. Scene-switching buttons exist only on the `?mode=live-call-globe` fixture.

Compact docking and Escape-to-compact are unchanged.

## Audio

The extra Web Audio monitor is removed. Atmosphere energy reuses `LiveController.audioLevels()` (WebRTC `getStats` `media-source` input / `inbound-rtp` output) and `liveMotionOperation`. These are **transport audio levels**, not proof of audible speaker output. Presentation does not create an `AudioContext`, request a microphone, attach a playback route or open a second voice connection.

## Honest reactivity

| State | Visual | Energy |
| --- | --- | --- |
| Connecting / reconnecting | Restrained rotation, labeled Connecting or Reconnecting | State only |
| Listening | Gentle inward atmosphere | Transport input when measured |
| Speaking | Outward emerald illumination | Transport output when measured |
| Waiting (`responsePending`) | Subtle rest, no speaking pretence | State only |
| Interrupted | Immediate return to listening | New measured input, speaking output dropped |
| Muted / blocked / ended / error | Distinct, quieter or still | Not audio-reactive |

`data-reactive` is `true` only when a measured transport sample is driving listening or speaking. Reduced motion and Still paint one frame. Hidden pages skip the loop. Pixel budget stays at 480.

## Motion and polling

`setMotion` and a `prefers-reduced-motion` listener apply Still immediately without remounting. Hidden pages cancel the single rAF loop. `createLiveLevelPoller` reuses `audioLevels()`, takes one sample when Still, pauses while hidden, and drops in-flight results after dispose. No second AudioContext.

## Evidence

`docs/evidence/live-call-globe/before/` is the first-pass fixture at `e11a82b`. Root files are the current production-priority captures. `live-voice-*` uses the real LiveSurface with a fake transport. The webm is a labeled fake-transport tour, not a live OpenAI voice call. Capture waits for `data-earth` / `data-emblem` loaded-or-fallback state instead of sleeping.

## Out of scope

Cedar/Marin voice choice, OpenAI session configuration, authentication, usage limits, transcript filtering/persistence, Talk composer/scrolling, image attachments, knowledge continuity, Architect handoff, production merge and deployment.
