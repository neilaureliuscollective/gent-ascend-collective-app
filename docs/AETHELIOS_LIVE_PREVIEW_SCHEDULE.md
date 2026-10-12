# Independent preview expiry delivery — October 12, 2026

## Implemented on existing infrastructure

The existing canonical Gent database now runs a minute Supabase Cron job invoking the existing protected Vercel expiry worker through the `http` extension. This works on Preview without adding a provider, queue service, database or subscription. The fixed target is the integration branch alias. Voice and hosting-readiness flags remain off; Production configuration is unchanged.

The founder's worker credential was corrected from Production to branch-scoped Preview without reading or replacing its value. A fresh source-43d6f307 preview was built. The scheduler credential was rotated while admission was disabled, stored as a branch-scoped Vercel Secret and encrypted Vault entry. A separate Vercel project automation bypass is held in Vault and sent only in an HTTP header. It bypasses Vercel deployment protection for this project (not just this path); normal application Auth remains enforced, and the worker additionally requires its independent scheduler credential. Revoke this dedicated automation credential when the pilot ends; do not disable deployment protection. No existing OpenAI/API credential was copied into the database.

Operator-only `live_private.run_preview_expiry()` has a fixed URL, no caller input, invoker security, empty search_path, a 55-second HTTP timeout and 5-second connect timeout. It reads only its two Vault entries, calls the existing worker, and accepts only HTTP 200 with a bounded, exact aggregate receipt containing zero pending work. Errors are generic and never echo headers, credentials or response content. Anonymous, authenticated and service-role app calls have no EXECUTE grant on this operational function. Existing service-only claim/confirm RPCs remain unchanged.

The final minute schedule checks for expired attached calls without private confirmation and skips HTTP entirely when idle. Provider/backend usage remains separately metered. This is eventual cleanup, not an exact two-minute termination guarantee: missed delivery and two-minute lease retries can delay cleanup, and batches remain limited to five.

## Actual evidence

- Protected hosted HTTP request with both credentials returned **200**, `{claimed:0,confirmed:0,pending:0}`. This verifies the supplied database worker credential and empty-backlog RPC execution.
- Request with deployment protection authentication but no scheduler authority returned **401**.
- Actual independent timed Cron deliveries succeeded; one recorded at 12:02 UTC took **750.926 ms**, later verification runs took approximately **237–582 ms**. These are empty-backlog scheduler/HTTP invocation durations, not voice latency or provider hangup measurements.
- Vault reads and delivery-function execution are denied to ordinary app roles. Source/current app was already verified through Live integration and real local Auth/founder CI. New operator-function tests execute the SQL against a stub HTTP transport and reject failed, partial, malformed and private-field receipts; they do not prove provider termination.
- Local lint, strict types, migration integrity snapshot and **84 files / 559 unit/SQL tests** pass. Source documents/configuration still require exact-head CI publication.

## Module choice and remaining housekeeping

Initially installed pg_cron/pg_net and attempted to revoke HTTP queue grants. Hosted catalog verification showed pg_net's managed PUBLIC queue grants remained, so no credentials were sent through it. Selected bounded synchronous `http` delivery instead, avoiding persistent credential-bearing queues. The unused pg_net extension remains installed: two removal attempts returned `Invalid or expired requestState`; no completed removal is claimed. It has no jobs/queued requests from this work. Do not use it for secret-bearing requests. This was a connector request-state error, not a reported automatic approval rejection.

The normal CLI migration-new command was attempted but failed on the read-only `/home/agent/.supabase` configuration directory. Operational SQL and exact hosted migration receipts are retained under `ops/`; these optional hosting modules are separate from ordinary local application migrations. Never reset or seed hosted accounts.

## Next acceptance and rollback

Actual provider termination, function/browser-loss recovery, voice acoustics, mobile audio and billed cost remain unverified. The next controlled acceptance must use the normal trusted founder session, verify model metadata/access, create a real bounded call, and observe termination/usage before public activation. A successful empty sweep cannot establish those properties. No ChatGPT performance claim or public release.

Rollback: disable new voice admissions, drain active calls, unschedule only `aethelios-live-preview-expiry`, then revoke the dedicated automation credential and disable the Preview expiry flag. Leave owned history/migrations intact. Do not delete shared extensions, unrelated jobs or unrelated Vault entries.

Sources: [Supabase Cron](https://supabase.com/docs/guides/cron/install), [HTTP extension](https://supabase.com/docs/guides/database/extensions/http), [Vault](https://supabase.com/docs/guides/database/vault), [Vercel automation authentication](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation). Inspected pgsql-http source for available curl timeout options; FOLLOWLOCATION is not runtime configurable and no redirect-following option was enabled.
