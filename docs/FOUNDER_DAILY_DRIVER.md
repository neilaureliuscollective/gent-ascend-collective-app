# Founder Daily Driver V1 — 2026-09-25

## Why this slice

Production was READY with the Ascend Loop tables applied, one founder account and two conversation turns. Read-only table counts showed no goals, daily entries, captures, profile facts, action proposals or reviews. The immediate job is to make one real day usable and observable before expanding AI tools or product verticals. Counts are operational evidence, not a claim about the founder's intentions or a reading of private content.

## Implemented

- Command now derives a single next move from confirmed profile direction, active goal and today's saved daily state. It offers the corresponding route or opens the real daily editor, navigates to actions, or scrolls to the review. The hint is recomputed from returned saved data after mutations; it does not store another progress status or infer personal readiness.
- The Ascend Profile direction can be confirmed directly in the founder's words. The existing AI proposal remains optional; provider availability does not gate setting the first direction. All saves use the existing person-bound, versioned RPC.
- Command shows the number of persisted day records in the available 30-day window as context, not a streak or score. Preview/sample modes receive no personal guide.
- Renamed all ten existing source migration files to the exact hosted ledger versions. Read-only SQL verified `md5(statements[1])` equals the local file MD5 for **each** migration. No SQL contents or production rows changed. `npm run db:ledger` checks these immutable files against that dated snapshot in CI. New migration files are allowed with unique versions; the snapshot does not assert a future remote ledger state.

## Release sequence and acceptance

1. Run `npm run db:ledger`, `npm run check`, browser and local Auth integration gates. Renamed migrations must reset correctly in local Supabase CI. Do not run `db push` in this no-DDL release.
2. Deploy from a reviewed GitHub branch/PR to preview, then production through the existing Vercel Git integration. Confirm the deployed SHA and runtime errors.
3. On the real founder account and physical Fold: save a direction manually, save a goal, set an intention and one action, reload, complete it, confirm an evening review, then revisit Command the next local day. Check a conversation with personal context on, and confirm cross-app founder context only if linked. The assistant may suggest an action but must never claim a write before confirmation.
4. Repeat real use over seven days. Record friction and quality findings. Use those findings to choose the next AI read tools or UX improvements. There is no app-created test record in the hosted founder account.

## Boundaries

The app does not gain repository write or deployment privileges. Vercel already tracks GitHub `main`; automatic releases should only follow the app, database and owner checks. Newer founder-approved logo imagery is not in this repository and no video asset is present. Asset replacement and a bounded mobile motion/video pass require the approved masters and physical device review. Do not claim this build has finished those parts.

Research checked 2026-09-25: [Supabase database migration tracking](https://supabase.com/docs/guides/deployment/database-migrations) and [Vercel Git deployments](https://vercel.com/docs/git). The Supabase changelog index could not be retrieved in this environment. Hosted ledger versions, names and hashes were inspected directly through the connected project.
