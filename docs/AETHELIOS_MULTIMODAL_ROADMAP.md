# Aethelios — conversational intelligence workspace

Research and build-ready proposal, October 11, 2026. This expands the approved Live initiative; it does not enable or deploy the pilot.

## Product vision

Aethelios is a responsive working environment: a person speaks, thinks, creates, examines evidence and revises outputs inside one continuing conversation. The orb communicates actual state; a shared visual workspace displays the current work. Voice, text, research, images, documents and specialist contributions reference the same owned conversation and selected artifacts.

Examples:

- “Design a futuristic headquarters.” Aethelios clarifies the brief, proposes the image task, then keeps talking while Studio generates. The image appears with progress, version and review controls.
- “Make those buildings taller.” The request targets the selected, completed image version. A revision creates a new version rather than silently overwriting or choosing a different image.
- “Compare three ways to fund this project.” A cited comparison board separates sourced facts from assumptions. Scenario controls recompute explicit formulas; they do not invent live financial information.
- “Show me how this system works.” Aethelios produces a readable architecture diagram with expandable components, then explains the component the person selects.
- “Bring in Prometheus.” An approved contribution appears beside the work while Aethelios remains the conversational coordinator.

Premium means useful composition, legible hierarchy, original green/gold materials, subtle state-driven motion, responsive layouts and meaningful interactions. Reading surfaces, keyboard access, reduced motion and truthful progress take priority over decorative effects. Users should be able to inspect and use every output.

## Research update that changes the next phase

Website research now works through the connected search tool. Earlier SDK-only evidence was incomplete: official OpenAI documentation explicitly describes **GPT-Live** and uses `gpt-live-1`. Its getting-started guide describes full-duplex conversation with a separately chosen backend and duration-based voice billing, with backend/tool costs additional. This is a better architectural candidate for Aethelios's intended separation of conversation and task execution, subject to account availability and actual comparison.

[GPT-Live getting started](https://developers.openai.com/api/docs/guides/live)

The delegation documentation supports client delegation: Aethelios keeps its own orchestrator, approvals, context selection and result handling. It also describes transcript fragments with timestamps and delegation IDs; delegation requests do not themselves contain the complete task utterance. We must correlate application history and task state rather than treating a transcript fragment as a confirmed command. This favors retaining the existing intelligence/backend instead of replacing it with a second agent stack.

[GPT-Live delegation](https://developers.openai.com/api/docs/guides/live-delegation)

Migration is not changing only the model string. The guide directs applications to preserve tool implementations, permissions, durable state and representative baseline conversations, then separate the short voice prompt from backend workflows. Introduce a protocol adapter beneath the existing shared controller; test the new session/transcript/delegation/playback/usage contract before promotion. Keep Realtime as the tested alternative until Live wins on the account's actual quality, latency and cost.

[GPT-Live migration](https://developers.openai.com/api/docs/guides/live-migration)

OpenAI's Responses image tool documents iterative editing and streamed partial images. The inspected Studio already implements owner-checked generation/reference editing and private version storage, but its adapter currently waits for the final JSON image response. Streaming previews are an enhancement to that implementation, not an existing app capability. They improve feedback, not guaranteed final generation speed.

[Image generation and editing](https://developers.openai.com/api/docs/guides/tools-image-generation)

Structured outputs provide a schema-based basis for renderable artifacts. Application schemas and trusted React components should render charts, comparisons and diagrams. Generated UI data still requires semantic validation: numbers need provenance, links need validation, and actions need server authorization. Schema validity does not establish factual correctness or safety.

[Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

ChatGPT's complete product experience and a particular API/voice mode are different capability boundaries. Its Voice FAQ currently lists restrictions on image generation and other tools. The proposed app-level orchestration can connect those capabilities deliberately; it is not a claim that an audio model directly generates every visual output.

[Voice capability boundaries](https://help.openai.com/en/articles/8400625-voice-mode-faq)

## Six phases total

| Phase | Outcome | Release boundary |
| --- | --- | --- |
| 1. Live foundation | Native speech, transcript, interruption, one persistent controller, secure admission and usage reservations | Code exists; real provider, hosting, build/browser and device acceptance remain pending. |
| 2. Live creation workspace | GPT-Live compatibility/benchmark slice; shared artifact surface; voice-triggered Studio generation/revision and readable research; conversation continues during work | Ship one verified image-create/edit vertical slice with owned state, durable job handling and honest progress. Promote GPT-Live only after comparison. |
| 3. Visual intelligence | Interactive charts, source-backed comparisons, diagrams, timelines, plans and presentation previews | Start with a small trusted renderer catalog. No unrestricted generated JavaScript, HTML or arbitrary backend actions. |
| 4. Coworkers and reviewed actions | Richer existing Council collaboration, scoped context handoff, documents/projects and approved record actions | Allowlisted capabilities, explicit grants and confirmation. Future Entities require their own implemented permissions; no invented active financial Entity. |
| 5. Continuity and mobile refinement | Reliable resume, version selection, task recovery, low-bandwidth behavior, Bluetooth/audio lifecycle and Galaxy/iPhone/DeX polish | Distinguish in-app minimization from OS background/lock. Native audio architecture only if real device tests justify it. |
| 6. Production quality and launch | Proven turn-taking, grounded output, cost reconciliation, accessibility, failure recovery and staged rollout | Measured p50/p95, acoustic interruption, duplicate-action checks, crash-safe expiry, retention and commercial usage policies. |

Security, mobile checks, observability and cost measurement run from Phase 1 onward; Phases 5–6 finish them rather than postpone them. Phases are deliverable groups, not six isolated systems or six new services.

## Exact next build: Phase 2

### 2A — verify the conversation/delegation contract

1. Close the existing build/browser/real-Auth runner blockers and establish actual Realtime baseline conversations.
2. Add an OpenAI Live protocol adapter while preserving one controller, API-key handling, ownership, consent, history, cleanup and presentation modes.
3. Verify account access, current voice choices, duration billing and independently enforced session expiry. Compare greeting, pauses, double-talk, subject corrections, interruption and work-in-progress conversations with identical backend tasks. No automatic model promotion or parity claim.
4. Prefer client delegation for the existing reasoning/Council/tool services. Deduplicate delegation IDs, correlate timestamped transcripts and require confirmed operation arguments. Keep long context/backend results outside the voice prompt.

### 2B — one shared artifact surface and Studio bridge

Build a shared conversation artifact contract containing kind, owner/conversation binding, backing record/version ID, status, source references and selected artifact. Reuse existing `ai_messages.parts` / asset links where suitable; Studio remains the source of image/version ownership. Existing project/version/reference IDs and private storage are reused, not replaced by a new image history silo.

The first surface has an image viewer with version selection and revision controls, a cited research card and visible job progress/failure. It adapts between fullscreen conversation, a desktop split workspace and a mobile output sheet. Minimizing or navigating does not replace the selected artifact or transport.

Add reviewed `image.create` / `image.edit` adapters to existing `generateStudio`, `verifyStudioProject`, `imageBlob` and Studio quota functions. Infer conversational intent, then resolve project, selected completed version, requested change and cost consent through app state and server validation. “This image” is an explicit selected version, never an arbitrary latest image across projects. Ambiguous targets require clarification.

Image work can last longer than the current 30-second voice background job budget or two-minute pilot. Decouple artifact jobs from the media-session lifetime before connecting them. Use durable operation IDs, bounded execution, owned status records, uncertain-result handling and recovery. Reuse existing hosting and Studio reservation machinery where feasible. Do not retry a paid operation blindly after a disconnect. Interrupting speech does not cancel approved image work unless the person asks; ending voice can leave explicitly approved artifact work available in the workspace. This differs from the current bounded read-only voice worker, which aborts at End.

Streaming partial images follow the same job identity, are clearly provisional and cannot become editable completed versions until the final result is saved. Worker completion must produce an owned asset reference and explicit save acknowledgement before speech claims creation succeeded.

### Acceptance conversation

> “Create a futuristic city.” → approve → continue discussing its purpose while it generates → inspect the image → “Make the buildings taller” → approve the selected-version edit → see a new version → minimize → open Studio with the same project/version → return to voice without a competing session.

Pass only when real provider output, saved ownership/version links, actual speech continuity, cost reservations, interruption, disconnect recovery and mobile presentation are verified. Also test denied Studio access, foreign project/version IDs, ambiguous selections, duplicate callbacks, deleted conversations, declined approval and partial provider failure.

## Later visual system

Phase 3 extends the same artifact contract with a few useful schemas: comparison board, chart with explicit data/provenance, architecture diagram, timeline and project plan. Each renderer has fixed safe interactions such as select, compare, expand, change a validated assumption, revise and export. Reuse existing company WorkContent/slide/PDF layouts and Studio storyboard/finish services while preserving company versus personal boundaries.

A user selection becomes an explicit bounded conversational reference, allowing “Explain this part” or “Change the second option.” Actual approved app actions go through existing domain services and permissions. Rendered illustration, hypothetical model data and verified external evidence are visibly different. Sandboxed executable artifacts, broader document analysis, selected-image vision and optional native background voice follow only when useful and validated; they are not prerequisites for the first creation slice.

## Build readiness

Next phase has a defined first slice, reuse map, protocol choice to evaluate and acceptance scenario. No application code or production configuration was changed by this planning pass. No duration/price or latency quote is assumed from the earlier Realtime planning scenario for GPT-Live. The prior pilot's unresolved launch gates still apply.

## Phase 2 execution receipt

The approved local implementation connects shared image proposals, paid approval, private streaming previews, exact-version edits and Studio handoff. GPT-Live remains an evaluation adapter, not the selected runtime. Provider/build/browser/device acceptance gates remain open. See [AETHELIOS_LIVE_CREATION.md](AETHELIOS_LIVE_CREATION.md).

## Phase 3A execution receipt

Reviewed conceptual diagrams and comparison boards now share the Phase 2 artifact/selection workflow, with trusted renderers, component/option detail, export and voice-to-text context. This is the first visual slice; source-backed charts, scenario formulas and larger presentation outputs remain. Real-provider/build/browser/device gates remain open. See [AETHELIOS_LIVE_VISUALS.md](AETHELIOS_LIVE_VISUALS.md).

## Phase 3B execution receipt

Source-linked research comparisons/bar charts and bounded hypothetical percentage scenarios now extend the same artifact workflow, with original evidence preserved, explicit units/periods, missing-aware plots and owned selection context. Source linkage is not independent verification. Real provider/build/browser/hosting/device acceptance remains open. See [AETHELIOS_LIVE_EVIDENCE.md](AETHELIOS_LIVE_EVIDENCE.md).

## Phase 4A execution receipt

One existing Council coworker can review an explicitly approved task or captured selected visual part on the shared artifact workflow, with no research/write tools or broader Entity permissions. Record-changing reviewed actions remain Phase 4B. Real provider/build/browser/hosting/device acceptance remains open. See [AETHELIOS_LIVE_COWORKERS.md](AETHELIOS_LIVE_COWORKERS.md).

## Phase 4B first-slice execution receipt

A completed scoped review can now lead to one human-entered, explicitly confirmed personal daily action, using the existing atomic writer, exact current-day/version/source guards and a canonical saved-action receipt. No model write tool or additional model call. Future scheduling and broader actions remain out of scope. Real provider/build/browser/hosting/device acceptance is still open; Phase 5 acceptance is the next priority. See [AETHELIOS_LIVE_ACTIONS.md](AETHELIOS_LIVE_ACTIONS.md).

## Phase 5A execution receipt

Bounded local event diagnostics, item/response correlation, numeric WebRTC health and offline model/voice-cohort reporting are implemented. These support measurement; actual provider/mobile/hosting/acoustic/cost acceptance remains open and is Phase 5B. No new service or model promotion. See [AETHELIOS_LIVE_ACCEPTANCE.md](AETHELIOS_LIVE_ACCEPTANCE.md).

## Phase 5B first-slice execution receipt

Verified actual Vercel OpenAI credential scopes and absent Live deployment/flags; hosted catalog checks confirm pending Live schema on the matching Gent database. Built founder-only hosted preflight using the existing key and a bounded read-only metadata check. No remote writes, voice enablement or production release. Non-production integration preview/database binding, migration rollout and real audio/device acceptance remain next. See [AETHELIOS_LIVE_HOSTED_PREFLIGHT.md](AETHELIOS_LIVE_HOSTED_PREFLIGHT.md).
