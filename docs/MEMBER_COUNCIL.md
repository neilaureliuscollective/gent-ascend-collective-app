# Gent Ascend Council — Member Intelligence Team, Phase 1

## Inspection and plan

Reference: `neilaureliuscollective/aethelios`, `41ab4399a7709ecc88f5cd774add8777a3298437`, “Make The Council native to Aethelios Talk”. Target baseline: `5b572b4be5a7d709239a544ecef5e7f4cc2574a8`.

Inspected reference team.ts, team-orchestration.ts, talk-team-missions.ts, coworker-tools.ts, personal/table.tsx, personal/talk-team-missions.tsx and server/talk-team-missions.ts, Mission OS isolation/specialist contracts and the Talk Phase 4 approval contract. The reference Table is a project/scope room with a named responder; Team Missions independently gather read-only specialist outputs and synthesize through Aethelios, requiring a saved proposal digest before execution. Source tool capabilities are project.snapshot and github.structure, not general member integrations.

Inspected target intelligence service, model, prompt, stream and validation; workspace, message rendering and conversation library; conversation/turn/message/memory/usage SQL and ownership functions; Command/daily snapshot composition; founder bridge; Studio boundaries; account-bound personal context and Next route conventions.

| Treatment | Decision |
|---|---|
| Reuse | Council/team vs Table/room distinction, source role definitions, explicit named lenses, independent perspectives followed by primary-intelligence synthesis, no silent delegation or write authority |
| Adapt | Source keyword routing into bounded member recommendations; review the actual question/cast/context before Table execution; source Table becomes an environment inside the existing member chat |
| Rebuild | Small member Council catalog, validated request selection, native green/obsidian/gold dialog and provider orchestration using existing member chat persistence/context/provider |
| Defer | Background missions, durable multi-stage jobs, saved proposal digests for consequential actions, cross-conversation retrieval, live web research, travel/calendar integrations, media generation and clinical specialist roles |
| Founder-only | Founder Mission OS, repository tools, project integrations, private founder notebook, code execution and release authority |

No new navigation destination, intelligence engine, database table, service-role access, provider or credentials. Hermes retains commercial operations; he is not falsely relabeled a connected travel operator. Athena handles comparisons and travel planning from supplied facts, not live bookings. Prometheus can explain member-supplied code and prepare requirements; founder repository inspection is absent.

## Implemented experience

Within `/app/aethelios` and the global shared Aethelios panel: The Council opens a quiet roster. Relevant Council derives advisory recommendations from the draft or last question without making a model call. Aethelios can also recommend lenses in its answer but cannot invoke them. Involve a specialist in the current transcript, or open a new focused conversation sharing the same authorized member context. No automatic sending.

Assemble Around This opens The Table with the question, two to three selected specialists, selection reasons and context disclosure. The member can edit the question/cast. Confirm and assemble submits the exact reviewed request. Specialists independently receive the same bounded conversation and member context. Their actual contributions and Aethelios synthesis save together as one existing turn. Leave The Table returns to ordinary Aethelios without deleting context or history. Repeat Table requests require review again. Ordinary chat keeps its original request/stream/save behavior.

The existing turn's `prompt_version` records a bounded versioned selection (`council.1.s.athena` or `council.1.t.athena,themis`); normal prompts retain their original version. This is an explicit Phase 1 ledger encoding, parsed through a strict allowlist. It identifies the prompt and cast that produced the response. Labels and restored selection derive from the saved tag. Contributions are named Markdown within assistant_text, not a new durable job schema. A future independently resumable mission requires normalized structured steps and explicit approvals rather than overloading this bounded turn flow.

## Ownership, consent and costs

The server accepts no person/owner ID, capability set, context payload, tools or founder flags. Existing verified session/person lookup, capability policy, owner-bound conversation checks, Postgres RLS and ai_begin_turn/ai_finish_turn idempotency/leases remain authoritative. The Council path never calls founderBridgeContext, even for a founder account. It retrieves the current member's relevant context only when the existing Use personal context toggle is enabled; conversation history remains in scope as disclosed. Confirmed memory remains opt-in. Council output can prepare existing daily action proposals through the existing separate approval flow. No automatic memory/daily writes.

Single specialist: one bounded OpenAI call. Table: two or three bounded independent calls (up to 1200 output tokens each) plus the existing bounded Aethelios synthesis. One existing turn reservation covers the bounded workflow; aggregate input/output tokens are recorded in ai_usage. Same account/conversation lease prevents simultaneous sends. Per-turn limits cap work; Table uses more calls than normal chat and is disclosed before confirmation. No additional budget/provider or hidden background work.

All selected calls settle before synthesis. Any failed/truncated specialist aborts synthesis and yields a failed turn with completed contributions available as partial output; no successful save event is emitted. Interrupted/error turns remain excluded from future model history. Provider errors are redacted. Request cancellation and existing total timeout apply. Missing model/access disables execution while saved chat and other context tools remain available.

## Research

Inspected source commit above is architectural evidence. Official Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security (reviewed 2026-10-04); grants and ownership predicates are separate controls, preserved unchanged. Official AI SDK generateText reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text; installed SDK v7 and existing adapter establish supported instructions, messages, timeout, abortSignal, usage and finishReason contracts. Local Next 16.3.5 route guide read before route edits. Supabase changelog markdown retrieval was unavailable through search; a current local retrieved snapshot was inspected (including database extension breaking changes). No Supabase package, schema, extension or API change is introduced.

## Validation

Release results are recorded in STATUS.md. SQL tests use PGlite with minimal Auth catalog; they are not proof of GoTrue/PostgREST or a live model. Intercepted browser tests exercise UI behavior and responsive layouts, not live identity/model. Physical device and private-beta live evaluation remain explicitly separate.
