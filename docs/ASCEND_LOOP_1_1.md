# Ascend Loop 1.1 — first real day

2026-09-25. This phase connects the existing daily records to a usable first session and a bounded Aethelios conversation. The hosted app had one confirmed profile fact and four AI turns at inspection, but no daily entries, reviews, action proposals or pilot reservations. Counts establish the current usage state, not why a person has not used a feature.

## What changed

- Command shows a six-step first-day route until the first confirmed evening review. The existing next-move rule provides the actual CTA; direction, goal, intention, action, completion and review retain their existing owners and screens. A direct route back to Command is present in Ascend Profile.
- The Aethelios workspace reads a fresh, owner-scoped daily snapshot: local day, saved intention, ordered actions, open-capture **count**, and the most recent prior confirmed review. The optional personal-context toggle still controls what reaches the model. The UI shows the snapshot separately, and the prompt removes database action IDs. It is a read at request time, not a live observation stream or capture content.
- A person can explicitly mark a listed action complete in Aethelios after a second confirmation. The new `daily_complete_action` RPC derives the person from the session, checks local day and expected version, updates one action and increments the day in one transaction. An already completed action returns its committed state on retry. The route enforces same-origin JSON and revalidates Command/Progress.
- Aethelios's existing proposed action title is editable before approval. A new RPC writes that confirmed title into both the daily action and executed proposal; the older RPC remains for in-flight app compatibility. Chat text still cannot execute writes.
- Existing evening review and next-day carry-forward remain the authority. No new AI memory, score, checkout, notifications or clinical data are added.

## Release sequence

1. Review and apply `20260926031906_daily_action_completion.sql` to the correct hosted project. The previous sixteen hosted migrations, including the private pilot, were present at inspection. Do not run local seed/reset on hosted data.
2. Deploy this branch to preview. Check an authenticated founder session and a second, separately authorized account. Confirm no cross-person action visibility; a stale action receives a conflict; completing it once and retrying returns the saved state; an edited proposal lands with exactly the edited title.
3. On the physical Fold, walk through direction → goal → intention → action → complete → evening review, reload after each save, and revisit on the next local day. Test keyboard/short viewport and the Aethelios compact panel. Test personal context both on and off. Check an actual paid model reply says what the snapshot supports and never claims to have changed records from chat text.
4. Promote to production only after the migration, preview checks and founder release review. The pilot Auth email template and first invitation flow remain a separate cohort activation check.

## Verification here

`npm run check` passes lint, typecheck, 87 unit/SQL tests and production build; `npm run db:ledger` validates the ten immutable applied source files and `git diff --check` is clean. PGlite checks owner denial, missing/stale actions, one-time completion, safe retry, edited title, and conflicting retry. PGlite is not live GoTrue/PostgREST. The first GitHub database job passed local Supabase reset, real Auth integration and founder browser journey. Its application browser job passed 56/58 checks and found that the previously shipped mobile Aethelios title was not an accessible heading; this branch corrects it and awaits a fresh run. Chromium is absent in this workspace and its download returned an invalid archive. Hosted migration, real production account writes and physical Fold acceptance have not been performed.
