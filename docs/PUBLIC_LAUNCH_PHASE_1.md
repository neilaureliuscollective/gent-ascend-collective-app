# Public launch Phase 1: public entry and first value

## Scope and source

Founder authorized the first of four consolidated public-launch phases on October 4, 2026. Base: main `6abfd6d90bf433a85e3eda53e29bacd60662ec03`. Recover the unmerged free-account work from PR #41, source commit `dd3798186e28a017f50c18b6733b222e5f91f7ac`; local recovery commit `c75c90d`. Preserve current Command and Shopify changes during conflict resolution. This is a review branch, not production activation.

## Resulting experience

- A visitor can prepare a direction in the public world, then explicitly create or enter a free account through configured Google or email-code entry. Existing password entry remains supported.
- Browser-local direction imports require review. The owner-derived claim RPC validates account/day, locks the daily row, preserves existing daily fields/actions, and records an idempotent receipt. Conflicting saved direction requires explicit replacement. Authentication never grants paid, beta, founder or clinical authority.
- Free members reach Welcome without an invitation wall. Three authored paths—presence, body and focus—offer editable first steps. The member reviews their priority and next move and explicitly saves them to existing Daily Command.
- Priority saving preserves energy, sleep, reflection and existing actions. It appends one bounded action, avoids an existing open duplicate, and refuses a sixth action. Owner/day/version checks reject stale or mismatched writes.
- Failed or uncertain saves retain draft text. Uncertain outcomes require reloading saved context before another attempt; a switched account cannot reuse another account's snapshot.
- Returning accounts with saved direction resume Command. Eligible members can carry actual saved priority into an editable Aethelios prompt; sending remains manual. Free members see the real membership entry.
- Facebook/Instagram browser guidance explains native-browser limitations and device-local drafts. Copying the entry link includes only the public origin and `/enter`, without query, private context or authentication tokens. Installation remains optional.
- Entry requests are retained in the public URL so independently hydrating panels cannot lose a signup click. Action confirmation restores keyboard focus after the saved-state render re-enables the original control. Existing full-suite assertions exposed both timing issues; neither check was removed.

No model upgrade, new subscription price, automatic AI request, private invitation grant, hosted configuration change or commerce activation is included.

## Verification ledger

| Evidence | Result | What it establishes |
|---|---|---|
| ESLint and generated Next/TypeScript checks | Pass | Source consistency |
| Vitest suite | 303 tests, 37 files pass | Domain guards and PGlite SQL behavior |
| Targeted browser suite | 11 tests pass | Account-claim fixtures, reviewed first session at 360/768/1440px, uncertain-save recovery and Facebook notice |
| Webpack production build | Pass | Production compilation and route generation with lockfile-matched linked dependencies |
| Migration ledger | Pass | Existing tracked production hash snapshot; does not apply the recovered migration |
| Real local Auth/PostgREST | Added to release CI | Conflict/replay, owner isolation, unchanged privileges and first-session persistence; cannot run in this checkout without local Supabase/Docker |
| Normal Turbopack build and complete browser suite | Release CI | Required clean-checkout release gates |
| Hosted signup and physical device checks | Pending | Actual email delivery, Google callback, Facebook handoff and installed behavior |

Local dependency installation exceeded available scratch disk. The dependency tree used for local checks matches this lockfile exactly, but is linked from another checkout; webpack handles that layout. A local image-cache size warning occurred under this constraint. The browser flows passed. CI must verify the normal independent installation and build.

Integration attempts here stop at the missing local `.env.development.local`; fixture/PGlite results are not hosted identity proof. No live model call is claimed.

## Activation contract

Keep `ACCOUNT_SIGNUP_ENABLED`, `ACCOUNT_AUTH_READY` and `ACCOUNT_GOOGLE_READY` false until the corresponding hosted gates pass. Membership signup flags remain independent. Review and apply recovered additive migration `20261002165518_account_claim.sql` through the established database process before enabling claim traffic; never rewrite applied migrations.

Verify approved public origin/redirect allowlists, real SMTP delivery and email OTP template `.Token`, Google client/provider callbacks and PKCE completion, configured bot protection if enabled, rate limits, expired/incorrect code recovery, sign-out/account-switch behavior and cross-owner denial. Run a real new free account from a public Facebook link through first saved value and a return visit. Confirm membership privileges remain unchanged. Check phone/Fold/DeX, reduced motion and installed entry with physical devices. No invitation-only launch dependency is introduced.

Rollback disables public signup readiness and reverts presentation code as necessary; preserve member Daily records and claim receipts. Do not drop the additive ledger as a UI rollback.

## Next phases

Three consolidated phases remain after Phase 1 acceptance: (2) connected daily experience across Command, grooming, training and coaching; (3) subscription and product revenue with actual merchant/provider readiness; (4) full public release acceptance, observability and support. Phase 1 alone is not a completed premium launch app. Keep the existing domains and strengthen their shared personal context rather than adding parallel dashboards.

## Research basis

Recovered account-entry research and its original activation checklist are in `ACCOUNT_CLAIM_PHASE_1.md`. Implementation follows Supabase's official [email passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [Google SSR login](https://supabase.com/docs/guides/auth/social-login/auth-google) contracts, plus installed Next route-handler/cookie documentation. No dependency upgrade or unverified new Auth API is introduced. Authored starting paths reduce the decisions required before first value; this is a design hypothesis, not measured conversion uplift. Capture real activation and return-visit results before optimizing it.
