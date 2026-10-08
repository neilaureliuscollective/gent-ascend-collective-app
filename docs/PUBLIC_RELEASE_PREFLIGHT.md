# Public Aethelios — release preflight phase

Founder authorized research, plan and execution on October 8, 2026 after recovering PR #64. This phase extends its exact head `69c9bfafe92fffc9e16b7297d6e1fa3d11799eb8`; it does not rebuild the intelligence architecture or introduce another application.

## Problem and result

The completed saved-work candidate was deployed only to a Vercel preview. The hosted public database did not contain its two additive migrations. A successful preview build therefore could not establish a working Mission/document release.

The existing founder launch ledger now performs eight bounded, session-authenticated, zero-row HEAD probes. It distinguishes readable schema, unavailable schema, denied access and incomplete checks. Person-bound founder authorization precedes every probe. All probes use the existing user session, have four-second abort signals, return no record bodies/counts and expose no backend messages. Opening the ledger invokes no model or write. Readability never implies that writes, RLS isolation, exports or provider behavior have passed.

The new read-only operator preflight inspects the relevant catalog instead of interpreting the old local migration hash snapshot as live schema acceptance. It checks 25 prerequisite columns/owner keys and 17 additive objects: required table RLS/read-only grants/owner policy shape, anonymous grant denial, RPC signature/definer/search-path/execute grants, the invoker view and the Mission compound key. A fresh complete snapshot yields `pending`, `blocked` or `observed`, preserves migration order, and always leaves release approval false. Partial application, prerequisite drift, stale snapshots, duplicate/missing check identities and changed reviewed migration files fail closed.

This is a bounded catalog contract, not exhaustive definition equivalence: it does not compare all new columns/indexes/constraints, full RPC bodies, historical migration statements or Storage policies. Real Auth/PostgREST behavior tests remain necessary. Operator-supplied snapshots are advisory, not signed environment receipts.

## Research and inspection

Reviewed October 8, 2026:

- [Supabase select](https://supabase.com/docs/reference/javascript/select) and [abortSignal](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal): zero-body probes, no count request, explicit timeout.
- [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [pg_proc](https://www.postgresql.org/docs/17/catalog-pg-proc.html) and [CREATE VIEW](https://www.postgresql.org/docs/17/sql-createview.html): distinguish schema/grant observations from session behavior and use invoker views.
- Installed Next 16 request-time/data-security documentation and the repository's canonical constitution, architecture, harness, roadmap and Mission rollout documents.

Read-only hosted inspection at `2026-10-08T17:04:22.486175Z`, project `volpzkfsnmtztrovexcw`: all 25 checked prerequisites passed; all 17 additive objects were absent. The catalog snapshot is retained in `validation/public-release-catalog.json`. It is a historical receipt and will intentionally become too old for the live preflight. The applied migration list also excludes both new migrations. No application records were queried, schema changed or providers called.

## Operator commands

From the canonical checkout:

```sh
npm run test:release
npm run release:preflight -- --sql
```

Run the printed SELECT in the intended project's SQL console or via the approved database connector. Save its JSON `snapshot` (or single-row wrapper) to a scratch JSON file, then:

```sh
npm run release:preflight -- --snapshot /absolute/path/catalog-snapshot.json
```

The snapshot must be complete and observed within fifteen minutes, with at most one minute of future clock skew. Exit 0 means catalog observations only; exit 2 means pending or blocked; exit 1 means the inspection/input/source check did not complete. The command never applies migrations, resets a database, creates infrastructure, starts a model or changes billing. Error output omits arbitrary inputs, backend messages and private paths.

CI additionally runs:

```sh
npm run release:preflight -- --local
```

That mode addresses only the Supabase CLI Docker container named from this checkout's `project_id`, runs the catalog query inside a read-only transaction and has a fifteen-second process timeout. It accepts no hosted URL, key or caller-supplied container. CI retains the existing real Auth/PostgREST and authenticated browser gates.

## Next release action

1. Complete an isolated hosted rehearsal/acceptance environment; none currently exists. Do not substitute a production transaction or purchase a branch without an authorized scope.
2. Reconcile the intended hosted migration ledger and exact prerequisite contracts, keeping Reserve-owned history untouched. Do not blindly push the entire local ledger.
3. Rehearse the unchanged `20261007190000_mission_continuity.sql`, then `20261007210000_mission_deliverables.sql`; run catalog plus real two-account/session/Storage acceptance.
4. Evaluate consented live model context and inspect physical phone/Fold behavior. Existing automated responsive fixtures are not physical-device acceptance.
5. Record an explicit release decision for the exact candidate; apply only the two reviewed additive migrations before promoting dependent code. Verify sign-in, Mission save/reload, deliverable save/review/export, retained work and rollback.

Production promotion remains outside this build instruction. Roll back application code together with its server contract while retaining additive schema and saved records. Never reset/drop hosted records to roll back. The founder ledger is reached from Account → Public release; it is not a customer-facing setup flow.

## Commercial launch

This phase prepares release diagnostics; it does not establish paid-launch readiness. Monthly cost budgets, complete provider/image cost accounting, support and commercial acceptance remain separate work described in the existing launch roadmap. There is no honest fixed phase count until hosted/provider/device acceptance is observed.

## Build validation receipt

Local lint, typecheck, production build, all 430 unit/SQL tests, six standalone preflight tests, the recorded migration ledger and six focused browser checks passed. Browser coverage includes founder denial and diagnostic layouts at 360/768/1440px; the phone screenshot was visually inspected. The standard Playwright browser archive was truncated in this runner, so focused checks used npm-distributed Chromium 153 in isolated processes. This browser fallback is test tooling only and changes no application dependency. Real local Docker/Auth acceptance runs through CI because Docker is unavailable here. Hosted/provider/device acceptance remains unrun.
