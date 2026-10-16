# Aethelios Live call globe — 2026-10-16

Reviewable implementation of the premium Live call surface. Concept image is direction only; this is a real responsive interface. No merge, deploy, credential, Cedar, session-duration or hosted SQL change.

## Existing signals reused

The Live controller already owns one WebRTC transport, one `getUserMedia` microphone stream, one playback `HTMLAudioElement`, and truthful phases: `connecting`, `listening`, `speaking`, `ended`, `error`, plus `muted`, `recovering`, `speechDetected`, `responsePending`, `playbackBlocked` and compact/immersive mode. Atmosphere energy prefers a Web Audio tap on those existing streams, then `controller.audioLevels()` (WebRTC `getStats` `media-source` input / `inbound-rtp` output). Presentation never calls `getUserMedia`, never creates a second peer connection, and never restarts a call when the globe mounts, unmounts, minimizes or expands.

## Honest reactivity

| State | Visual | Energy |
| --- | --- | --- |
| Connecting / reconnecting | Restrained rotation, labeled Connecting or Reconnecting | State only |
| Listening | Gentle inward atmosphere | Microphone energy when measured |
| Speaking | Outward emerald illumination | Playback energy when measured |
| Waiting (`responsePending`) | Subtle rest, no speaking pretence | State only |
| Interrupted | Immediate return to listening | New measured input, speaking output dropped |
| Muted / blocked / ended / error | Distinct, quieter or still | Not audio-reactive |

`data-reactive` is `true` only when a measured sample is driving listening or speaking. Slow globe rotation is decorative and is never labeled audio-reactive. Reduced motion and Still paint one frame.

## Integration seams

- `LiveController.mediaStreams()` — read-only access to the current microphone and playback streams.
- `src/platform/visual/live-call-presentation.ts` — state mapping.
- `src/platform/visual/live-audio-tap.ts` — tap/cleanup. Disconnects its own nodes and closes its AudioContext; does not stop shared tracks or connect to the destination, so audible playback stays on the existing element.
- `src/components/live/call-globe.tsx` + `live-globe-renderer.ts` — canvas Earth, official emblem overlay (`brand.conversationEmblem`).
- `src/components/live/provider.tsx` and `live.css` — call chrome only.

Talk workspace, design boards, creation detail, knowledge, Architect and global theme files were not edited. Text-chat `LivingSignal` / `IntelligenceResponse` remain the separate conversation activity indicator.

## Limitations

- WebRTC `audioLevel` can be `0` or delayed in some browsers. The globe then uses the truthful state fallback and does not claim to be audio-reactive.
- The Web Audio tap reads the existing playback `MediaStream` when `srcObject` is a stream. It does not use `MediaElementSource`, so it cannot steal the playback graph. If no stream is attached yet, energy waits for `getStats`.
- An ended microphone is not revived. This task does not fix the separately identified disconnect issue or change the two-minute pilot policy.
- Fixture `/mode=live-call-globe` is a labeled mocked-audio demonstration, not a live voice test. Screenshots and a 33-second state tour are in `docs/evidence/live-call-globe/`.
- Physical Android, iPhone and Fold devices remain unverified; Chromium viewports were used.

## Out of scope

Cedar/Marin voice choice, OpenAI session configuration, authentication, usage limits, transcript filtering/persistence, Talk composer/scrolling, image attachments, knowledge continuity, Architect handoff, production merge and deployment.
