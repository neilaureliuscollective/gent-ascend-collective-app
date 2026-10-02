# Cinematic product entrance — October 2, 2026

Founder approved implementation after reviewing the two supplied product films. ElevenLabs soundtrack explicitly deferred. Scope: `/experience` entrance into the existing world; no account, commerce, database or production-promotion change.

## Research and implementation plan

Official sources reviewed October 2:
- https://web.dev/learn/performance/video-performance — native video, defer bytes, compress media, avoid external player overhead.
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play — playback is asynchronous and may reject; handle the promise.
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video — muted/playsinline, preload semantics.
- Local Next.js 16.3.5 Image documentation; existing adaptive EnergyOrb and appearance lifecycle.

Chosen composition: existing 4.3-second crest awakening → 8.8-second edited product film → 3-second Aethelios arrival → existing world. About 16 seconds in normal playback. One native decoder, H.264/yuv420p, 720×1280, 24fps, faststart, no audio track. Source is assigned only after an explicit Enter/Replay action. No third-party player or new dependency. Desktop retains portrait framing within the existing chamber environment, avoiding crop damage to packaging.

Film edit: Hydros 0–2.8s architecture; Vitalis .3–3.5s product/crest; Hydros 11.5–14.3s product finish. Soft fade joins. Build script records the exact edit; source uploads 1487.mp4 and 1475.mp4 remain unchanged. This is a conceptual brand journey, not documentary evidence of manufacturing or ingredient efficacy. No invented formulation demonstration or claims. No new generated laboratory footage in this milestone.

## Failure and access behavior

- Existing sound preferences remain; original advertisement audio removed so it cannot conflict with the ambient control. ElevenLabs is not connected by this work.
- First Enter plays; a versioned local-only completion/skip preference makes subsequent Enter go directly into the world. Replay is explicit. Storage failure never blocks entry.
- Reduced motion / Still / browser Data Saver bypass the sequence. Skip remains visible throughout; ordinary anchor navigation works without JavaScript.
- Missing/unready video at the end of the crest proceeds into the orb. Playback rejection/error proceeds into the orb. A 20-second total watchdog prevents indefinite stalls. Hiding the tab ends the entrance and pauses playback. Unmount clears animation contexts/timeouts; the orb renderer owns its teardown.
- Film has no dialogue/information needed to use the application. Decorative layers are hidden from assistive technology; status and native links remain available.

## Verification

See STATUS.md for observed checks. Physical Samsung/Safari playback and subjective pacing still require founder review; browser emulation does not prove device performance. Full product films on product detail pages are outside this entrance slice.
