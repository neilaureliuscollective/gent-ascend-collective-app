# Public Aethelios — Technology Phase 4: conversational planning

## Recovered baseline and research

October 8 (Chicago) / October 9 (UTC), 2026. Reinspected Public repository, PR #68 and hosting. #68 remains open/draft at `f2fe2d967154f485ac5647eafff0bcfb3446b685`, tree `3436b23b0ec331e86d203944c49a9503cb1183d2`, with green Phase 3 CI run 37865691401. This branch starts from that exact remote commit. Main remains `3e826f5e`; the official icon and imperial petrol/black/gold identity are preserved. No parallel replacement app, private Founder work or Reserve changes.

Read-only full catalog preflight on **public** Supabase `volpzkfsnmtztrovexcw` at `2026-10-09T00:59:15.712244Z`: all 25 checked prerequisites correct; all 32 checked additive objects absent. All six release stages are pending, without observed partial application. This is catalog evidence, not hosted behavioral acceptance. No hosted writes occurred.

Primary sources reviewed:

- https://docs.lovable.dev/features/plan-mode — clarify requirements, retain planning conversation and review a proposal before implementation; planning still consumes usage. Native Talk can perform this without another provider or framework.
- https://docs.replit.com/references/agent/plan-mode (redirects to /features/agent/plan-mode) — explore a plan before execution. Keep planning and changing a saved website as explicit separate operations.
- https://docs.lovable.dev/features/preview-toolbar — scoped natural-language edits and manual changes complement each other. Continue to route website edits through Technology's exact-version review/reservation.
- https://supabase.com/changelog — reviewed current breaking/deprecation changes; existing Node 24/SSR adapter is unaffected by Node 20 retirement and unrelated framework adapter deprecations. No package upgrade is required.
- Installed Next 16.3.5 route-handler guide — private, uncached session-bound reads and strict request validation.

## Scope and implementation

1. **Natural business interview in Talk.** Explicit website-planning selection in the existing Tools & context drawer asks at most two missing questions per reply, reuses saved answers, distinguishes facts from suggestions and explains supported service-business scope. It uses the existing bounded Talk model/stream/save path. Planning mode is marked in each saved turn's prompt version and restored from the latest reply when reopening the thread.
2. **Conversation → reviewed creation brief.** A completed planning reply can propose one strict structured brief. A business proposal card presents it without exposing its JSON payload. The owner selects that reply through the conversation's Mission. A private read endpoint validates owner, active Mission, originating conversation, completed status, planning provenance, one bounded proposal, strict schema and safe booking URL. Technology pre-fills editable fields; no project is created by reading the proposal. The user reviews and saves through the existing exact-Mission-revision RPC. The saved source reply remains in conversation history; Mission revision/context provenance is preserved by the existing project. Creating a Mission is still explicit.
3. **Full saved website context in Talk.** An explicitly opened Mission-linked website can opt in through Tools & context to its exact saved brief. The request sends only project ID/revision, never caller-supplied site data. A narrow database RPC checks pilot ownership, current version, live Mission and the originating pending turn, then records an immutable version reference. Foreign, unrelated, detached, closed and stale scopes fail before the reply provider runs. The brief is capped at 13KB database text / 14KB serialized context; it is not truncated or treated as instructions. Personal context remains independently selected; company and Council scopes cannot receive this website context.
4. **Continuation and revision.** Talk proposes changes; selected completed customer requests still pass to Technology for review/application under Phase 3's metered revision controls. Saved website versions, review, static builds, exports, history and recovery are retained. No automatic website writes or publication.

## Cost and security

No second AI call is introduced for parsing/import. Planning follows existing Talk reservations, 120 requests per rolling 24h, 10/minute, one pending turn, 4096 output tokens, two bounded research steps and zero provider retries. It retains the configured Talk model rather than changing billing or routing. Planning and website refinement have separate existing allowances; both are disclosed. Existing generation $1 reservation/$10 UTC month pilot budget, five-project/100-version bounds and uncertain-outcome locks remain. Provider pricing and live model quality still require release reconciliation.

Generated proposals are untrusted data: no generated code execution, packages, remote imagery or HTML. Strict parsing rejects malformed, multiple, oversized and executable-extension proposals rather than repairing them. The new table has owner RLS, SELECT-only authenticated access, composite ownership foreign keys and no client updates. The SECURITY DEFINER capture function has an empty search path, explicit ownership/conversation checks and no anonymous execution. Recorded context refers to an immutable version rather than copying private briefs into another table; saved references survive new website revisions. A reply never promotes business data into global memory.

## Release and rollback

Stacked development PR on #68, not production. Required unchanged sources, followed by the single new additive receipt migration:

1. `20261007190000_mission_continuity.sql`
2. `20261007210000_mission_deliverables.sql`
3. `20261008180000_technology_foundation.sql`
4. `20261008221240_technology_verified_build.sql`
5. `20261009001910_technology_design_engine.sql`
6. `20261009005242_technology_talk_context.sql`

Release preflight checks the sixth table/function, grants/policy and all six source hashes. Preserve the shared hosted ledger and Reserve-owned history; never reset or blindly push it. Roll back Phase 4 code while retaining additive receipt data and all saved website versions. Existing Phase 3 can read/edit those versions; its design-bearing rollback constraints still apply to older releases.

Required gates: exact-head CI with disposable actual Supabase Auth/PostgREST/advisors, protected hosted staging rehearsal with two synthetic accounts, provider quality/cost evaluation, physical Samsung/iPhone review and explicit founder production release decision. No paid staging provisioned, customer billing changed or production promotion performed. READY previews demonstrate builds, not migrations or authenticated hosted acceptance.

## Limits and next phase

This slice is a conversational intake and review bridge for the existing four-page engine. The model may fail to produce a valid proposal; the user can continue clarifying or use existing manual creation. It does not infer confirmed facts, auto-create a Mission, add arbitrary pages/imagery or apply an assistant's suggestions without review. Published hosting/domains and operational forms remain unavailable.

Phase 5 should extend the strict renderer contract with owned page/section composition and owned imagery, then rehearse an integrated release on isolated hosted staging. Prepare owner/project/version/hash/domain/target/budget publication manifests, explicit publish decisions, idempotent deployments and rollback before enabling hosting. Arbitrary application code requires separately approved sandbox lifecycle, networking and spending controls.
