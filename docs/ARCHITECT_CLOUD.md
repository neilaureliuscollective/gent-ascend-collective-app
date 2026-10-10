# Architect cloud projects and bounded revisions

Review implementation, 2026-10-10. Continues Phase Two PR #82. No production migration, execution grant, live AI acceptance, billing activation or deployment promotion performed.

## Working code

Existing free local HTML/CSS workshop remains available. Optional cloud library adds authenticated project saves, immutable versions, reopening/history and deletion. Saves use owner-resolved session RPCs, optimistic revision checks and stable UUID requests; an uncertain save retries exactly the original snapshot/IDs. A definitive rejection releases that pending snapshot so the member can reopen current source. Local edits are not automatically synchronized.

Optional AI revision workflow: save project → authorize one request → atomic reservation → one direct OpenAI structured-output request → save draft receipt → inspect source → explicitly apply locally → isolated preview/check → explicitly save a new version/export. No provider call before successful reservation, no automatic canonical replacement, no personal-memory/health/commerce context, no provider tools. No shell, dependency installation, arbitrary JavaScript preview, GitHub write or deployment.

Model-generated source is untrusted. The existing restricted iframe/CSP/static HTML projection is retained. A completed job means a draft response, not executed code or passed checks. Session-bound completion receipts can be written by their owner and are not cryptographic model provenance or an authoritative financial meter. Never grant subscription access or charge overages from these receipts.

## Database and permissions

`20261010120000_architect_projects.sql` is additive and unapplied. Tables: projects, immutable versions, jobs and operational allowances. All have RLS; anonymous access and direct authenticated writes are revoked. Narrow SECURITY DEFINER functions use empty search_path, derive owner from auth.uid(), explicitly check ownership and serialize on the person row. Compound owner/project foreign keys prevent accidental cross-person linkage. No historical migration, user record, membership constraint or Stripe price was changed.

Limits: 20 active projects; 100 saved versions/project; name 80, brief 2,000 and HTML/CSS 40,000 characters each. Content has typed JSON/size checks. Deletion erases versions and draft outputs, archives the minimal project row and preserves usage reservations. This prevents deletion/recreation from refunding compute. Account deletion cascades these person-owned rows. Minimal job metadata (IDs, hash, model, timestamps/status) is retained for usage; actual retention periods need commercial/privacy review before launch.

Execution grants are separate from membership tiers. `architect_allowances` contains an expiring person-bound monthly job allowance, restricted to 1–20. Only privileged operational administration can insert/change grants; ordinary clients can read their own grant but cannot escalate it. No grants/seeds were added, including for founders. This is a controlled acceptance mechanism, not final paid Architect entitlement provisioning.

Every attempt counts, including failures and ambiguous receipts. Atomic owner lock enforces the monthly UTC allowance, three reservations per rolling 24 hours and a two-minute reservation cooldown independent of completion status. An owner cannot unlock concurrent provider calls by manually finalizing a receipt. Older uncertain jobs are not automatically resumed or refunded. Duplicate request IDs reject instead of invoking the provider again. A deleted/inaccessible project cannot be finalized; its reservation remains counted. The job ledger is a volume reservation ledger, not dollars or verified billed tokens.

## Configuration and readiness gates

Defaults remain disabled. `ARCHITECT_STORAGE_ENABLED=true` requires the additive migration in an approved local/dedicated staging project plus real Auth/RLS acceptance. No public feature flag bypasses ownership.

AI additionally requires server-only `ARCHITECT_AI_ENABLED=true`, `ARCHITECT_AI_BUDGET_APPROVED=true`, existing `OPENAI_API_KEY`, a pinned `ARCHITECT_AI_MODEL` (gpt-4.1-mini or gpt-4.1), and an unexpired operational allowance. Use provider-side project spend controls. Do not enable the budget switch before verifying current model availability/pricing and approving conservative pilot spend. No new model API call is made by default.

One job uses at most 16 KB of project/request JSON input, plus fixed instructions/schema; 2,000 output tokens; 45-second SDK total timeout; zero retries and no tools. Route duration is 60 seconds, subject to hosting-plan enforcement. `store:false` prevents Responses API storage; provider retention/processing agreements still require review and this is not a zero-retention assertion. A client timeout is not proof the provider did not charge. Source/results stay within this project/owner; no private founder bridge or personal context retrieval is called.

Live acceptance needs: reviewed additive staging application; two real members' saves/read/conflicts/deletion/deny checks; explicit synthetic operational grant; successful bounded provider response and usage observation; quota/error/timeout/receipt recovery; retained iframe isolation; founder approval before production. No $129 enrollment activated. GitHub/executable previews/deployment still need separate scoped infrastructure and approval.

## Targeted official research

Read installed Next.js 16.3.5 route handler reference and AI SDK 7 generateText source before integration. SDK confirms maxOutputTokens, total timeout and abort handling; installed OpenAI Responses adapter defaults store to true, so this code explicitly sets store:false (adapter source maps maxOutputTokens to max_output_tokens). Existing repository uses direct OpenAI; no new AI Gateway/provider introduced.

Reviewed prior official Supabase RLS guidance in /workspace/research/rls.txt: policies alone are insufficient for security-definer mutations, so each RPC derives/checks its own owner and has restricted execution. PostgreSQL functions/constraints/RLS were exercised with PGlite; that is not GoTrue/PostgREST acceptance. References: https://supabase.com/docs/guides/database/postgres/row-level-security ; https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text ; https://platform.openai.com/docs/api-reference/responses . Current pricing and live provider capabilities remain unverified in this environment.

## Release gates inherited

Phase Two Vercel preview succeeded. At next-phase inspection, database CI for PR #82 failed and application CI was pending; remote failed logs remain network-denied. Local Supabase image extraction previously exceeded the 32 GB Docker workspace. Those gates are not marked fixed by SQL emulation or intercepted browser tests. This phase does not retry unchanged external blockers. Corporate Phase Two remains independent and requires founder release-base/runner-billing decisions; no corporate change is needed for a gated technical slice.

The existing local-only `npm run test:integration` script now includes Architect two-user PostgREST checks (save/replay/conflict, founder-vs-owner isolation, anonymous/grant denial and deletion). It uses the existing synthetic accounts and loopback guard and invokes no model. This added acceptance section is unrun here because no local Supabase exists. Execute it after the reviewed local/staging schema is available; do not weaken assertions to accommodate an unapplied migration.

## Local validation receipt

- Lint and typecheck passed; production build passed with `/api/architect` and the retained workshop routes.
- Final unit/SQL suite: 61 files, 432 tests passed. Seven Architect SQL tests cover ownership, immutable/replay/stale behavior, privilege escalation denial, reservations/concurrency/monthly/daily/expiry enforcement and deletion. Service/API tests use mocks and assert reserve-before-provider, no automatic canonical write, failure/duplicate/config/input rejection and origin/consent validation.
- Focused Playwright: 22 passed across Architect cloud/local, Ecosystem and retained Talk. Two cloud lifecycle tests intercept API responses and are explicitly not live Auth; they exercise identical UUID/snapshot retry after a simulated uncertain save, explicit consent, proposal review, local application, cloud revision save and deletion. Signed-out real route denies access with no inference request. Existing static preview isolation/export/reopening and 320–2560 px navigation checks passed.
- Recorded hosted migration ledger hashes unchanged; additive SQL tested in PGlite only. No hosted migration, grants, live provider call, customer charge, DNS or production promotion.
- Extended local-only `test:integration` acceptance is unrun. No production readiness claim; provider prices/usage and real Auth/RLS need dedicated acceptance.
