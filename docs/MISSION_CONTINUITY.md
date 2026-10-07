# Public Aethelios — Mission Continuity

Founder authorized implementation on October 7, 2026 after the Mission Continuity research/approval plan. Scope is the PUBLIC `gent-ascend-collective-app`, never the private Founder platform.

## Delivered behavior

- Talk discovers the selected conversation's Mission and offers a visible, independent Mission-context switch. New Talk lists up to three recent active Missions. Opening a Mission sends no model request and pastes no generated continuation prompt.
- Each requested turn captures the exact reviewed Mission revision in an owner-bound receipt before model work. Context includes bounded pinned-response excerpts and the linked Studio brief, labeled as records and prior suggestions; images are not claimed as visually inspected. Personal context remains separately controlled. Company rooms reject personal Mission context.
- A user can request one bounded direction proposal from the latest completed turn. Existing auxiliary proposal quota reserves its request ID. Strict structured output keeps title, objective, decisions, open questions and next action separate; no status/completion authority. Proposals have source-turn IDs and base revisions. Review allows edits, acceptance or dismissal. Atomic acceptance detects stale revisions and safely replays the same decision; changed replays fail. Successful proposals record provider token counts and elapsed time. Provider failures do not change direction.
- Pinning a completed same-conversation reply is idempotent. Pinned text stays a reference to its canonical turn, not a copied transcript.
- Creative preparation atomically creates one personal Studio project and link per Mission from bounded reviewed direction. Generation remains an explicit Studio action with existing access checks. URL project selection survives refresh. Studio links back to its Mission, whose outputs show saved image versions and pending/failed states. Existing company Studio and job records remain separate.
- Mission overview leads with direction, next move and outputs; manual editing remains under details. Mobile Talk expands Mission details into a scrollable overlay; ordinary Talk remains visible when collapsed. Existing viewport, keyboard and appearance infrastructure is retained.
- Touched public/account copy now describes a Personal Intelligence OS and removes men-only account/about language. No palette assets, theme tokens, membership IDs, billing rules or lifestyle records were changed. A separately requested Aether Petrol brand build was not present on inspected main; this implementation uses existing theme variables.

## Data and ownership

Additive migration: `20261007190000_mission_continuity.sql`. Adds `mission_proposals`, `mission_studio_links`, `mission_outputs`, and `mission_turn_context`, all RLS-protected with owner-only SELECT. Writes use narrowly scoped session-resolving RPCs; there is no caller-supplied person identity or direct client write grant. Composite references and source-turn checks preserve scope. A separate link table avoids changing ownership or lifecycle of existing Studio projects. Deleting a Mission removes its associations/proposals/context receipts, retaining its conversation and Studio assets.

Apply this migration before deploying application code. Rolling back code leaves additive records intact. Never reset or seed a hosted database. No production migration or deployment was performed in this phase.

## Preserved and intentionally deferred

Auth, current capability/billing rules, confirmed global memory, normal chat streaming/receipts, Council roster/cast review, company jobs, versioned deliverables, Studio references/refinement and legacy data remain in place. No external executor, background delegation, autonomous memory extraction, new specialist, 3D Council World, general file ingestion, pricing change or model-routing overhaul.

Initial Mission creation still prefills the user-authored objective through the existing review dialog. AI-assisted updates start after a Mission exists and use the selected latest completed turn plus reviewed direction, not a universal historical search. The public 6,000-character input contract remains. The company job system is not migrated into personal Missions. Dollar-cost routing and failed-provider token reconciliation are not introduced; successful proposal receipts record tokens and timing without claiming a billing invoice.

## Research applied

Reviewed existing Mission/Council/Studio/company-work source, the approved plan, and installed Next 16 route-handler and data-security guides. Prior research remains applicable:

- https://www.anthropic.com/engineering/building-effective-agents — simple composable workflows before expanding autonomy.
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — bounded relevant context and lightweight record references.
- https://docs.langchain.com/oss/javascript/langgraph/persistence — distinguish thread continuity from global memory; no framework migration needed.
- https://www.nngroup.com/articles/onboarding-tutorials/ — contextual help at the useful moment.
- https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard/overlaysContent — limited browser support; preserve existing viewport handling.

## Verification

See the latest receipt in STATUS.md. SQL tests exercise all migrations in PGlite, owner isolation, stale updates, decision replays, pending-output rejection, Studio handoff replay, denied direct binding mutation and deletion preservation. Service tests verify explicit Mission scope, personal-context independence, company/cross-conversation rejection and stale-context failure before model work. Browser fixtures use synthetic accounts and intercepted responses; they do not prove real hosted Auth, Storage, provider quality or physical-device behavior.

Release acceptance still requires real two-account PostgREST/Auth journeys, live model/Studio evaluation, physical Fold/iPhone/DeX keyboard checks, the existing operational launch gates and separately approved deployment. The current implementation is a reviewable build, not a public-launch certification.
