# Live hosted validation preparation — October 12, 2026

## Connected results and repair

Exact expiry candidate `e9b3afa6e7f493c9e4e4b1359b24b26fde4f4171` passed its connected production build/browser integration job. Real local password Auth/PostgREST checks, including founder/member/anonymous denial of both expiry RPCs, passed. Its separate lease fixture failed: the installed Supabase CLI rejected a multi-statement prepared query (`cannot insert multiple commands into a prepared statement`). This was a runner-format defect, not a passing lease acceptance result.

Replaced the transaction script with one DO statement. Its inner PL/pgSQL subtransaction performs all synthetic lease assertions, then raises and catches only a dedicated success SQLSTATE to roll back its writes. Other errors propagate and fail the check. The statement finally verifies that neither synthetic session nor private lease remains. Added a regression that executes this exact file using a prepared query against the full migration/seed database in PGlite. PGlite executes actual SQL but does not prove Supabase Auth or hosted acceptance; connected local Postgres still must pass this repaired file.

Reviewed [PostgreSQL exception handling](https://www.postgresql.org/docs/current/plpgsql-control-structures.html), [Supabase database functions](https://supabase.com/docs/guides/database/functions) and [Vercel Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs). The CLI's actual failure log establishes its statement constraint; no package upgrade or alternate dependency is required.

## Read-only founder checks

The existing founder preflight now shows expiry enablement, presence of the infrastructure database credential, strength/presence of the scheduler secret and database connection configuration. Only booleans are returned; no credential, database URL, account record or worker lease is disclosed. Schedule delivery and provider cleanup acceptance remain explicitly unverified regardless of flags. Whitespace-only scheduler credentials are rejected consistently by the preflight and worker endpoint.

The inspection retains normal trusted founder authorization and owner-scoped zero-row reads. It creates no privileged client, runs no expiry RPC, opens no call and alters no setting. Existing explicit OpenAI metadata checks retain their read-only behavior. This panel helps identify configuration gaps; it does not establish schema installation, correct target binding or cleanup performance.

## Target discovery and rollout boundary

Read-only Supabase branch listing for canonical Gent Ascend project `volpzkfsnmtztrovexcw` returned **no development branches**. Do not substitute the separate founder Aethelios database, modify production, manufacture a seed identity on a hosted target or create paid infrastructure without a concrete cost decision. Requested an existing isolated preview project reference, or direction to prepare an isolated-branch cost proposal. Work that needs a hosted write waits for a verified target; local/CI source work continues independently.

No database, provider credential, activation flag, scheduler registration or production deployment changed. The previous metadata audit found the existing OpenAI Secret in Preview/Production, but no worker database credential, CRON_SECRET or expiry flag. Absence in this workspace is not a missing provider-key diagnosis. Keep the worker and voice admission default off until target/schema/authority/schedule/provider acceptance.

## Local evidence

Lint and strict typecheck pass; **81 files / 535 unit/SQL tests pass**, including the exact prepared fixture and secret-redaction/acceptance separation. Historical 28-file migration ledger and diff checks pass. No real voice latency, actual provider hangup/billing or physical-device acceptance is claimed. Publish this exact tree to existing draft PR #90, run both connected integration jobs and report their results before treating the repaired fixture as complete.
