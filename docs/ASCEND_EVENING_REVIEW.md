# Ascend Loop V1 — evening review and tomorrow context

2026-09-25. Fourth incremental slice. The previous daily editor saved free-form reflection but did not capture a review that could deliberately inform tomorrow. This extends its record instead of adding a second memory system.

## Implementation map

| Stage | Record and behavior |
| --- | --- |
| Where am I / what did I do | Existing owner-scoped `daily_entries` and `daily_actions`; today and completed actions are read from saved rows. |
| What did we learn | Aethelios optionally drafts three bounded fields from the *saved* reflection and action statuses. A transient draft is editable and never the system of record. Manual entry works without a model. |
| What changes next | `daily_confirm_review` checks the signed-in owner, local day, exact daily version and expected review version. It writes a confirmed `daily_reviews` projection and append-only `daily_review_revisions` in one transaction. |
| Tomorrow | Command reads the most recent preceding relevant day and surfaces confirmed `tomorrow` and `blocker` beside existing reflection/unfinished actions. Opt-in Aethelios context includes at most three recent confirmed reviews; Progress shows review evidence. |

The user's confirmation is the authority whether the words began as their own draft or an AI suggestion. The database records the source day version and every confirmed revision; it does **not** trust a browser-supplied “AI sourced” flag. Request IDs are idempotent only with identical content. A stale day or stale review gets a conflict and no mutation. No review becomes an automatic semantic memory or a new task. Aethelios still cannot claim its conversational reply saved a review.

## Research and tradeoffs

Reviewed 2026-09-25: AI SDK `generateText` with `Output.object` validates the transient draft; Supabase Data API security uses both explicit grants and owner RLS, while a security-definer transaction must derive the owner from `auth.uid()` and pin its search path. The existing daily snapshot uses a per-person lock. The review RPC uses the same lock so action and review writes cannot interleave without version checks. These are application design choices, not evidence that the AI can infer behavioral patterns from a few days.

The first review is intentionally one local day at a time. There is no synthesized score, causal correlation, auto-created memory, retrospective bulk write, voice transcription or cross-domain insight. Aethelios provides wording help; the person chooses what will be carried forward.

## Verification and release

`npm run check` passed (81 tests, lint, strict typecheck and production build). SQL tests cover anonymous/other-person denial, direct write denial, stale source day, empty review, review correction, private revision history, identical retry, altered retry and no change to the daily entry version. Two anonymous/hostile-origin API browser-runner checks passed. The drafted/edited/confirmed UI test is written but could not run: Chromium is not installed here and the attempted Playwright download returned an invalid/empty archive. It uses an intercepted provider and would not be a live model test. Run `npm run test:e2e -- tests/browser/daily.spec.ts`, `npm run test:integration`, and `npm run test:founder` with a browser and real local services before calling the phase fully verified. Docker-backed Supabase, live-model quality and a physical Fold test are not available in this environment.

Migrate in order: Capture `20260925020524`, Profile `20260925034117`, Aethelios actions `20260925035158`, then review `20260925042257`. Do not deploy app code that reads the new table before its migration. Physical Fold and live-model evaluation remain release gates; no production deployment here.
