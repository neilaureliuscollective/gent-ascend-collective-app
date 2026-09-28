# Ascend Performance Phase 4 — decision follow-through

Founder authorized research, planning and implementation on September 28, 2026. Built on Phase 3 (`37b151d`); the whole-man dashboard remains unchanged.

## Product decision

Close the loop from an approved target change to the next recorded attempts. Review answers **“Did the change hold?”** with actual reps, loads, set completion and reported effort. It does not equate approval with progress, or claim causation from two observations. The latest result is visible; previous decisions remain expandable.

Research reviewed September 28:

- [ACSM 2026 resistance training guidance](https://acsm.org/resistance-training-guidelines-update-2026/) emphasizes consistent participation and individualized programming. This supports inspecting actual adherence and outcomes before expanding adaptive rules; it does not validate a two-workout causal or physiological score.
- [Supabase functions](https://supabase.com/docs/guides/database/functions) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): use invoker privileges and existing owner policies for this read-only projection. Reviewed the current changelog; this slice introduces none of the affected ltree, btree_gist or legacy encryption features.
- Installed Next.js 16.3.5 Route Handler guide: keep authenticated service composition and private responses in the existing route. No additional client request, model service, or cache is necessary.

## Rules and boundaries

1. Read the latest 20 approved decisions, their immutable approved program revisions, and each decision's first two same-slot attempts, ordered by start time then ID.
2. Include active, abandoned and adapted attempts. Do not cherry-pick later successful workouts. The lookup is independent of the workspace's latest-60-workout limit.
3. A workout must start at/after approval and carry that program revision or a later one. Older offline prescriptions do not test a newer decision.
4. The trial closes at the first subsequent program revision that changes/removes this slot's entire plan. Editing another slot does not close it. Reverting a later plan does not reopen an old trial. Both program version and start timestamp must precede the closing revision.
5. Compare the changed exercise's sets/reps at the approved load, in a matching full prescription. Missing sets/reps, changed load, adaptation, discomfort and unfinished attempts stay explicit. “Rep target met” describes this exercise only. Effort remains a separate measurement; absent effort is never treated as easy work.
6. Two workouts on one local date are labeled accordingly. Future-dated records cannot establish observed success. Self-reported timestamps are not proof that the workout happened; late sync may update the read projection.
7. No automatic writes, rollback, progression changes, load increases, new score, wearable link or Physical Twin prediction. Current Phase 3 eligibility remains authoritative for the next proposal.

## Architecture

Additive CLI-created migration `20260928203910_ascend_performance_outcomes.sql` adds one stable, security-invoker RPC, `performance_outcomes()`. No owner ID parameter, no definer elevation, no anon/PUBLIC execution; existing RLS governs every source. One SQL snapshot returns bounded evidence, avoiding cross-request revision/history inconsistency. Existing indexes support person/slot/session lookups. No hosted migrations executed.

The server validates the payload and applies `decisionOutcome` to produce a compact read model. Raw session notes are omitted. The client receives outcomes, not a second full session history. Optional Aethelios interpretation receives this bounded read model only after the existing review consent action; its disclosure and instructions now cover follow-through without allowing causal claims or overriding holds.

UI is a vertical sequence with expandable attempt records and a single-column definition list on phones; wider screens use two columns for recorded values. No new navigation destination. Old decision history remains accessible.

## Validation and release

Unit tests cover missing effort, high effort versus rep completion, incomplete sets, load changes, adaptation, discomfort, abandoned/active attempts, revisions, local dates and future records. SQL tests exercise real migration syntax, invoker security, two-owner isolation, first-attempt retention, unrelated-slot edits and revision boundaries. Auth/PostgREST integration adds the RPC, recorded sets and anonymous/two-owner denial. Browser coverage checks keyboard expansion, no writes, values, history and 344/390/768/1440px widths.

Local lint, types, production build, 129 unit/SQL tests and migration-ledger verification passed. Build and browser/real Supabase CI results are recorded on the review PR after execution. Local Docker is unavailable and the Chromium CDN returned invalid archives; those gates must not be inferred from SQL emulation.

Release remains separate: reconcile the shared hosted ledger; stage the Phase 1 → 2 → 3 → 4 migrations; verify with a real signed-in account and physical Fold/phone. Application rollback leaves prior data intact; the new RPC is additive and read-only. No production promotion performed.

## Next useful phase

Use actual founder trials to identify what blocks recording and interpreting outcomes. Exercise identity/taxonomy and user-selected rep ranges can then support realistic load increments. Nutrition/recovery depth and native sensor integration need their own complete slices; do not infer them from this training loop.
