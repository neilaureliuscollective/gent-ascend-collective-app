# Studio activation preparation — October 12, 2026

Stacked on premium #98 and the complete #94–#97 Studio foundation. This phase supplies real configuration evidence, founder-only read-only probes and repairs stale real-Supabase acceptance selectors. It does not activate a vendor bill, migrate production or deploy.

## Actual hosted findings

Read Vercel variable metadata with `decrypt=false`; retained/output only names and target scopes. The canonical project has OPENAI_API_KEY and Supabase public connection variables scoped to production/preview. No STUDIO_NARRATION_ENABLED, STUDIO_FOOTAGE_ENABLED, RUNWAYML_API_SECRET or STUDIO_FOOTAGE_SIGNING_KEY were present in the audited metadata. Presence does not prove validity, model permission or budgets. No plaintext credential was read or printed.

Confirmed the canonical Gent Ascend database from FOUNDER_ACTIVATION.md and read only catalog/bucket metadata. Existing ai_studio_projects/references/versions/scenes/finishes/usage tables have RLS enabled. Existing aethelios-studio bucket is private and limited to 10,485,760 bytes. Narration/footage tables and audio/video buckets are absent, and footage functions count is zero. RLS enabled is not a test of policy correctness; no member records were inspected. The old standalone Aethelios database was not queried or changed. Founder direction now explicitly keeps one existing Gent Ascend Supabase. Protected preview refers to the application deployment, not another hosted database. Never reset or seed the shared hosted database.

## Implemented

- `/app/founder/studio` and GET `/api/studio/readiness` use the existing trusted person-bound founder grant. Membership, email and user metadata do not grant access. API denies nonfounders before session/schema probes; the page returns not-found. Normal user data stays session-bound; no service-role client.
- Configuration report emits fixed names/statuses/instructions only, never key values, masked prefixes, URLs or signatures. Flags, keys and receipt-signing minimum are independent checks. Every report declares `liveAccepted:false`; no score or activation promise is inferred.
- Expected schema columns are probed through the founder's session with exact owner filter and `limit(0)`. No rows are loaded, RPCs invoked, Storage objects accessed, models called or mutations executed. Missing table/column differs from inconclusive permissions/network failure. This does not verify RPC definitions, private bucket flags, RLS semantics, actual model access or billing.
- Founder acceptance tests follow current Aethelios sign-in copy, the real Tools & context drawer for Memory, the current Talk entry route, and `/app/daily` for daily persistence. Backend login, memory deletion, stale-write rejection, profile/goal/history and free-member welcome/daily persistence assertions remain. The retired FirstSession screen is not reintroduced; saved direction/action are verified through the current daily UI and API. The loopback-only dev bootstrap now provisions the fixed synthetic founder’s real founder_access row through its existing controlled operational client; ordinary app requests still use user sessions. Hosted bootstrap is rejected. No bypass, intercepted Auth/provider, test suppression or weakened owner assertions. A new real-local-Supabase test checks founder setup access, schema report and anonymous denial.

## Exact founder requirements

1. Use **the existing Gent Ascend Supabase only**, with the protected Vercel preview candidate. No additional hosted project or branch is required. PR #99 consolidates the complete Studio stack against main while preserving earlier PRs and unrelated work.
2. **Completed in the next connection phase:** reviewed Narration `20261012095748_studio_narration.sql` and Footage `20261012095801_studio_footage.sql` are applied to the existing database; 20/20 read-only contract checks passed. See [STUDIO_MEDIA_CONNECTION.md](STUDIO_MEDIA_CONNECTION.md) for exact hosted receipts and remaining ordinary-account acceptance.
3. Confirm existing server-only OPENAI_API_KEY has current image/GPT-Audio-1.5 permissions and a budget. Set app-specific RUNWAYML_API_SECRET and independent random STUDIO_FOOTAGE_SIGNING_KEY (at least 32 characters) as Vercel Secrets on the protected preview target. Preserve the signing key. Do not send keys in chat or reuse a Shopify/connector token.
4. Keep flags off until storage/RPC and budget checks pass. Then conduct ordinary authenticated preview acceptance against the existing database: approve one short narration and 5s clip, compare provider charges, inspect real outputs/host, privately save/reopen/seek/download, test uncertain acknowledgement recovery and another account's denial. Enable only accepted features. The read-only report cannot replace this test.
5. Complete physical-device/performance/visual acceptance and review production migration/merge/flag/rollback changes before founder approval to release.

## Research and verification

Retrieved current [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Vercel Config/Secret guidance](https://vercel.com/docs/environment-variables/sensitive-environment-variables); read installed Next 16.3.5 Route Handlers guidance. Supabase changelog retrieval was attempted but the web tool rejected its markdown MIME; no unverified breaking-change conclusion is claimed. Existing direct OpenAI remains per founder instructions; no AI Gateway billing switch.

Unit tests cover secret nonserialization, founder denial before probes, owner/zero-row query contracts and ambiguous failure classification. Real local Supabase CI and focused Studio/browser/visual receipts are recorded in the PR. Local browser bind and Supabase CLI home are sandbox-blocked; do not equate fixtures/PGlite with hosted Auth acceptance. No new migration is added. No real paid generation, hosted two-account/Storage acceptance or production release is claimed.

The three-phase v1 launch plan remains open: phase one is prepared but cannot finish until the missing schema, credentials/budgets and actual provider acceptance are completed. Do not reduce the remaining count merely because an activation page exists.

## Subsequent connection receipt

The original absence audit above is historical. The media schema is now applied to the same database, with source versions/hashes reconciled. This preparation phase itself did not deploy the application or activate providers. Current connection status and remaining requirements: [STUDIO_MEDIA_CONNECTION.md](STUDIO_MEDIA_CONNECTION.md).
