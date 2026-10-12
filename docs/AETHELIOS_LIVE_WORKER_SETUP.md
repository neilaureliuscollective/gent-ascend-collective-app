# Live worker configuration — October 12, 2026

## Implemented

Inspected existing Vercel metadata without decrypting credentials and the canonical Supabase extension catalog. OpenAI is configured. Supabase worker authority is absent. pgcrypto and Vault are installed; pg_cron and pg_net are not. Current Vercel documentation confirms Cron delivery is best effort and its deployed scheduling operates on Production. A protected Preview needs a separately verified invocation path; adding the inactive schedule fragment does not activate it. Do not add services or disable deployment protection to conceal that gap.

Configured a newly generated 48-byte random CRON_SECRET as a Vercel Secret, scoped solely to Preview branch `integration/aethelios-live-20261012`. No secret is stored in source or this report. This does not change voice/expiry/readiness flags, register a schedule, or modify Production. The existing OpenAI Secret is retained.

Hosted Live admission now checks cleanup configuration in addition to enablement, readiness declaration and database binding. It fails before account/session/provider work unless expiry is enabled, a nonblank server-only worker credential exists, and the scheduler secret is at least 32 characters. Preflight uses the same pure configuration check. Configuration is still not proof of scheduler delivery or termination. Local development retains its existing behavior; Production admission remains blocked.

The preflight panel now describes the explicit founder-only canonical pilot correctly; it no longer says that a second database is mandatory.

## Required credential input

Add the existing canonical Gent project's service-role credential as **SUPABASE_SERVICE_ROLE_KEY** in the existing Vercel project's Preview environment, scoped to **integration/aethelios-live-20261012**, as a Secret. Never use a NEXT_PUBLIC name or paste the value into chat/source. The connected Supabase tools expose publishable keys, not service-role credentials; no replacement OpenAI credential is needed. This key is used only by the infrastructure expiry client; ordinary application/user/AI access remains session-bound.

## Verification before activation

1. Verify the branch-specific credential scope through metadata and deploy a new protected preview; existing deployments do not pick up changed environment settings.
2. Verify trusted founder login and preflight against the exact new deployment: correct canonical binding, installed schema, configured OpenAI/model and worker credentials. Reject member/anonymous access.
3. Enable only the worker on the test target after credential/binding checks. Test unauthorized worker request denial and authorized zero-backlog sweep returning aggregate counts. Neither test proves provider hangup.
4. Establish an independent invocation path on existing hosting, preserving Vercel protection. Prove delivery and retry after missed/overlapping invocations; record source/deployment evidence. No preview scheduler is active yet.
5. Conduct a controlled real provider session and prove termination after browser/function loss and expired lease recovery, recording provider usage. Only then set the hosting-readiness declaration and enable founder voice. Do not claim a guaranteed 120-second cap: minute scans plus lease retries are eventual cleanup.

No real speech latency, billed cost, physical-device acceptance, running preview scheduler or successful provider termination is claimed by this setup slice. Three release workstreams remain; protected hosted testing remains in progress.

Sources: [Vercel Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions), [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles). Read the existing hosted-schema receipts and expiry plan for permissions and recovery constraints.

Validation: local lint, strict types, the 35-file migration integrity snapshot and all 83 files / 557 unit/SQL tests pass. Regression covers each missing cleanup requirement even with readiness declared, plus configuration/secret-redaction separation. These are not hosted worker/provider acceptance. Prior published schema receipt source 549dd6ad passed connected Live, Obsidian visual and Lifestyle checks; the new source requires its own CI.
