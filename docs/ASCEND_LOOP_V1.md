# Ascend Loop V1 — implementation map

Status: first working slice on `ascend-loop-v1`, 2026-09-25. Not a completed V1.

## Inspected baseline

- Real session-bound person/auth, founder grants and RLS; one active goal, profile priority and manually confirmed `ai_memories`.
- Command already stores check-ins, intentions, five daily actions and reflections atomically with optimistic versioning. Progress was a shell.
- Aethelios has a versioned constitution/personality prompt, session-owned conversations, bounded context, confirmed memories and a no-tool stream. The separate founder Aethelios app supplies reviewed public knowledge only; it is not this app's private memory store.
- World verticals and future health/grooming integrations are visibly planned shells. Do not treat them as live records.
- Read-only hosted Supabase inspection (2026-09-25): all six existing migrations are applied; one person and founder grant, two conversations/turns, zero goals, memories, daily entries or actions. All listed public tables have RLS enabled. The new capture migration is absent. No personal content was retrieved.

## Implemented first slice

| Layer | Change | Source of truth |
| --- | --- | --- |
| Capture | Global text entry, private inbox, owner-scoped record, UUID retry identity | `life_captures` |
| Aethelios proposal | Optional structured interpretation after save; user reviews suggested type and action title; no automatic write | Transient response, original capture retained |
| Typed action | Confirmed capture can create one action for the current local day; title reviewed by user; existing daily version check handles conflicts | `daily_entries` + `daily_actions` |
| Command | Most recent earlier reflection and unfinished actions, plus inbox count | Existing daily records + capture count |
| Aethelios | Three recent dated daily records passed only when personal context is enabled; revised capability disclosure | Existing `daily_entries`; no new AI memory |
| Progress | Completed actions and reflections over 30 days | Existing daily records |

The capture action does not run inside a model's response. It is a typed user-confirmed operation; chat cannot falsely report it as executed. A capture remains in the inbox if the action save succeeds but the subsequent inbox status update fails. Repeating the action with the same capture ID returns an idempotent acknowledgement for that day. This is an intentional recoverable partial state, not a claim of a multi-table transaction.

## Next implementation sequence

1. **Profile baseline:** Aethelios-led short conversation with reviewed structured proposals for priorities, routines, boundaries and coaching style. Store confirmed facts in typed profile state with source, confidence, timestamp and supersession; extend existing confirmed-memory model instead of treating turns as facts. Correction must resolve a stable fact key and retain the old revision as historical, not concurrently active.
2. **Capture interpretation hardening:** The first structured classification and suggested action title are available after save. Add persisted proposals, per-account usage quota, confidence/evidence display, project/person relation review and a broader action menu. Make action writes atomic with capture transitions if the current partial state becomes operationally painful. Until a quota exists, keep model interpretation behind founder/beta Aethelios access and monitor usage.
3. **Tool registry:** Explicit, scoped read/write tools around domain services (`get_daily_context`, `create_daily_action`, `complete_daily_action`, `update_priority`, `get_open_loops`). Validate args with Zod, authorize each call, check ownership in Postgres, log request and result, and return committed records. Writes need per-action confirmation and idempotency keys; never infer success from model text.
4. **Evening review:** Guided conversational reflection with a reviewed summary, blockers, decisions and tomorrow context. Preserve `daily_entries` as the daily record. Promote only confirmed durable facts to the existing Aethelios memory path.
5. **Progress:** Add owner-scoped event references for meaningful milestones and decisions; do not derive personal patterns from sparse data. Body, grooming, labs, products and connected services attach as later typed domains.

## Deployment and acceptance

Apply `20260925020524_ascend_loop_capture.sql` before code deployment; the Command read now queries this table. The migration revokes implicit Data API grants and grants authenticated select/insert plus limited status updates with owner RLS. Existing user sessions remain authoritative. Do not reset production data.

Verified locally: typecheck, lint, 72 Vitest tests (including PGlite SQL/RLS owner checks) and Next production build. PGlite is not a live GoTrue/PostgREST test. A live two-account auth check, migration application/advisors, browser/device validation and production deployment remain open. There was no live user data mutation.
The hosted security advisor currently flags five intentional authenticated definer RPCs for manual review and disabled leaked-password protection; neither notice was introduced by this branch. Recheck advisors after applying the new migration.

Acceptance status: Command context, capture persistence, optional structured AI interpretation, confirmed typed daily action, 30-day progress and owner isolation have code and local tests. The live model path has not been exercised in this branch. Baseline conversation, conversational tool invocation, correction/supersession and full next-day review extraction are still open. Failed typed actions return a failure rather than a success claim. The existing Aethelios identity and confirmed memory system are preserved.

## Research notes

- OpenAI function calling and structured output docs (checked 2026-09-25): tool calls supply structured arguments; the application executes and returns results. Model output alone is not a committed mutation. Future tool execution must wait for domain authorization and return database results.
- Supabase RLS guide and April 2026 Data API grant change (checked 2026-09-25): use explicit grants and ownership policies together. UPDATE needs both `USING` and `WITH CHECK` and an owner-visible SELECT path. `auth.uid()` derives ownership, never client-supplied identity or mutable user metadata.
- Existing project docs `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `DAILY_DASHBOARD.md`, `AETHELIOS_INTEROP.md` govern the separate records and private context boundary.
