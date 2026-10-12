# Aethelios Live — Phase 3A visual intelligence

Implementation and research receipt · October 11, 2026 · protected-preview branch, not deployed.

## Delivered slice

The shared creation workspace now supports **conceptual diagrams and comparison boards** alongside existing image creation/editing. Voice can propose either visual through `request_visual_work`; text controls use the same owned artifact workflow. A person reviews the exact request and approves its provider cost before execution. Aethelios can continue talking while a separate bounded worker generates structured data.

Completed diagrams have a system map, selectable component controls, full connection descriptions and expandable detail. Comparisons have selectable options, consideration rows and expandable rationales. Both have conceptual-provenance labels and JSON download. Trusted React/SVG components render text as text; generated HTML, JavaScript, executable formulas and action commands are excluded. No renderer dependency or new service was added. Imperial Obsidian tokens, 44px controls, focus indicators and forced-colors support are preserved. Browser/physical accessibility and visual acceptance remain pending.

Selecting a component or option saves an owner/conversation-bound reference on the existing selection record. The persistent controller retains it through minimize, expand and voice End. Live receives changed selection as bounded, untrusted reference context on its existing three-second workspace poll. The explicit “Explain selected part” control supplies the current returned selection directly, avoiding that poll delay. After voice ends, personal Talk reads the same selected context when the Live feature is enabled. Company Talk never retrieves personal visual selection. Profile context opt-in and unrelated account retrieval are unchanged.

## Provider research and architecture

Official OpenAI Structured Outputs documentation specifies Responses `text.format` with `type: json_schema`, `strict: true` and a schema. It explicitly notes that structured output can still contain mistakes. We therefore validate both schema and relationships: bounded diagram IDs must be unique, edges must reference existing distinct nodes, duplicate connections are rejected, and every comparison row must match the displayed options exactly once. Schema conformance does not verify facts.

The first renderer catalog uses a fixed `conceptual` basis. It does not retrieve external sources, verify figures or imply research completion. Existing sourced research remains a separate approved read-only workflow. Source-backed quantitative charts, scenario formulas, timelines and richer presentation outputs remain later Phase 3 slices.

The GPT-Live delegation guide recommends concise application-state context, selection corrections and quiet `session.thinking.append` updates, with backend work managed separately from speech. This informs the shared context contract. **Existing gated OpenAI Realtime remains the runtime**; GPT-Live is still an evaluation adapter until actual account/audio/sideband/billing and comparative latency tests pass. No ChatGPT parity is claimed.

Sources inspected this turn:

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-Live delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Installed Next 16.3.5 Route Handlers and `after()` documentation.

Supabase's changelog Markdown fetch failed; no Supabase SDK upgrade or new product API is introduced. Current package versions remain pinned.

## Persistence, cost and failure behavior

Additive migration `20261011232952_live_visual_artifacts.sql` extends `ai_conversation_artifacts` and `ai_artifact_selection`; it does not create a competing visual history. It preserves image ownership/version constraints and explicitly prevents sending visual operations through image admission. Completed visual references and bounded readable summaries enter existing Talk history once. Deleting a conversation removes its artifacts/selection; the non-content usage ledger survives deletion.

Visual admission atomically reserves the existing `ai_usage` ledger under the person lock. Existing reasoning caps of 120 requests/24 hours and 10/minute apply, plus one recent running visual per person. No pending Talk turn is created by that reservation, so it does not impose a reasoning-turn lock while visual work runs. Approval is single-claim; rejection incurs no provider request. Model selection comes from existing server `AURELIUS_AI_MODEL` and the existing server-only OpenAI key.

The Responses call uses `store:false`, no tools, no private profile retrieval, a 45-second timeout, a 2,400 output-token cap and a 1 MiB response limit. This controls response storage, not organization-wide retention policy. Model and worker duration are saved; provider-returned token counts update the existing ledger, including known counts on incomplete/refused/invalid results. Costs follow the configured model's actual rates; no fixed per-board amount is invented. Lost/no-usage responses retain unknown token counts rather than false zero-cost claims.

Execution remains a bounded Next `after()` worker, independent of the voice lifetime, not a crash-safe queue. Stale visual jobs become uncertain after two minutes; paid operations never automatically replay. Late completion can still save once. Worker/provider failures preserve the usage reservation. Real hosting lifetime and crash recovery remain production gates inherited from Phase 2.

## Validation

- Lint and strict typecheck pass.
- Full unit/SQL suite: **67 files / 449 tests pass**. Focused final provider/contract/context tests also pass.
- New cases cover cross-account denial, foreign selections, duplicate approval/save, no pending speech-blocking turn, declined cost, stale/late recovery, usage survival after deletion, diagram topology, comparison alignment, literal rendering, bounded selected context, provider refusal/incompletion, known failure usage and controller continuity.
- Historical migration ledger: 28 files verified; new migration loads with the complete migration chain in PGlite. PGlite does not establish hosted Supabase Auth or Storage correctness.
- Narrow and desktop Playwright scenarios are written for approval, selection, refresh, layout and download, but unrun.
- Fresh production build attempt fails in the existing pinned MediaPipe download: DNS `EAI_AGAIN`. Fresh loopback verification returns `EPERM`. Checks were not removed or bypassed.

No provider credentials are configured in this environment. Real model generation, voice/tool continuity, acoustic interruptions, measured latency, billing reconciliation and physical Galaxy/iPhone/DeX behavior remain unverified. Hosted migrations, Auth/RLS/advisors, successful build/browser acceptance and independent expiry/recovery remain launch blockers. Feature defaults and production rejection are unchanged. Cinematic assets, voiceovers and separate repositories were untouched. No production deployment or merge was performed.

## Next acceptance scenario and build

“Show me how this system works” → reviewed diagram proposal → approve → keep conversing → select a component → explain it → minimize → return → End voice → continue by text against the same selected component. Repeat with a comparison option, then select an existing image and confirm its exact-version edit still works. Run against real providers and hosted preview ownership before declaring acceptance complete.

Next build should establish real-provider acceptance and then add **source-backed comparison/chart data**, with provider-returned sources, explicit units, verified provenance and deterministic scenario formulas. Keep the same controller, selection and artifact workflow. Broader coworker/actions and mobile/launch phases retain their existing release gates.
