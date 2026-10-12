# Studio media connection — October 12, 2026

## Executed on the existing database

Used the one canonical **Gent Ascend App** Supabase. No extra hosted database, branch or application was created. After checking existing project constraints, absent media contracts and policy-name collisions, applied the two reviewed additive migrations. No member records were read, modified, reset or seeded. Existing image services and the original private image bucket remain intact.

| Capability | Hosted migration | Exact SQL MD5 |
| --- | --- | --- |
| Narration records, enduring allowance, owner RPCs and private WAV storage | `20261012095748_studio_narration.sql` | `81ed19b631ac8e2bbbf6115f5ee21a95` |
| Footage quotes/jobs, enduring allowance, signed-receipt state and private MP4 storage | `20261012095801_studio_footage.sql` | `a627d4d420dd1fb946413d0d824d8201` |

The hosted migration service assigned these versions. Renamed the two previously unapplied candidate files to match the hosted ledger, preserving their SQL bytes exactly; registered both hashes in the existing migration ledger check. Earlier candidate names were `20261012120000_studio_narration.sql` and `20261012180000_studio_footage.sql`. Source comments describing candidate status are historical and intentionally preserved to keep deployed hashes immutable. Do not apply the old candidate names again or repair/delete hosted history.

## Verified, with limits

Executed [the read-only catalog check](../supabase/verification/studio_media_readiness.sql) against the hosted database: **20/20 checks passed**. Four tables have RLS and authenticated SELECT only; direct member INSERT/UPDATE/DELETE and anonymous SELECT are denied. Seven reviewed state/quota functions have empty search paths, authenticated execution and no anonymous execution. Owner policies map persons through `auth.uid()`. Private storage policies require the authenticated user's folder for both existing-row access and new-row checks. WAV is bounded to 3,000,000 bytes and MP4 to 30,000,000 bytes with explicit MIME types. The original private image bucket remains 10,485,760 bytes.

Inspected all existing Storage policies for additive-policy overlap: existing grooming and image policies are restricted to their own buckets, rather than granting blanket access to the new media buckets. The reusable catalog check verifies expected contract metadata; it is not proof of all future policies, function behavior, HTTP Storage isolation or provider operation. Local SQL tests exercise ownership/quota semantics, and a regression checks that the catalog check detects a removed owner policy or accidental anonymous RPC grant.

Security advisor before/after: 11 existing RLS-without-policy informational findings remain unchanged; authenticated security-definer warnings increase from 67 to 74 for the seven intentional owner-checked quota/state APIs. These require reviewed privilege/owner semantics, not a claim of a warning-free database. Existing leaked-password-protection warning remains unchanged. Remediation references: [authenticated definer APIs](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password security](https://supabase.com/docs/guides/auth/password-security). Unrelated shared-database policies were not altered.

No provider key was decrypted, generated media requested, paid job reserved, feature enabled, app merged or production deployment performed. Hosted SQL metadata checks do not substitute for ordinary-account Auth/Storage acceptance. The Studio integration remains in PR #99; applying database foundations does not make that unmerged application code live.

## Remaining setup — no credentials in chat

1. In the existing Vercel project, confirm the existing server-only `OPENAI_API_KEY` has current image and GPT-Audio-1.5 permissions and an appropriate provider budget.
2. Add an application-specific `RUNWAYML_API_SECRET` and a separate random `STUDIO_FOOTAGE_SIGNING_KEY` of at least 32 characters as server-only Secrets for the protected preview candidate. A connected ChatGPT Runway account does not provide the deployed application key. Fund and bound the Runway API budget. Preserve the signing key.
3. Keep `STUDIO_NARRATION_ENABLED` and `STUDIO_FOOTAGE_ENABLED` off until the corresponding private Storage/RPC and budget checks are accepted. Controlled preview testing requires deliberately enabling only the feature under test and explicit approval of its real generation. Do not enable production flags as a side effect.
4. Through two ordinary authenticated accounts, verify access/denial, then explicitly approve one short narration and one 5-second footage render. Compare provider charges; save, reopen, play/seek and download actual outputs; verify uncertain-save recovery without a second paid request. Record real output host and applicable device results. No borrowed service-role session or fabricated ownership evidence.
5. Review the complete main-targeted PR, current CI and deployment/rollback plan for founder-approved production release. Rollback first disables media flags and returns to the previous app deployment while preserving private records and immutable migration history; do not drop tables/buckets to roll back a UI release.

The three launch phases remain integration/provider acceptance, product/device acceptance, and approved production release. This phase completes the hosted schema portion of the first phase. Credentials and live acceptance remain open.

## Research

Rechecked official [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [database migrations](https://supabase.com/docs/guides/deployment/database-migrations), and current documentation search for RLS/migration guidance. Storage authorization is enforced by policies, not merely private-bucket metadata; overwrites need SELECT/UPDATE as well as INSERT. The changelog markdown endpoint was attempted but rejected by the web tool's content-type handling, so no unsupported breaking-change conclusion is asserted. Existing OpenAI-direct and reviewed Runway model/API contracts are unchanged.

## Current main reconciliation

Main advanced to `f3b4302` (Founder Office compatible reader and rollback work) during this phase. The Studio candidate preserves all 47 changed/new main files and resolves the two founder-test overlaps with current navigation and the restored FirstSession flow. Existing Studio memory/daily persistence assertions remain; no unrelated PR was merged. The remote integration commit retains current main as an additional parent.

## Connection-phase verification

At `58cb1b7`: local lint/types, all 489 unit/SQL tests, ledger and optimized build passed. CI Studio (12 browser checks), Obsidian visual, Lifestyle and real local Supabase database/Auth/founder (12 checks) passed. Broad application E2E passed 409/410; the remaining installation test navigated during initial service-worker claim and observed a correctly upgraded cache on an uncontrolled document. The follow-up seeds old caches on the static offline page before AppRuntime starts, then waits for genuine control before navigating to the workspace. All original cache, control, waiting-worker, unrelated-cache and draft-preservation assertions remain. It changes test sequencing only, not production worker behavior.

Automatic Vercel preview initially failed before compilation with `git_info_fail`. Retried the exact commit through the existing Git connection on a non-production target; no production promotion. Final CI and preview receipts are tracked in PR #99.
