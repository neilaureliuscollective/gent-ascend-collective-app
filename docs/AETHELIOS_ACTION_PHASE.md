# Ascend Loop V1 — confirmed Aethelios actions

Date: 2026-09-25. Third incremental slice on the draft Ascend Loop branch.

## Architecture choice

The existing Aethelios chat streams and persists text with an explicit save acknowledgement. Direct automatic model tool execution would mix an unconfirmed mutation with that stream and could produce a false success message if either save failed. This phase gives Aethelios one typed, approved action connected to a **completed saved turn**. The model proposes an argument; the application checks the source turn, persists a pending proposal, waits for user approval, and executes a named database operation. Chat text itself has no write privilege.

| Boundary | Record / operation |
| --- | --- |
| Source | Owner's completed `ai_turns` row |
| Proposal | `ai_action_proposals`, one per turn, status pending/executed/rejected |
| Model spend | `ai_reserve_proposal` in existing bounded `ai_usage` ledger |
| Confirmation | User approves/dismisses in Aethelios workspace |
| Execution | `ai_decide_daily_action` locks the owner, checks local day/5-action limit, adds one `daily_actions` row, increments `daily_entries.version` and marks the proposal executed in the same transaction |
| Idempotency | Reapprove returns the saved day without adding another action; a conflicting decision is rejected |

The only current tool is `create_daily_action`. A pending proposal is never shown as completed. If the model finds no user-supported action, no proposal is persisted. The typed executor returns a committed day only after the database transaction succeeds; an exception rolls it back and leaves the proposal pending. The action title is private to its owner. Deleting the source conversation removes the turn reference but does not silently delete a separately confirmed daily action.

## Research and limits

OpenAI function calling and AI SDK tool approval guidance (reviewed 2026-09-25) both separate model-provided arguments from application execution and emphasize an explicit approval boundary. The implementation uses structured output for a **proposal** and an explicit typed RPC for execution; it does not claim the conversation agent itself has a general-purpose tool loop. Supabase owner RLS and session-derived owner checks protect both the proposal read path and RPC mutations. The existing prompt says the chat reply cannot write records.

This is the first action tool, not a full LifeOS tool registry. Next: bring approved read tools (`get_daily_context`, `get_open_loops`, `get_progress`) into the conversation context without exposing cross-owner records; add `complete_daily_action` and goal/priority writes with the same confirmation and idempotency contract. Then build reviewed evening extraction and tomorrow-context projection. Avoid automatic memory promotion from a conversation.

## Verification and release

Local gates: lint, typecheck, 79 tests and production build. PGlite SQL tests verify cross-user denial, saved-turn requirement, proposal idempotency, rejection, one-time approval, day-version increment and preservation of existing intention. Browser/phone and real two-account Auth/PostgREST tests remain open because Docker is unavailable here. No live model run was made.

Migration order before deploying app code: `20260925020524_ascend_loop_capture.sql`, `20260925034117_ascend_profile_baseline.sql`, then `20260925035158_aethelios_confirmed_actions.sql`. No hosted migration or production deploy was performed in this phase.
