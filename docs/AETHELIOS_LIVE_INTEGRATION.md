# Aethelios Live — integration and conditional release

October 12, 2026. Founder authorizes production release **if ready**. This authorizes a reviewed integration candidate; it does not turn failed or unrun gates into passing evidence. Current production stays the Obsidian Intelligence release until acceptance passes.

## Source recovery and preservation

Canonical repository/project remain unchanged. Normal `git fetch` cannot reach the execution environment's proxy. The authenticated GitHub connector recovered the 50 files changed between the shared base `32d1c4c` and production commit `9d973fe94526cbd5c98f5ea1495c999ddd3f803e`. Every retrieved UTF-8 file was checked against its Git blob SHA. The reconstructed complete tree equals the production tree **`b6942117efee5530a5196a6a7dd244522c28663e`**.

An isolated worktree at `/workspace/aethelios-live-integration` merges that verified snapshot with the approved Live stack. The original Live worktree is preserved. The recovered snapshot is a local provenance commit, not a replacement for GitHub history; the published candidate must parent the actual current main commit and preserve its tree plus the reviewed integration delta.

Resolved two conflicts: retain both production/Live status receipts; retain production's removal of duplicate Studio navigation while keeping Live's owned project/version URL handoff. Preserve all current Obsidian public/member/offline styles and the already deployed TypeScript compiler-API build setting. Keep the Live member-route microphone policy, root controller and default-off/production admission guards. Cinematic binary assets/voiceovers, billing/Auth policies, ElevenLabs and other repositories are untouched.

## Next validation slice

Added `Aethelios Live integration` CI, with reviewed exact action SHAs, read-only repository permissions and no persisted checkout credential. It runs the real pinned asset preparation, production build, lint/types/unit/SQL checks, migration ledger and focused synthetic Live/Obsidian browser tests in the connected GitHub runner. Existing broad Quality/Obsidian checks remain intact; inherited failures are not disabled or converted into passes. Browser fixture success cannot establish real provider or physical-device performance.

A separate CI job starts/reset **local** Supabase, prepares the existing synthetic password identities, creates one trusted local founder grant and runs `npm run test:live:auth`. This new script verifies normal password Auth/PostgREST Live reservation/end ownership, denied anonymous/non-pilot/cross-account access, completed synthetic coworker review, stale-version/changed-replay denial, one user-confirmed daily action and canonical readback after voice ends. It never calls OpenAI or proves provider hangup. The grant fixture lives under tests, not migrations, and is invoked only with `supabase db query --local`. It requires the exact seeded synthetic ID/email; normal member clients still cannot grant themselves authority. The script rejects non-loopback/non-HTTP database URLs before sign-in. No hosted reset, seed, grant or migration write is part of this validation.

## Research and release policy

Reviewed current [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks), [GitHub secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use), the installed deployment skill and its deployment-check reference. Current v4 checkout/setup-node/upload-artifact refs were read directly from official GitHub Git data and pinned to their exact SHAs. Prefer the existing Git integration, keep previews separate from production, and never force-promote around failed checks. Published commit/tree identity must be matched to the tested deployment; promoting a preview can rebuild it with production configuration.

The current Vercel OpenAI Secret is already scoped to Preview/Production. No replacement credential or Gateway is needed. Pending Live migrations, exact non-production database binding, real user-session testing, actual native audio, model/billing measurements and independently proven expiry/hangup still gate activation. `AETHELIOS_LIVE_CONTROL_READY=true` is a declaration, not proof. Production admission remains rejected until these controls are implemented/accepted.

## Observed local results

Integrated lint, typecheck, **75 files / 491 unit/SQL tests** and historical 28-file ledger pass. New integration script parses with Node. Local production build/browser execution still cannot complete because the pinned MediaPipe download and loopback serving are restricted; no check or asset is bypassed. Real local Supabase Auth acceptance requires the connected CI Docker runtime. Remote CI/deployment receipts must be recorded separately after publication.

## Release decision

## Connected candidate evidence — October 12

Published draft [PR #90](https://github.com/neilaureliuscollective/gent-ascend-collective-app/pull/90). Initial GitHub commit `0feae2a22ce1afcd81c370454148d866896fdffd` has exactly the locally validated tree `46578c399f573791be1f340db0eefd3f0265b527`. Its Vercel preview `dpl_GvWpFo2ag9ymYCTMBSQHJAawYyKP` reached READY, and connected CI passed the production build, lint/types/unit checks and **real local password Auth/PostgREST Live/action job**. Focused browser checks passed 32/34; both failures were the creation-task select's implicit label including option text. Added a unique explicit label association; the same approval/edit assertions remain required on phone and desktop.

Main advanced to Lifestyle commit `c13bced429ef4a8aeb22b9d7205dba19618b67d7`. Recovered its 54 changed files with blob checks and verified the complete source tree `20c8e60287c631d70d7bcc3b572ebe00e6101e01`, then merged it into the candidate. Both Lifestyle and Live fixture modes, navigation and status receipts are preserved. Combined local lint, strict types and **77 files / 504 unit/SQL tests** pass; ledger still verifies 28 historical files. Connected revalidation of this combined tree is required.

Existing broad Quality gates are not green: the initial candidate's real founder browser suite passed 7/11, with failures in legacy Memory, entrance-button and Command selectors. These checks remain enabled and their failure blocks readiness; the new local Auth job does not substitute for them. No actual provider audio, acoustic latency, billing, hosted migration rollout or physical-device acceptance has been measured. OpenAI credentials already exist in the correct Vercel scopes; credentials alone do not satisfy these gates. Live remains default off and production admission rejected.

## Conditional activation decision

Not yet ready to enable or promote Live. Prepare a draft integration PR and protected preview, run exact-head connected CI, triage genuine regressions, then finish the documented non-production migration/provider/hosting/device gates. If any required gate remains failed or unrun, keep the candidate in review and production unchanged. The founder's conditional release authorization persists; no repeated permission question is required once those gates actually pass.
