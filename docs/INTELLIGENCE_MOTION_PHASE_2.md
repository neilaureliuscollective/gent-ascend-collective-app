# Aethelios Intelligence Motion — Phase 2 integration

October 12, 2026. Founder requested research and execution of the next build phase after approving Phase 1. Canonical repository remains unchanged. Branch `feat/intelligence-motion-integration` descends from Phase 1 `4b8dad0` and main `c0a7f35`. Candidate only; no production merge/deployment, provider configuration, account permission or database change.

## Research and engineering decisions

Reviewed installed AI SDK 7.0.107 source and OpenAI provider 4.0.72, particularly `stream-text-result.ts` and `openai-responses-language-model.ts`. The provider emits a provider-executed `web_search` tool call when OpenAI reports its output item added and a tool result when it completes. These observations support Searching and a return to Waiting. Reasoning-start supports a Thinking interaction state without exposing reasoning content. Text deltas support Generating. No phase is inferred from the prompt, elapsed time or a percentage.

- [AI SDK streaming reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) and installed source: full-stream events and provider-executed tools.
- [OpenAI Realtime server events](https://developers.openai.com/api/reference/resources/realtime/server-events): response creation, microphone activity and audio-buffer playback are distinct. PR #90 `43d6f3073dc358094c80c7e1c7b60a211813f742` was inspected, including its controller and background consumer. Live admission/cleanup/hosting work remains independent.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): visible, programmatic feedback without moving focus or repeatedly announcing streamed text.
- Existing Next 16.3.5 client/CSS guidance, official palette, orb artwork and React review instructions remain applicable. Direct OpenAI, models, credentials, privacy settings, request consent and content limits are preserved; no Gateway migration.

## Implemented behavior

**Talk and Council:** request dispatch starts Waiting. Actual reasoning/search/text observations update the shared signature; Saving occurs only after generation validation and immediately before persistence. Saved requires the existing saved-turn event. Stop, failed response and unconfirmed persistence remain distinct. The drawer, composer, history, context, memory, ownership, stream text coalescing and recovery lock remain in place. New conversation clears the previous operation receipt. Capability preparation uses Processing only while its existing request runs; it does not claim a persisted save.

**Work:** company conversation and Council coworker requests use the same observed phases. Synchronous deliverable generation stays Waiting until acknowledged. Deliverable writes share Saving/Saved/unconfirmed feedback. An acknowledged save remains confirmed if only the subsequent refresh fails. Approval and exact-request recovery are unchanged.

**Studio:** project/direction saves, reference preparation/transfer/completion, image requests, storyboard writes, composition saves and PNG processing use shared compact activity components. Images remain Waiting because the current endpoint gives no generation lifecycle stream; successful responses follow the existing complete-version persistence RPC. Persisted pending versions say Generation pending / Refresh to check rather than implying an active background renderer. PNG creation completes without claiming a save to the account or successful delivery outside the browser. No image/video/provider/storage behavior changes.

**Identity/loading:** Talk's existing flowing emerald orb is retained as artwork within the shared state signature. The compact toolbar uses its matching static artwork plus CSS motion instead of an additional WebGL loop; the larger request-active drawer retains the existing shader. Branded workspace loading copy/crest/fallback links are unchanged, with a shared loading mark added. No homepage motion was modified.

**Live compatibility:** structural `liveMotionOperation` and `liveJobMotionOperation` adapters are implemented and tested against the latest inspected controller snapshot. Input and output measurements are separate; muted microphone and blocked playback suppress misleading audio motion. Ended sessions say Session ended rather than Saved; approval is not execution. These adapters import no controller, request no microphone and create no transport. They are demonstrated in the isolated gallery. **They are not mounted into unmerged PR #90 in this branch.** Phase 3 reconciliation must apply the presentation adapter to that candidate's existing view/sampling path, retaining its controls and default-off admission. No current voice implementation was overwritten.

## Compatibility and performance

`X-Aethelios-Motion: 1` explicitly opts new Talk/Work clients into activity events. Without this header, server responses retain the original delta/saved/error wire format, protecting older already-open clients (the old Work reader treats any non-error event as a save). Normal authorization and body validation run unchanged before the stream. The header grants no authority.

Provider activity uses an optional callback; the existing `ModelChunk` text/finish contract stays intact for Live background jobs and other model consumers. Callback reports contain a fixed phase only, with no search queries, arguments, reasoning or provider metadata. Reply text, sources, billing usage and persistence are unchanged. Animation does not schedule providers or writes. Repeated text chunks reuse the current motion snapshot; text rendering retains its original coalescing. No dependency, new animation frame loop, fixed progress timer or delay before showing a result.

React review: hooks remain unconditional; operation snapshots belong to the component initiating the request; effects retain cleanup; measured levels are bounded and state text survives Still/forced colors; status sits outside busy task content. CSS motion is transform/opacity. Existing controls/focus and reading space remain. Some older compact Studio/model files were formatted as part of the edit; their unrelated behavior is preserved.

## Review and validation

Standalone synthetic integration artifact: `/workspace/aethelios-motion-integration-review.html`. It mounts the actual Talk, Studio and Work components, uses manually emitted synthetic API events, and labels the entire page as synthetic. No identity, model, microphone, provider or database test is claimed. Generated artifacts stay outside Git.

```sh
node scripts/build-motion-gallery.mjs /tmp/aethelios-motion-integration-review.html --integration
node scripts/component-test-server.mjs
# http://127.0.0.1:3102/motion-integration.html
npx playwright test --config playwright.motion.config.ts
```

The focused browser tests now use explicit fixture URLs and work with both the dedicated motion configuration and the full suite's existing fixture server. They cover phone/Fold-width/desktop phase transitions, withheld save acknowledgment, Stop/draft/recovery lock, Still/reduced motion and synchronous Studio acknowledgment. They are authored but **unrun here**: the fixture listener fails EPERM and the prior Chromium socket restriction remains.

Exact validation results are recorded in STATUS. Unit checks include the real installed SDK/OpenAI adapter with synthetic provider events: real search lifecycle is observed, private search inputs never reach activity output, no save precedes acknowledgment, cancellation never claims completion, and old clients retain their original format. These are synthetic tests, not live OpenAI or hosted Auth acceptance.

Full `npm run build` remains blocked at the existing pinned MediaPipe prebuild download (DNS EAI_AGAIN for storage.googleapis.com). Neither asset preparation nor release checks were bypassed. Browser screenshots, hardware frame rate, physical Samsung Fold/keyboard and live-provider acceptance remain unverified.

## Next phase

Phase 3: render and refine the integration at actual phone/Fold/desktop sizes, profile resource and frame budgets, test real provider cancellation/save uncertainty, reconcile the adapter with the current independent Live candidate, and run exact-source full production/interaction gates before founder release review. Main and production stay unchanged until those gates pass and release approval applies.
