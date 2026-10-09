# E1 — Launch Core implementation and acceptance

Founder approved implementation on October 9, 2026. This is the Public Aethelios repository; no private Coworkers or Reserve application is changed. Branch: `feat/e1-launch-core`. Production promotion remains gated on exact-candidate acceptance and founder review.

## Recovered implementation

Local merge `1b484f8` reconciles PR #64 / `af89b7615cd65a3c2c5da84e252fe895bc6a4205` (including #63/#62 ancestry) with production main `bc0e561d516267ff6f7467ffeaff5813fd0dbb3c`. It preserves the steel/carbon Talk and Studio environments, material-led homepage, current PWA icon and original crest. The separate Technology build/release stack is not imported.

Recovered features include Saved Work, granular request context consent, Mission continuity/proposals, retained deliverable versions, reviewed Markdown export, exact Studio handoffs, and ordinary two-account acceptance/preflight runners. These are code recovery facts; hosted migration/application deployment is not implied.

## Completed account and operational work

- `/join` is the direct email-code account entrance, retaining compatible password sign-in. No compulsory training priority is saved by the standalone flow.
- `/enter?entry=recover` signs existing accounts in using verified email possession without needing the old password. `shouldCreateUser:false` prevents recovery from creating an account. This uses existing Supabase Auth, not a parallel identity system.
- `ACCOUNT_AUTH_READY` and validated origin/CAPTCHA configuration gate returning access; `ACCOUNT_SIGNUP_ENABLED` additionally gates new accounts. Closed signup no longer inherently closes recovery. These flags are not enabled in production by this change.
- Old direction-draft links remain supported. Refreshing a verified session no longer resets the acknowledged direction-save receipt; the claim sheet tracks its query value rather than the unstable search-parameter object. Callback destinations are a fixed allowlist; failed/invalid callbacks receive no-store and no-referrer headers.
- Server-owned beta invitation claims, memberships and founder grants are preserved. Signup never grants AI or Studio access. The existing welcome screen handles invitation claims and account password setup.
- `/privacy` and `/terms` contain proposed minimum beta disclosures. They intentionally return 404 until `GENT_POLICY_APPROVED_VERSION=2026-10-09-e1`, a valid support email, and `GENT_LEGAL_OPERATOR` are configured. The public footer exposes links only when the same checks pass. Read the exact page text before approval; these drafts are not legal advice or evidence of legal review.
- Saved-work navigation uses the existing dark ink token on cream, correcting a measured 1.62:1 gold-link contrast failure. The former black PWA theme expectation is corrected to the approved ivory theme.
- Support links directly to recovery. The founder release screen distinguishes policy/provider configuration from actual acceptance.
- Offline fallback cache advances to v6, preserving the steel installed icon and evicting earlier fallback caches without caching authenticated responses.
- Browser tests accept isolated loopback ports via `PLAYWRIGHT_APP_PORT` and `PLAYWRIGHT_COMPONENT_PORT`; default CI ports and assertions remain unchanged. Existing user processes need not be stopped to verify this candidate.

## Shared provider spend reservations

All application SDK model construction now passes through `src/platform/openai/provider.ts`; raw image/vision calls share `budgetedFetch`. `research.ts` uses SDK tool definitions only, not an independent provider transport.

The additive `20261009160000_provider_budget.sql` creates a private, administrator-configured policy/ceiling schema and an owner-readable reservation ledger. No prices, allowances, memberships or authority are seeded. `GENT_AI_BUDGET_ENABLED=true` activates the boundary; the legacy path remains unchanged until explicitly activated during a reviewed release. Activation fails closed if session, eligibility, model/family ceiling or policy is missing.

Each HTTP attempt (including SDK retries and agent steps) reserves a reviewed worst-case amount against both UTC daily project and daily person limits, serialized inside PostgreSQL. The policy limits input bytes, output tokens and provider tool calls. Text/research/vision/image families are distinct. Unknown models and oversized inputs cannot invoke the provider. Normal users cannot alter policy, forge another owner or reduce reserved spend. Account deletion removes the owner reference while retaining the project spend reservation.

**Reservations are not actual invoices or an unconditional provider billing hard cap.** Ceilings require measured, current provider pricing and worst-case validation for the configured model, image sizes/quality, vision and tool charges. HTTP 200 in an application-recorded receipt means accepted, not successfully completed. Because the receipt RPC uses the normal owner session, its status alone is not trusted execution evidence; it cannot release spend or authorize an action. Network failures, retries, failed responses and uncertain receipts retain the full reservation; there is no automatic refund or replay. Existing detailed token ledgers continue to record their usual receipts. Provider billing reconciliation is required before describing measured inference cost.

Required operator procedure on an isolated staging database: review the new schema, insert ceilings for every actual configured model/family and bounded request envelope, set the project/person daily allowances and enabled policy, then enable the application flag. Values must come from approved beta spend and verified provider rates; do not copy synthetic test accounting units into a real environment. Test denied/unconfigured models, parallel budget exhaustion, image/tool calls and unknown outcomes with bounded provider funding before production promotion.

## Owner-verified assisted support procedure (requires an assigned owner)

1. Receive requests through the confirmed support inbox. Never request passwords, session cookies, payment credentials or emailed sensitive records.
2. Identify the account through a verified logged-in session or a fresh email-possession check to the address already attached to that account. A claimed email/address in the request is insufficient; metadata is not ownership proof.
3. Agree the requested scope: chats, separate memories, documents/versions, Studio assets, account/profile/daily records, membership/billing and merchant records have separate lifecycles. Do not promise that deleting a chat deletes them all.
4. Prepare a scoped export or deletion plan, identify legally required retention and provider/backup limits, and obtain confirmation before irreversible deletion. Deliver exports via an authenticated, short-lived transfer, not an ordinary email attachment.
5. Record operator, verified owner, scope, confirmation, completion/error and retention exceptions without copying private contents into support logs. Verify the result and close the request.

Whole-account export/deletion is assisted operational work, not an automated API implemented by E1. Assign ownership and rehearse this procedure on synthetic accounts before opening public registration.

## Release gates still requiring external evidence

- A fresh authenticated Supabase catalog/ledger and exact migration applicability; historical ledger includes Reserve-owned migrations and must not be reset or blindly pushed.
- Verified isolated hosted target, two ordinary identities, real email/CAPTCHA, existing-member login and recovery round trip.
- Actual model/provider quality, bounded price ceilings, beta allowance approval and tool/image billing reconciliation.
- Confirmed support inbox/operator, reviewed exact privacy/terms and account-data request rehearsal.
- Exact candidate CI/browser/database evidence, founder visual review, reviewed migration execution, production approval, rollback target, and live verification.

The cloud CLI cache must use `SUPABASE_HOME=/workspace/.supabase-cli` on this environment. ECR's Postgres blob redirect uses `d2glxqk2uabbnd.cloudfront.net`; this exact host is saved in the environment configuration draft alongside existing domains. Publish applies the draft; saving alone does not. The daemon uses the vfs storage driver on a 32 GiB filesystem. Pulling this local stack exhausted that disk before PostgreSQL could start. The failed pull was stopped and only the seven unused Supabase image tags downloaded by this attempt were removed, restoring about 24 GiB; no containers or database volumes were removed. Registry/download/disk limits are environment failures, not application/Auth defects. No paid Supabase upgrade is required by this implementation.

## October 9 candidate validation

The founder explicitly deferred support email and legal operating-name decisions. Those drafts remain unpublished; these details do not block code recovery or testing. They remain prerequisites before public policy publication and launch.

The application source passed lint, strict TypeScript checking and production compilation in `validated-check.log`, with 442 unit/SQL-emulation tests. The additional real-SDK transport test uses a synthetic HTTP response; the final unit run passes 443 tests in 61 files. Eleven release-runner tests and the 28-file historical migration-ledger check also pass. These are not actual hosted database or provider-quality acceptance.

The full browser run passed 351 of 379 tests. All twenty-eight initially failed cases passed in a one-worker rerun after correcting obsolete headline/account-copy/blue-orb expectations, an isolated fixture-port assertion and account-request synchronization. Assertions for routes, responsive behavior, contrast, security and saved work remain intact. This is combined evidence across two runs, not a single green 379-test invocation. The 28-case rerun passed in 3.6 minutes; unchanged hydration/dashboard cases passed serially, supporting runner contention as the initial timeout cause. A separate unchanged saved-reply styling rerun also passed. Mobile/desktop homepage screenshots were generated; the existing Imperial Steel environment and installed crest were preserved.

Validation artifacts in this workspace: `/workspace/e1-review/validated-check.log`, `final-unit.log`, `final-test-lint.log`, `e1-release-tests.log`, `e1-ledger.log`, `validated-browser.log`, and `failed-case-rerun.log`. Application source was unchanged during the final browser runs; final tested code/test candidate is `f9254d6` (subsequent receipt commits are documentation only).

Review: https://github.com/neilaureliuscollective/gent-ascend-collective-app/compare/main...feat/e1-launch-core. No pull request number or green remote CI status is asserted: GitHub API access is blocked by the current domain policy until the saved `api.github.com` draft is published. Main remained `bc0e561d516267ff6f7467ffeaff5813fd0dbb3c`; no release or database promotion occurred.
