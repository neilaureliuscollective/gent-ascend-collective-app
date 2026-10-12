# Live hosted schema installed — October 12, 2026

## Scope and receipts

Installed seven prepared Live migrations on the existing canonical Gent project `volpzkfsnmtztrovexcw`, from validated source `f6516d98ef1d46437e6d46ad55407d082e3dfad5`. No separate database, paid branch, account seed, reset, provider call, or public release was performed. Migration calls all returned success; the hosted ledger lists versions `20261012083907` through `20261012083913`. [Exact source files and hashes](live-hosted-migrations-20261012.json) record the mapping; the local migration integrity check now protects these seven files in addition to its 28 historical entries.

These migrations provide owned Live reservations/jobs, conversation-linked image/visual/research/coworker artifacts, explicit reviewed daily action confirmations, and private expiry leases. Existing Studio, conversation and daily functions were verified present before installation. Provider keys were neither read nor replaced.

## Actual hosted validation

Catalog queries confirmed RLS on all five new tables. Anonymous SELECT and authenticated INSERT/UPDATE/DELETE are denied. Authenticated SELECT is limited by owner policies on the four public tables; private expiry leases have no ordinary-user access. Expiry claim/confirmation RPCs are executable by service_role only. Owned session/action functions use empty search_path and derive identity from auth.uid().

An actual hosted SQL DO statement verified anonymous table denial, authenticated worker denial, and reservation denial without identity. It made no account data writes. This is Postgres role verification, not a real signed-in founder browser or two-user PostgREST test. Local complete SQL/unit suite passed: 83 files, 556 tests. Published application source passed Live integration, Obsidian visual and Lifestyle acceptance; broad Quality was still running when inspected.

Post-install security advisors report no RLS-disabled table. The private expiry table has an informational no-policy notice intentionally: it is reachable only through worker-definer functions, with direct grants revoked. Authenticated SECURITY DEFINER warnings are retained for intentionally owner-bound RPCs; do not make them invoker or grant raw writes simply to remove a warning. Existing leaked-password protection remains disabled and was not changed by this work. References: [RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [private-table policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Reviewed current Supabase RLS and OpenAI hangup documentation. The changelog Markdown fetch remained unsupported by the documentation tool, so no changelog review is claimed.

## Activation boundary

Set only `AETHELIOS_LIVE_CANONICAL_PILOT=true` on the existing integration branch's Preview environment. It selects canonical database reuse and founder-only admission; it does not enable voice. Readiness, Live enablement and expiry enablement remain unset/off. No Production variable, deployment promotion, cron registration or credential change.

The existing Vercel OpenAI Secret is configured. Worker database authority and CRON_SECRET are absent. Independent scheduling/termination still require real verification: Vercel Cron schedules execute on Production, not Preview, so merely adding the inactive minute schedule cannot make this protected preview safe. Select a supported execution path within existing hosting, configure server-only worker authority, test authenticated founder preflight and actual provider termination with browser/function loss before admission. Preserve deployment protection and normal application Auth. Do not introduce another subscription just to bypass this constraint.

Real acoustic latency, mobile compatibility, billing reconciliation and ChatGPT parity remain unmeasured. Three release workstreams remain; schema installation advances the first. The first voice test is still pending cleanup/hosting verification and controlled activation.
