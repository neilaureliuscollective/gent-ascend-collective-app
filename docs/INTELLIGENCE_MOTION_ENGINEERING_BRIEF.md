# Aethelios Intelligence Motion — engineering and acceptance brief

Prepared October 12, 2026. Companion to INTELLIGENCE_MOTION_CREATIVE_BRIEF.md. This is a proposed implementation plan, not code, a performance receipt or authorization to change production configuration. Local reviewed application tree: `f6f1dd6adceb0999af0994f38bb2590d7bc074a3`, corresponding to released merge `de810ee`. Reinspect canonical main before an implementation task; local provenance commits are not original upstream Git ancestry.

## Renderer decision

Start with **authored SVG/CSS for compact and response-scale geometry, plus one bounded WebGL2 shader for the focal material presence**. Reuse the existing shader/resource-management knowledge, not the broad decorative behavior unchanged. A response-size shader is optional only if the vector version loses material fidelity in the authored comparison and passes the device budget.

Rive is an evaluated alternative if the selected artwork requires a complex designer-authored rig or continuous vector deformation. Do not install it by default. Its authored state/data binding can be useful, but runtime size, feathering/blend costs and context limits require measurement against our specific assets. Lottie supports preauthored segments, but a library of videos/independent loops would make interruptible state blending harder to maintain. Rive and Lottie are alternatives, not two additional engines to install alongside the selected implementation.

WebGPU is not the initial requirement. No simulation, compute workload or geometry scale has been established that needs it. A newer backend is not proof of higher aesthetic quality or faster device performance. Do not add a second Three scene, fullscreen postprocessing, HDR download, video loader or particle cloud simply to describe the work as advanced.

The selection remains subject to the creative study: use the cheapest renderer that faithfully produces the approved object and transitions. All variants share one geometry specification and material tokens. Static fallback must match the selected silhouette, framing and lighting, not substitute a different identity.

## Existing code findings

| Area                                              | Current condition                                                                                                                               | Build consequence                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/platform/visual/intelligence-motion.ts`      | 15-phase snapshot with observed/preview basis, persistence and bounded optional audio                                                           | Keep the contract; geometry cannot create operation states                                            |
| `src/platform/visual/operation-adapters.ts`       | Real request adapters and structural Live mapping                                                                                               | Keep controller boundaries and truthful modifiers                                                     |
| `src/components/intelligence-motion/presence.tsx` | Shared placement/lifecycle, response wrapper and status announcement policy                                                                     | Retain visibility/Still/one-announcement behavior while replacing approved artwork                    |
| `src/components/public/intelligence-orb.tsx`      | One plane/shader, approximately 30Hz pacing, 500px back-buffer cap, DPR cap 1.5, offscreen/document suspension and static context-loss fallback | Useful starting material renderer; replace broad engaged energy with explicit presentation parameters |
| Same orb effect                                   | Resource setup depends on active/engaged/deepGreen                                                                                              | Avoid recreating shader/context on every state or audio update; mount once and update uniforms        |
| `world-energy-renderer.ts`                        | Separate decorative scene policy pauses for any dialog/input, with 480px cap and pressure reduction                                             | Do not blindly reuse this policy for functional Live or an operation visible while typing             |
| `src/domains/live/controller.ts`                  | Six controller phases, cleanup lock, existing transport and measured input/output levels from RTC stats                                         | No new transport, microphone request, permission flow, audio recording or controller phase invention  |
| Studio and Work activity mounts                   | Some feedback is placed above a long editor or form                                                                                             | Test and correct local placement; changing the symbol alone does not establish visibility             |

The current native voice measurements are audio-level envelopes, not pitch or a frequency spectrum. An envelope-reactive contour is supportable. Pitch-driven geometry or a spectrum visualization is outside this build unless separately designed and authorized. When a browser provides no audio level, use zero; do not synthesize sound activity.

## Presentation pipeline

Operation owner → existing observed snapshot → pure motion parameter mapper → selected visual renderer. Status text remains owned by actual operation observations. The renderer may interpolate shape/material parameters but cannot invoke providers, write data, start a microphone, choose progress, infer thinking from elapsed time or dispatch a completion event.

Proposed mapped parameters: phase, energy, focus, direction, aperture tension, accent, bounded measured envelope, motion preference and visibility. Keep this internal presentation structure distinct from public operation/persistence contracts. Unknown phase has a quiet neutral fallback and truthful existing status text; never silently map it to successful completion.

Initial asset/code ownership proposals: a pure phase-to-parameter module in `src/platform/visual`; presentation-only geometry/renderer modules; the existing shared presence wrapper; scoped style tokens. Names are illustrative until the approved artboard determines asset needs. No domain/model/Live-controller imports in the shader engine. Do not embed private prompts, query text, transcript, profile or account identifiers in rendering metadata.

Use stable DOM nodes and GPU resources. Retarget from current parameters rather than remounting for each phase. Audio/sample/render updates use refs/uniforms, not React state per frame. No per-token phase reset. Resource cleanup is independent of business-operation cancellation.

## Observation availability and boundaries

- Talk/company text requests: request start supplies waiting; provider reasoning-start supplies thinking; provider-executed search calls/results supply searching/end; text supplies generating; persistence in flight supplies saving; acknowledgment supplies confirmed completion. Retain `X-Aethelios-Motion` compatibility and model text/finish/source callback contracts.
- Council: whole-request waiting and observed synthesis/output are available. Per-Entity progress is not supplied by a selected cast. Keep any fine-grained worker marks static unless the operation owner provides separate truthful events in a future scoped change.
- Studio synchronous endpoints: waiting until response acknowledgment. Even if an internal provider streams partial images to another consumer, the current Studio UI cannot display generating progress unless its own operation adapter receives those events. Narration/download, footprint creation, local campaign/delivery packaging and document saves must retain their respective observations.
- Queued/uncertain footage and background job records: record state is not continuous live telemetry. Approved work can be waiting; approval itself is not execution. Refreshing a record can animate that read operation, not invent a rendering job.
- Live: map the existing idle/connecting/listening/speaking/ended/error phases. Do not manufacture a native thinking phase from transcript silence or response timing. Preserve muted and playback-blocked behavior, cleanupPending, consent, background permission, expiry and admission.
- A transcript is provisional until existing persistence confirms it. A voice phase transition must not display Saved. Task completion and voice playback are independent observations.

## Terminal and concurrent operations

Persistence is a separate axis. Complete+pending remains Saving. Uncertain persistence never receives the confirmed completion treatment. Cancellation and failure remain distinct even with partial text. Ended voice is labeled Session ended, not a failed model response. Do not clear uncertain-write replay locks through an animation transition.

Late observations retain existing operation-ID guards. The animation must not replay a saved flourish for an abandoned request when another operation is active. Preserve acknowledgment if a subsequent refresh fails. Never defer a terminal label so that a visual flourish can finish.

Live voice and a permitted background task can coexist. The focal voice presentation follows voice phases; task marks follow their own IDs and records. The focal GPU budget prioritizes visible immersive Live; background task marks remain vector/static. Do not collapse several independent operations into one misleading global Thinking label.

## Placement contract by surface

| Surface                                    | Primary location                                                           | Required adverse case                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Talk / compact Talk                        | Current answer, before headers; bounded long-answer visibility             | Delayed headers, long stream, keyboard, revision, cancellation and owner change                                |
| Company conversation                       | Active answer                                                              | Long reply and recovered partial output                                                                        |
| Work deliverable                           | Active save/generate/review controls or an unobtrusive local pinned region | Long editor with controls below the initial viewport                                                           |
| Studio image creation                      | Creation action/result region                                              | Long brief, scrolled form, uncertain response and acknowledged save followed by reload failure                 |
| Studio references/project/brand-kit writes | Initiating control/local record                                            | Upload or save must not be misrepresented as image generation                                                  |
| Storyboard / finish                        | Active scene/document operation                                            | Selected scene changes while request is in flight                                                              |
| Narration / footage                        | Request controls and durable request record                                | Cost approval, download, queued request, failed/uncertain receipt                                              |
| Campaign / delivery                        | Actual packaging/export controls                                           | Local processing must not imply provider generation or public publishing                                       |
| Live immersive / compact                   | Focal presence / persistent controls                                       | Mode switch and navigation preserve one transport; interruption, mute, blocked playback, end and retry cleanup |
| Live tasks / Entities                      | Each actual task/contribution                                              | Awaiting approval is static; no inferred coworker execution                                                    |
| Route/data loading                         | Relevant content region                                                    | Suspense does not imply AI reasoning                                                                           |

One primary focal animation per view. Secondary identity marks remain quiet. Local pinned feedback must not cover essential controls or consume the reading pane. During text selection and deliberate reading away from the latest message, preserve the user's scroll intent. Do not replace current draft, focus, visual-viewport or follow-latest ownership.

## Resource and performance budget

These are proposed acceptance targets, not measured results:

- Baseline focal animation 30fps; consider 60fps only when its visible benefit is demonstrated on representative devices without input degradation.
- Cap the focal back buffer initially at 480px and DPR1.5; reduce resolution under pressure. Preserve CSS dimensions when internal resolution changes.
- Compact marks require no independent GPU context. At most one new operational focal context in an app view; account for existing decorative contexts and prioritize the visible operational one.
- Provisional incremental compressed implementation budget: <=50KB, excluding existing shared framework/runtime. A new dependency above this requires a documented visual/workflow benefit and device measurement.
- No motion-attributable >=50ms long animation frame in the warmed synthetic interaction sequence on the reference device; compare with an identical Still run. Treat this as a diagnostic gate, not a universal performance guarantee.
- Target INP <=200ms on the specified reference setup and no >20ms regression against Still; retain existing application performance gates. Record setup, browser, device and limitations.
- Suspend rendering offscreen, when document-hidden, in Still/reduced motion, or after context loss. Use a matching static fallback during initialization and failure.
- Run sustained 5-minute waiting/voice-fixture sequences, repeated mount/unmount and mode changes; check rising memory/resource counts, lost contexts and input responsiveness. Do not claim battery efficiency from a short desktop trace.

Use supported PerformanceObserver/LoAF diagnostics and DevTools traces where available. Provide alternative frame/input measurement for browsers without LoAF. Physical Fold cover/unfolded, desktop Chrome, iOS/Safari and Android/Samsung Internet need named acceptance results. Emulated viewports establish layout, not hardware GPU/audio/thermal behavior.

## Accessibility and interaction

Still and OS reduced motion retain the same recognizable shape with readable status. Stop deformation and spatial movement; do not merely slow an infinite loop. Forced colors can hide decorative graphics while preserving meaningful text. Maintain existing semantic colors, focus, touch targets, zoom and high-contrast controls. Do not announce every frame or sample; keep one primary status announcement per operation channel.

A voice session's own immersive dialog must not disable its functional presence merely because it is a dialog. An unrelated modal may quiet background decorative activity; active status remains readable. Typing must not globally erase visible operation feedback. No unsolicited sound/haptics are part of this build.

## Build sequence and concrete deliverables

### Phase A — authored identity study (next safe build)

Create the three studies described in the creative brief using the approved artwork as the construction reference. Existing live application stays unchanged. Deliver all phase poses, selected transitions and three sizes in isolated actual-layout previews. Bind explicit synthetic phase and envelope controls. Produce moving capture and still evidence, plus a material/geometry sheet and a default static frame. Measure the proposed renderer's resource footprint. Founder reviews the actual moving object and selects a direction; engineering cannot substitute test counts for this decision.

Exit: selected and approved visual study, compact/focal geometry agreement, source assets and tokens present, recognizable Still/grayscale form, verified response visibility and acceptable initial device behavior. Full sound or shader polish must not be used to conceal a weak silhouette.

### Phase B — state-aware renderer and integration

Implement the approved asset/parameter mapping against existing operation snapshots. Preserve native Live and text contracts. Replace the ribbon presentation progressively at the primary response and actual local task controls. Complete the placement matrix, including scrolled Studio/Work cases. No schema/provider/credential/activation change. Any missing event needed for a new detailed visual must remain neutral until a separately reviewed owner observation is supplied.

Exit: every phase/modifier reachable in labeled preview; observed operations never inherit preview state; interrupts/late events/persistence handled; matching static fallback; no GPU remount per phase; existing drafts/focus/auth/voice/recovery checks pass.

### Phase C — brand, device and release acceptance

Inspect captures from the actual application components at 344/390/768/1440px, enlarged text and short keyboard height. Verify frame change and meaningful visible footprint, rather than checking only data attributes. Require a genuinely bounded long transcript scroll and scrolled action controls. Test Still/forced colors/offscreen/context loss/multiple tasks. Complete physical reference-device traces and sustained sequences. Run appropriate existing connected build, lint/types/unit, Auth/founder, Talk/Work/Studio/Live and full browser gates at the final source. Publish through the existing canonical repository/project and verify exact production source plus custom-domain smoke only when release is authorized.

Exit: creative acceptance and actual interaction/performance receipts are separately recorded. No claim of complete premium identity, physical Fold support or live audio quality is inferred from synthetic screenshots or a passing unit suite.

## Research and evidence ledger

Official/primary sources retrieved October 12, 2026. All numerical budgets above are project proposals.

- [Rive renderer comparison](https://rive.app/docs/runtimes/web/canvas-vs-webgl): renderer fidelity, blend costs and WebGL context tradeoffs. Relevant to an optional authored-runtime decision, not evidence that Rive is always fastest.
- [Rive data binding](https://rive.app/docs/editor/data-binding/overview): application data can drive an authored scene; business event ownership remains outside the artwork.
- [Rive reduced motion](https://rive.app/docs/editor/accessibility/reduced-motion): the author must explicitly connect preferences and reduced-motion behavior; runtime choice alone does not provide accessibility.
- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices): bounded buffers/resources and rendering tradeoffs.
- [web.dev animation guide](https://web.dev/articles/animations-guide): favor composited movement and inspect rendering cost rather than assume animation is cheap.
- [Chrome Long Animation Frames](https://developer.chrome.com/docs/web-platform/long-animation-frames): frame-attribution diagnostics help identify responsiveness and animation stalls where supported.
- [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): preserve control over nonessential motion. This Level AAA criterion is a reference, not an assertion of whole-app conformance.
- [Samsung foldable guidance](https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html): continuity, responsive windows and input retention. Device proof remains separate.

Research limits: published studio case studies and available reference assets were reviewed; private Meta timing/runtime specifications and full interactive reference films were not established. The approved Aethelios seal was visually inspected in the preceding research turn. This preparation contains no new authored motion assets or hardware benchmark. Those are explicit deliverables of Phase A, not silently treated as complete.
