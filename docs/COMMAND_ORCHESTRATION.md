# Command orchestration · Phase 2

Authorized 2026-10-04; implementation stays on feat/immersive-command, with no push/main promotion.

## Inspection and pressure test

Command already owns a deterministic projection over session-bound DailyData. Aethelios already has an optional per-message personalContext, a dated dailyBrief, quota-reserved model calls and explicit action proposals. daily_save and daily_complete_action enforce ownership, calendar date and optimistic version under a database lock. The current energy identity remains the visual source.

An automatic LLM call on opening would silently expand consent, cost and latency and duplicate intelligence. A new background agent cannot honestly be claimed without a real authorized executor. Instead, this slice executes bounded preparation on the server and uses the existing confirmed-write transactions. Private context is never sent to a model merely by opening Command.

## Implemented sequence

1. Central request-time Command service: authorized parallel daily reads, sourced synthesis, deterministic next-move preparation, current preparation receipts, private/no-store API.
2. Shared pure next-move resolver for Command and the existing optional Aethelios personal context. Saved order first, confirmed earlier review second, saved goal step third. Completed/reviewed days do not manufacture a new task. No inferred health score or reprioritization.
3. Approved adoption of the exact prepared review/goal step into an otherwise empty current plan. Re-read source, owner/day/version guard, exact-text comparison and daily_save transaction; no arbitrary client title, overwrite or automatic commitment. Oversized saved text stays inspectable rather than being silently truncated.
4. Direct explicit action-completion confirmation using existing actionId/day/version transaction. Refresh saved state after acknowledgment. Unknown mutation outcomes lock replay until readback.
5. Return-to-foreground refresh after a bounded interval, no polling. Suspend refresh while deeper workspace/confirmation is open, preserve drafts, abort on unmount, reject account changes. Compare only transient mounted snapshots; no private browser storage or invented cross-session change history.
6. Ambient status shows actual preparation/readback state. Finite signal-change response, complete Still/reduced-motion presentation. Additional suggestions are progressively disclosed in saved order, with no manufactured urgency.

## Deterministic autonomy

AUTO: assemble authorized saved records and prepare a next-move draft. INFORM: surface a carried review and differences between two successfully loaded snapshots. These operations are read-only and reversible. APPROVE: adopt a prepared move, confirm completion, create a proposed action, change priority, save memory or external action. Unknown operations fail closed; classification is never authorization. Only the implemented prepared-move service executes a confirmed write here; other writes retain their existing domain boundaries. No general tool runner is introduced.

## Research applied

Checked 2026-10-04. OpenAI's practical guide recommends incremental, scoped tools and human intervention for high-risk actions, and notes deterministic workflows can suffice where ambiguity is absent: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/. Next.js recommends server-side reads directly from the source, avoiding internal HTTP waterfalls: https://nextjs.org/docs/app/guides/backend-for-frontend and installed Next16.3.5 fetching/data-security guides. Supabase RLS combines user-session access with owner policies: https://supabase.com/docs/guides/database/postgres/row-level-security. No schema, SDK or provider integration change is required; existing versioned RPC contracts remain authoritative.

## Budget and verification

No dependency, migration, extra opening database query, video, scene or per-frame React state. Initial JS target under165KB encoded (previous156,333); keep the existing one-canvas/480px/DPR1.5 cap. Preparation costs zero model tokens. Test empty, established, reviewed, carry-forward, ambiguity/oversized text, source change, day rollover, stale version, duplicate approval, unauthorized owner, partial decision read, refresh failure, draft isolation and graphics/reduced motion. Review phone/fold/tablet/desktop and short-height screenshots. Real Supabase Auth and physical-device results must be recorded separately from mocks/emulated SQL.

## Observed acceptance

Lint, strict typecheck, production build, recorded migration-ledger check and 238 unit/SQL/mock-provider tests passed. All 37 unique Command/daily/shell browser cases passed; eight affected production/navigation/orchestration cases were repeated after the final prefetch refinement. These include explicit versioned completion, prepared-move confirmation, source/owner/day/version rejection, write acknowledgment with failed readback, bounded return refresh, deeper-draft isolation, anonymous/hostile-origin denial, session clearing, progressive suggestions, graphics fallback and keyboard focus.

Seven production viewport audits have no page errors or horizontal overflow. Ambient has one canvas; Still has none. Compact 344×740 now places the whole action and control above navigation (action top 530px instead of 661px). Rhythm remains available in the deeper workspace; its opening disclosure is omitted on compact-height cover displays. Enlarged text keeps the existing linear field layout and scrolls naturally. The shared header/navigation still need reflow polish under extreme 200% text; final production accessibility/device polish remains a separate gate.

Encoded local resource totals: Still JS 158,459 bytes versus 156,333 (+2,126); Ambient 161,003 versus 158,877 (+2,126), with the same 2,544-byte deferred shader. CSS 34,106 versus 33,847 (+259). The reused chamber remains 155,976 bytes. Desktop previously downloaded 224,609 JS/66,429 CSS including a prefetched public cinematic site; deferring that public sidebar link brings desktop to the same 158,459/34,106 as phone. Command source/depth links also defer prefetch. No source query, dependency, schema change, video or additional canvas was introduced. These are encoded, unthrottled local lab measurements, not field timings or battery benchmarks.

Preparation is a request-time deterministic workflow. Receipts describe the current projection, not a persistent execution history. Aethelios keeps its existing bounded context window and per-message consent; the shared resolver changes policy consistency, not private retrieval scope. Prepared source text is re-read and compared before approval executes; the daily write/version is protected transactionally by the existing RPC. This is not a general background/model/external-action executor.

Real Supabase Auth/PostgREST persistence, live founder evaluation, physical Fold/touch/GPU/battery and assistive-technology gates remain unrun in this environment. The final remaining phase is production finish and real-service/device verification. No push, main merge, database mutation against hosting or deployment. Visual evidence: docs/validation/command-orchestration/.

Final state evidence also includes the empty/unavailable/error/readback views and keyboard-operated source inspection at 200% text on 360×640; all five targeted cases passed.
