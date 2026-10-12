# Aethelios Live — Phase 2 implementation receipt

2026-10-11 · `feat/aethelios-live-openai` · protected-preview implementation, not launched.

## Implemented experience

One persistent Live controller shares a creation workspace with Talk, immersive voice and compact voice. Users can propose an image by voice or text, explicitly approve paid generation, see provisional streamed previews, select a completed version, request an edit of that exact version and open the same project/version in Studio. Navigating views or ending voice does not cancel the separately admitted image operation. Existing research and approved Council background work remain available; broader Entity routing and interactive charts/boards remain later phases.

Studio remains the canonical image store and generation service. No new subscription, image provider, agent framework or queue service was introduced. Normal Studio JSON generation remains compatible; streaming is requested only by the Live artifact worker. Cinematic assets and existing voiceovers were untouched.

## Ownership, consent and recovery

The additive migration `20261011230333_live_creation_artifacts.sql` stores owned conversation/project/version references, approval state and selected-image context. Owner-bound RPCs admit proposals, select completed images and atomically claim approved jobs against the existing Studio quota. AI proposals cannot supply an owner or arbitrary edit base. Paid work requires a direct human cost acknowledgement; duplicate claims cannot reserve twice. Existing Studio limits remain authoritative.

An edit captures the server-selected completed version and refuses approval if selection has changed. The generation provider receives that saved parent image. Voice currently receives verified asset metadata, not image pixels; this does not establish visual understanding. Completion reconciles the saved Studio version into the same conversation history exactly once. Conversation deletion leaves the canonical Studio image available.

Private provisional PNGs use owner-checked routes and never become selectable edit targets. Final completion clears preview references; worker cleanup is best effort. Abrupt worker termination can leave private provisional storage requiring maintenance. No public image URLs are introduced.

The image executor uses a separate bounded Next.js `after()` invocation with `maxDuration=300`; it is independent of the voice monitor and research timeout. This is not a crash-safe queue. Stale work becomes uncertain, keeps its paid reservation, and is never automatically regenerated. A late saved result can reconcile on refresh. Production needs a verified execution/recovery policy before release.

## GPT-Live evaluation

The existing gated OpenAI Realtime WebRTC runtime remains the functioning pilot. A separate, tested GPT-Live protocol/REST evaluation adapter implements native `/v1/live/sessions` JSON/SDP admission, `gpt-live-1` client delegation, Cedar/Marin startup choices, overlapping transcript fragments, cumulative seconds usage, context updates, explicit final close acknowledgement and server hangup.

This is not a completed GPT-Live runtime replacement. Account access, header-authenticated sideband transport, real audio, delegation quality, final billing and comparative latency remain unverified. Delegation fragments are provisional context, never action authorization. Realtime cancellation events are not reused as invented GPT-Live commands. No automatic model promotion occurs.

Official documentation inspected:

- https://developers.openai.com/api/docs/guides/live
- https://developers.openai.com/api/docs/guides/live-delegation
- https://developers.openai.com/api/docs/guides/live-migration
- https://developers.openai.com/api/docs/guides/live-conversations
- https://developers.openai.com/api/docs/guides/voice-webrtc?api=live
- https://developers.openai.com/api/docs/guides/voice-server-controls?api=live

## Validation and release gates

Lint and strict typecheck pass. The unit/SQL suite passes **64 files / 438 tests**. Coverage includes ownership and cross-account denial, explicit consent, exact edit target, duplicate reservation, voice-end independence, uncertain/late completion recovery, fragmented image streams and GPT-Live protocol differences. SQL uses PGlite; it is not hosted Supabase/Auth acceptance. Historical migration ledger: 28 files verified. Browser scenarios exist for narrow and desktop approval/image/version handoff but were not executed.

The production build fails at the existing pinned MediaPipe asset download (`EAI_AGAIN`); this runner denies loopback servers (`EPERM`). No camera checks were bypassed. No configured provider credentials or physical devices were available. No real voice latency, image-provider streaming, mobile background audio, battery impact or ChatGPT parity is claimed.

Before hosted preview: apply the additive migration, verify real Auth/RLS/private Storage and current grants, run a successful production build/browser suite, verify hosting lifetimes and cleanup, and exercise actual provider generation/edit/streaming. Existing feature flags remain default off and production admission remains rejected. Measure voice connection/turn/interruption latency and billed costs on representative conversations before considering GPT-Live promotion. In-app minimization is distinct from app switching or screen lock; the latter require physical device evidence.

Next development phase: complete this real-provider acceptance slice and GPT-Live comparison before Phase 3 premium structured visual outputs. Preserve the six-phase roadmap rather than add competing voice systems.
