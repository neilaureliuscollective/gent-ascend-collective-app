# Public Aethelios — Project Entities

Research and read-only audit: October 9, 2026. Proposal only; product implementation, migration, merge and release are not authorized by this assignment. Detailed next build: [ENTITIES_NEXT_PHASE.md](ENTITIES_NEXT_PHASE.md).

## Recommendation

Build **E1 — Launch Core Recovery & Acceptance** first, **E2 — Entities Advisor V1** second, and **E3 — Paid Launch & Operational Readiness** third. Current production cannot admit a new public account through the inspected entry paths. More agent screens would not repair that. Recover the existing account/deliverable candidate rather than rewriting it. Preserve the eight-phase Technology stack for its own subsequent activation; its previews are not shipped website publishing.

Entities are the approved public product name. Aethelios coordinates the Intelligence Network; Entity Studio configures a customer's specialized intelligence. Private Aethelios Coworkers and Legacy Reserve products are outside this proposal. Existing internal API/database identifiers need not be renamed.

## Evidence and limits

Verified repository: `neilaureliuscollective/gent-ascend-collective-app`, default `main`. Latest observed production/main commit: `bc0e561d516267ff6f7467ffeaff5813fd0dbb3c`. GitHub Production deployment `6965856894` reports success at `https://gent-ascend-collective-k0y1380tp-stutes-legacy.vercel.app`, associated with the existing `gent-ascend-collective-app` Vercel project. Direct inspection used `https://www.gentascend.com`. Main and the previously validated icon commit `7ebb82e` have identical Git tree `9f077cbe7bdb2e6fcba857ca9ff59d34a07cab35`.

This assignment verified GitHub history/PRs/deployment receipts, public pages/APIs, source code and anonymous zero-row Supabase metadata probes. It did not log in as a customer, send a production model request, create a Stripe checkout, query customer records, modify any database, or operate the private product. No Vercel management or Supabase management connector/token is configured in this session; therefore current project environment settings, complete migration catalog, advisor findings, plan/quotas, Auth-provider settings and billing configuration remain unverified. Public connection credentials in source are publishable configuration, not administrative access.

Closed entry gates are intentional fail-closed behavior, not proof of a broken Auth implementation; they still prevent public launch.

Production observations:

| Observation | What it establishes |
| --- | --- |
| Home, Talk, Studio, Missions, Account, Membership, Join and Support return 200 | Public/signed-out surfaces render; inspected 360px pages have no overflow or page errors; home/Talk/Studio also passed 820px and 1440px read-only layout checks. This does not prove authenticated workflows. |
| `/api/account/auth`: `ready:false`, `google:false` | The free account configuration gate is closed. The exact missing flag/service setting cannot be identified without hosted configuration access. |
| `/join`: public registration not open; invited members may sign in | The separate membership registration gate is also closed. Avoid creating a third account system. |
| `/support`: contact unconfigured; whole-account data requests unavailable | A real support/data-rights process is not established by the live experience. |
| `/privacy`, `/terms`, `/app/library`: 404 | These routes are unavailable in the current release; Library is present in unmerged recovery code. No claim that external legal policies cannot exist elsewhere. |
| Private Talk/Studio/Missions APIs: 401; `/dev`: 404 | Anonymous access and hosted harness entry fail closed. Not a two-user RLS audit. |
| Supabase Auth health: 200 using existing publishable configuration | Public project `volpzkfsnmtztrovexcw` is reachable. Not proof of email delivery, account recovery or provider settings. |
| Zero-row `ai_conversations`, `intelligence_missions`, `mission_proposals`: permission denied; `ai_studio_projects`: empty success | Responses only; no personal rows requested. Empty success is not proof of a privacy defect or verified isolation. |
| Zero-row `mission_deliverables`, `technology_projects`: `PGRST205` / 404 | These resources are unavailable in the exposed REST schema cache. This does not conclusively prove their physical tables are absent. |

The recorded October 8 catalog says `mission_proposals` was absent, but the current endpoint returns a permission denial rather than the missing-resource response. Do not reuse that snapshot as current migration evidence. Obtain a fresh read-only catalog and compare contracts before deciding which additive migrations remain necessary. Source records a shared ledger with five Reserve-owned migrations; never reset or blindly push the local history.

## What exists in main

| Capability | Implementation evidence and actual boundary |
| --- | --- |
| Identity and onboarding | Supabase SSR session verification, person mapping, password member registration/sign-in, email-code free account entry, optional Google entry, claim/onboarding state and server access checks. Public gates currently closed; no password-reset completion flow found in inspected auth code. |
| Aethelios conversation | Direct OpenAI Responses via AI SDK 7; streamed replies, persisted turns/messages, history/search/archive, revisions, cancellation, thread summaries, title generation and explicit saved acknowledgement. Failed/uncertain work must not claim a save. Hosted live-model quality/persistence not tested here. |
| Research | Provider web search, bounded calls and returned-source footers. Retrieved text is untrusted. The prohibition on private search queries is currently prompt guidance, not a demonstrated hard query filter. |
| Specialist bench | Athena, Prometheus, Apollo, Hermes and Themis have explicit lenses. Table makes 2–3 independent contributions and a synthesis. This is genuine bounded model-call orchestration, not autonomous external execution. |
| Context/memory | Person-owned confirmed memories, opt-out context, bounded recent history and summaries. Main's saved-source control is broad; granular category consent exists in PR #64. Company conversations explicitly disable person-wide context and use immutable company brief snapshots. |
| Actions | A completed saved turn may produce a daily-action proposal; a separate approval executes a typed, transactional/idempotent RPC. Creative/workout/Presence orchestration prepares drafts. No general external-action registry or scheduler is present. |
| Missions and company work | Persistent owner-linked directions, revisions and conversation continuation; company rooms/jobs and image work exist. Main does not provide the recovered retained document/Library flow. |
| Studio | Real image generation/edit adapter, private references/assets, project briefs, lineage, storyboard image frames and finished PNG composition/export. No verified video generation, music/audio service, PPTX/PDF presentation export or general document/file ingestion in this release. A storyboard is not a generated video. |
| Commercial controls | Capability policy, beta/founder grants, Stripe checkout/portal/webhook implementation, replay/serialization controls and readiness reporting. Free membership does not currently imply AI access. Live checkout/renewal/failure/cancellation remain unverified. |
| Usage | Atomic 120 turns/day and 10/minute guard, auxiliary 60/day and 5/minute guard, Studio 12/day, concurrency/idempotency controls and token receipts. Request counts are not a verified monthly dollar cap. Multiple Table calls, web search, images, drafts and unknown failed-call costs need complete attribution. |
| PWA/UX | Three primary destinations: Talk/Work/Studio; premium steel/carbon/green materials and stone editing surfaces; new gold/green/steel install assets; standalone entry and static offline fallback. Physical Fold/iPhone installation/session acceptance remains unverified. |

Sources: `src/domains/intelligence/{agent,service,stream,research,council-model,actions,orchestration}.ts`, `src/domains/studio/`, `src/platform/openai/image.ts`, `src/domains/{identity,onboarding,access,billing}/`, current migrations and route/component implementations. Code supports a capability; it does not alone certify its production operation.

No custom Entity configuration tables/services or customer Entity creation flow were found in main. The existing `src/components/public/intelligence-network.tsx` is explicitly decorative relationship geometry, not a working Entity registry. Existing specialists and Table are the reusable starting point.

## Work recovered, not rebuilt

PR #64 (`af89b7615cd65a3c2c5da84e252fe895bc6a4205`) includes Mission continuity/deliverables from #62/#63, saved-work Library, granular saved-source consent, inclusive personal/professional positioning, retired private-link handling and actual account acceptance tooling. Both application/database checks report success at its own head. GitHub reports it **conflicts with current main**. Its former petrol styles/older shell must not overwrite Imperial Steel. #62/#63 are ancestors of this candidate; do not integrate them twice. PR #60 is selectively reconciled there, not a separate mandatory wholesale import.

Recovered Technology stack:

| Phase | PR | Code present on the unmerged stack |
| --- | --- | --- |
| 1 | #65 | Owner-scoped creation foundation, reviewed website briefs/versions and bounded generation reservations |
| 2 | #67 | Recoverable, verified static website builds |
| 3 | #68 | Conversational revisions and versioned design |
| 4 | #69 | Business planning and website-aware Talk proposals |
| 5 | #70 | Flexible informational pages |
| 6 | #71 | Owned image import, retained assets and publication-readiness checks |
| 7 | #73 | Reviewed/revocable static-site release packages and ZIP export |
| 8 | #74 | Deployment-bound real account/creation acceptance tooling; no additional migration |

Phase 8 head `ff710f24764885731d8dbef23ab992a1835c81e3` has successful application/database checks and Vercel status. Seven Technology migrations plus two Mission migrations are present in the cumulative source. Their complete live application state is unverified. The candidate's publication adapter is disabled: downloadable packages do not mean customer sites are deployed. Separate PR #72 integrates Reserve schedules/controlled proposals and is outside this public Entities phase. Older open PRs may already be ancestor-integrated; open status alone does not prove missing capability.

## Research: practical patterns worth adopting

Reviewed maintained official GitHub sources on October 9. Direct OpenAI/Anthropic/Microsoft Learn/Google documentation hosts were denied by the environment proxy; official source repositories were accessible. These are implementation/documentation findings, not commercial product hands-on tests or verified vendor pricing.

| Platform | Practical architecture / customer pattern | Aethelios decision |
| --- | --- | --- |
| OpenAI Agents SDK | Instructions + registered tools; manager-as-tools versus handoffs; session persistence; serializable paused runs for approval; guardrails and traces. Tool approvals are not a replacement for application authorization. Traces can contain model/tool inputs and outputs. | Retain AI SDK and Supabase; adopt explicit versioned instructions, bounded manager orchestration, pause/approval semantics and redacted execution receipts. Do not add a second SDK merely for naming. |
| Microsoft Copilot Studio | Low-code authoring combines knowledge, topics, tools/connectors, channels and managed governance. Official references distinguish conversational/user actions from autonomous flows; metrics and per-agent credit limits make operation visible. | Offer a guided responsibility-first setup and clear connected-tool cards. Keep permission, connection health, task success and costs visible; hide infrastructure jargon. |
| Anthropic | Official cookbook separates predictable workflows from orchestrator-workers. Dynamic delegation suits genuinely variable subtasks and adds latency/cost. Agent SDK examples demonstrate custom tools/MCP, safety hooks, session resume and hosted execution. | Start with deterministic, bounded flows and the existing specialist bench. No open-ended swarm, shell or browser executor for Advisor V1. |
| Google ADK | Separate session state from long-term memory; orchestrate through workflow components/graphs; tool confirmation pauses execution. Confirmation docs explicitly label the feature experimental. | Keep application-owned records and explicit memory confirmation. Do not assume prototype memory is durable or depend on experimental framework confirmation to secure a write. |

A differentiator is continuity from an Entity's conversation to an owned, reviewable Mission/document/creative asset, with clear scope and accountable results. A gallery of personalities alone is insufficient. Existing Table already demonstrates bounded specialist collaboration and does not need a new orchestration platform.

### Source register

- OpenAI source revision `125efa029b4bfd84238bd2c4fd69c3406f802663`: [agents](https://github.com/openai/openai-agents-python/blob/125efa029b4bfd84238bd2c4fd69c3406f802663/docs/agents.md), [tools](https://github.com/openai/openai-agents-python/blob/125efa029b4bfd84238bd2c4fd69c3406f802663/docs/tools.md), [approvals](https://github.com/openai/openai-agents-python/blob/125efa029b4bfd84238bd2c4fd69c3406f802663/docs/human_in_the_loop.md), [orchestration](https://github.com/openai/openai-agents-python/blob/125efa029b4bfd84238bd2c4fd69c3406f802663/docs/multi_agent.md), [sessions](https://github.com/openai/openai-agents-python/blob/125efa029b4bfd84238bd2c4fd69c3406f802663/docs/sessions/index.md), [tracing](https://github.com/openai/openai-agents-python/blob/125efa029b4bfd84238bd2c4fd69c3406f802663/docs/tracing.md).
- Microsoft documentation revision `421a5efd74cef61e62c1a50cd84aa201dc2b0bdf`: [reference architectures](https://github.com/MicrosoftDocs/power-platform/blob/421a5efd74cef61e62c1a50cd84aa201dc2b0bdf/power-platform/architecture/products/copilot-studio.md), [monitoring](https://github.com/MicrosoftDocs/power-platform/blob/421a5efd74cef61e62c1a50cd84aa201dc2b0bdf/power-platform/admin/monitoring/monitor-copilot-studio.md), [consumption and limits](https://github.com/MicrosoftDocs/power-platform/blob/421a5efd74cef61e62c1a50cd84aa201dc2b0bdf/power-platform/admin/manage-copilot-studio-copilot-credits-capacity.md). [Official authoring samples](https://github.com/microsoft/CopilotStudioSamples/tree/6ee7fd5d9fa9b9c9f7bd9eee51311552d9b195ed).
- Anthropic source revision `d7265d6ae994ccd8429db0594b000073b2f9ad43`: [workflow patterns](https://github.com/anthropics/anthropic-cookbook/tree/d7265d6ae994ccd8429db0594b000073b2f9ad43/patterns/agents), [orchestrator-workers](https://github.com/anthropics/anthropic-cookbook/blob/d7265d6ae994ccd8429db0594b000073b2f9ad43/patterns/agents/orchestrator_workers.ipynb), [Agent SDK examples](https://github.com/anthropics/anthropic-cookbook/tree/d7265d6ae994ccd8429db0594b000073b2f9ad43/claude_agent_sdk).
- Google documentation revision `57e34aae019b97da72b6d739f5842781bca3278c`: [memory](https://github.com/google/adk-docs/blob/57e34aae019b97da72b6d739f5842781bca3278c/docs/sessions/memory.md), [confirmation](https://github.com/google/adk-docs/blob/57e34aae019b97da72b6d739f5842781bca3278c/docs/tools-custom/confirmation.md), [workflow agents](https://github.com/google/adk-docs/blob/57e34aae019b97da72b6d739f5842781bca3278c/docs/agents/workflow-agents/index.md). This revision notes Python/Go ADK 2.0 graph/dynamic workflows supersede template workflows; no dependency decision is based on old API assumptions.

## Entities architecture

### Navigation and customer experience

Keep Talk/Work/Studio as primary navigation. Put **Intelligence Network** under Talk, replacing the scattered Team discovery entry with a cohesive destination at proposed `/app/entities`. Keep existing specialist names and legacy receipts. No fourth primary navigation item until usage justifies it.

Network starts with My Entities and a small template set adapted from the existing specialists. Cards show responsibility, actual capability level, last saved activity and connection/usage status. Activity comes from persisted turns/receipts, never fictional live work.

**Entity Studio** is the Network's creation/edit flow (`/app/entities/new`, `/app/entities/[id]/settings`), distinct from media Studio. The first flow asks: what should this Entity help with, what should we call it, how should it communicate, and what boundaries should it respect? Preview the summary, save, then open a real conversation. Advanced settings follow progressive disclosure. No workflow graph editor, API key field or twenty-setting dashboard.

### First complete release: Advisor V1

A real eligible customer can create, save, edit, archive, reopen and converse with one custom Entity. Templates prefill useful roles; a blank custom role is supported. Store purpose, responsibilities, style, bounded instructions and user-written knowledge notes. Use the existing provider and chat renderer/history/save acknowledgements. Selected shared sources remain off by default. Knowledge files, arbitrary integrations, recurring work and custom multi-Entity delegation are deferred; do not present disconnected controls as enabled features.

Initially expose one approved model policy with server-owned limits. A simple Balanced/Deep choice can follow provider evaluation; raw model IDs are not an onboarding requirement. No new provider is required. Public product copy may introduce “Meet your Entities”; execution/evolution claims must describe actual implemented capability rather than imply background agency.

### Capability levels

| Level | Authority and proof required |
| --- | --- |
| Advisor | Research, analyze, draft and recommend; no external writes. Reply persistence is application storage, not an autonomous business action. |
| Operator | One or more real allowlisted tools, owner-bound connections, explicit action preview/approval and durable execution receipts. Start with an existing internal reviewed action before adding an external connector. |
| Autonomous | Explicit standing scope, schedule/expiry, budgets, durable execution/recovery, pause/revoke, activity notifications and exception escalation. Consequential new scope still requires approval. |

Capability level is server-calculated from implemented tools/policy, not a customer's editable title or personality. Operator/Autonomous must stay unavailable until these contracts work.

### Minimal data and shared runtime

Proposed Advisor schema, not a migration in this assignment:

- `ai_entities`: owner `person_id`, id, name, purpose, template reference, current revision, status/archived timestamp; configuration writes use optimistic concurrency.
- `ai_entity_versions`: immutable owner/entity/revision configuration, instructions/knowledge-note snapshot and server-approved policy reference. Composite owner/entity/revision keys prevent foreign configuration links.
- Extend `ai_conversations` with nullable owner-bound Entity reference; null retains Aethelios and legacy conversations. Existing company scope remains explicit and cannot acquire person-wide memory through an Entity.
- Extend turn reservation/receipt with immutable Entity version/policy/model references, resolved by the server from the owned conversation. The client cannot choose ownership, grant authority or substitute another Entity's configuration.

Reuse `ai_turns`, `ai_messages`, `ai_usage`, summaries and existing APIs rather than duplicating chat tables. A small Entities domain loads configuration; shared intelligence service composes invariant safety/identity rules and the versioned role. Existing configuration and tenant guards remain authoritative even when custom instructions are hostile. No independent vector database, agent database, worker fleet or service-role user access is needed for V1.

Archiving preserves chat and provenance. Hard deletion/export must join the account lifecycle contract rather than silently strand records. Changing configuration does not rewrite prior answers; new turns record the new revision. Changing conversation identity requires a new owned conversation, preventing accidental context mixing.

### Context, knowledge and memory

Keep separate: conversation continuity, Entity instructions/notes, explicitly selected shared memories/profile, company brief, and future document retrieval. Do not auto-promote model replies into memory. V1's Entity-specific notes are user-written configuration; future Entity memories require explicit confirmation and owner/Entity scope. Private Coworker data is never a source.

General file ingestion is not present in main. Later knowledge support must add validated file types/sizes, private owner storage, parsing/sandbox limits, document provenance/deletion and scoped retrieval. Do not reinterpret image reference upload as general PDF/RAG support.

Search-query privacy must be enforced at the application/tool boundary, not only by prompt. Before allowing public search alongside private sources, use a bounded generic-query research stage with no private transcript/context, or keep that combination unavailable until a measured safe contract exists. Turning sources off does not erase private text already supplied in the same conversation.

### Tools, permissions and execution

A shared registry defines tool name/version, input schema, read/write class, capability requirements, approval rule, cost/time bounds and executor. The permitted set is the intersection of implemented tools, account entitlement, owner connection scope, Entity policy and per-run authorization. Neither a model nor a template can expand it. MCP is a protocol adapter, not an authorization system.

For Operator: persist proposed action and exact arguments/source revision; user approves; server rechecks current connection/policy/version; executor records provider result. Use provider idempotency when supported. A timeout after external execution is **uncertain**, not safe to replay automatically. Reconcile before retry. Never promise universal exactly-once delivery across external services.

Store scoped OAuth credentials encrypted/server-side with revocation and refresh; do not send tokens to models. Existing person-bound actions provide the approval pattern, but are not automatically a general-purpose connector system.

### Collaboration and recurring execution

Aethelios is the customer-facing coordinator; a shared bounded execution service is the technical coordinator. Initially reuse the Table's deterministic cast/contributions/synthesis. Later use a reviewed plan, explicit participating Entity IDs, minimal context packets, parent/child receipts, max depth/steps, deadline and one shared budget. Delegation passes narrower authority; it cannot bypass approvals or share another company/person's records. No recursion or hidden permanent workers by default.

Autonomous work needs a durable scheduled job, claim/lease, retry/uncertainty handling, policy revalidation, approved credential context, receipts and pause/revoke before launch. A browser timer or an unawaited Vercel function is not a scheduler. Select a minimal existing-platform mechanism only when a useful recurring responsibility is approved; do not buy a queue now.

### Observability and cost

Expose last run, status, source/output links, model policy, elapsed time, allowance usage and pending approvals. Logs contain identifiers/stage/error class, not prompts, files, credentials or personal context. Entity activity is an owner-filtered projection of existing turns; detailed run/tool tables arrive with actual Operator workflows.

Apply shared person/project budgets across Aethelios, Entities, Table, titles, summaries, actions, images and retries. Reserve conservative bounded cost before calls; account for each child/tool call; reconcile actual usage with a dated provider price schedule. Unknown failed-call spend remains unknown/reserved, not zero. Prevent parallel Entities from multiplying allowances. Measure quality/cost before changing the production default model. `store:false` is a request setting, not proof of zero provider retention.

### Premium identity

Reuse Imperial Steel, Carbon Shadow, Imperial Green, Reserve Gold and architectural ivory/cream tokens/components. Use subtle abstract glyphs/signatures and role-specific geometry, not cartoon robots or duplicate metallic orbs everywhere. Steel/green navigation and identity frame stone editing surfaces; gold is selective. Prefer CSS/static SVG, reduced-motion fallbacks, visible focus and verified contrast. Motion may indicate a real request state; never portray idle Entities as secretly working.

## Launch gaps and severity

| Severity | Confirmed issue or unverified gate | Smallest response |
| --- | --- | --- |
| Launch-blocking, confirmed | Public entry gates closed | Reconcile/validate the existing account paths and enable only a tested bounded beta policy. Do not just flip flags. |
| Launch-blocking, confirmed live UI | Support/data-rights route unconfigured; expected terms/privacy routes unavailable | Establish reviewed policies and a real owner-verified support process before outside users; no invented address or false self-service claims. |
| High, confirmed integration state | #64 conflicts with current main; saved-work/deliverables not shipped | Integrate the existing candidate selectively, preserving current material system and security boundaries. |
| High, acceptance gap | No authenticated hosted/provider/billing acceptance this assignment; fresh schema differs from recorded evidence | Current catalog, ordinary two-account tests, bounded real-model evaluation and exact release receipt. |
| High before scale | Count quotas do not establish full price-aware spend control; some structured draft paths have no shared usage reservation | Small shared metering/reservation correction; no new billing provider or speculative upgrade. |
| Medium, confirmed | Main CI application fails at e2e; database job fails at founder browser tests | Recover current test contracts from the green candidate; diagnose specific failures. Earlier checks succeeded, so neither is proof that Auth/RLS failed. |
| Medium | Production Supabase adapter pins public config while comments acknowledge stale hosted variables | Reconcile the intended project/settings read-only, then fix configuration through the approved release phase. No private-project substitution. |
| Acceptance gap | Physical devices, real image latency/cost, long-running recovery and operations | Targeted measured tests; introduce jobs only if observed request limits require them. |

Supabase Free can support development and an initial bounded Advisor slice if the project's actual quotas/eligibility permit. This session cannot verify its plan or consumption. Docker is available but no local Supabase containers are running. Use disposable local Supabase first; for hosted acceptance prefer an existing isolated project or an eligible disposable Free project. A paid database branch is not a prerequisite for writing/testing code. If adapting the existing hosted runner from branch-only staging to a separate isolated project, retain strict project/identity/candidate allowlists and test the adjustment. Do not point it at production or silently purchase infrastructure.

## Validation receipt

Reran all **410 unit/SQL tests across 56 files**, passed. Recorded **28-file migration ledger** passed; it is historical hash verification, not current hosted state. Six selected browser workflows passed on the unchanged production artifact: memory confirmation/edit/forget, context opt-out/incomplete save, specialist identity, Table synthesis, reviewed Mission creation and installed icon delivery.

An initial additional security test used its literal port-3100 Origin against port 4500 and correctly received 403. Two Mission component checks reached an already-running, mismatched fixture server on 3102. Rechecked these three tests against an isolated current fixture (4512) and matching application origin; all three passed with only scratch test endpoint substitutions, no weaker assertions or repository test edits. Direct diagnostics also confirmed hostile origin 403 and anonymous same-origin memory mutation 401. Nine relevant workflows therefore passed across the valid runs; not one uninterrupted full-suite result.

Browser data/model responses are intercepted synthetic fixtures. They do not establish real provider quality, real Supabase session persistence or physical-device operation. Current main CI also reports `npm run check` and real local `test:integration` success; its broad e2e and founder-browser steps failed. Those failures do not establish broken local Auth/RLS, and their full root causes were not recovered here. Lint/types/production build passed for this identical source tree in the immediately preceding release; they were not rerun for a documentation-only assignment. Detailed private workspace evidence: `/workspace/entities-audit/` (live observations, screenshots, provider-source snapshots, test logs and public zero-row probes).
