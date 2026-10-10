# Phase One validation — 2026-10-10

## Current-instance results

| Check | Result |
|---|---|
| Node 24 / frozen npm installation | PASS; app dependency declarations and lockfile unchanged |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS; production build also completed its TypeScript gate |
| `npm test` | 57 files / 411 tests PASS (entire unit + fast SQL/RLS suite) |
| `NODE_USE_ENV_PROXY=1 npm run build` | PASS, normal Next.js production build; model checksum retained |
| `npm run db:ledger` | PASS, 28 recorded application files checked against hosted ledger snapshot |
| Preserved browser regressions | 32 PASS in 37-case run; five mobile transcript-space failures diagnosed as new navigation wrapping and corrected |
| Final new-route and Talk acceptance | 14 PASS, all final route/geometry/privacy/draft/focus scenarios |
| Screenshots | Production-rendered directory and Health at 390/1440, reviewed for text contrast and navigation layout |
| Migration/access/billing/identity/provider-adapter diff | None |
| Secret/unintended-change review | New config contains no credential values; ignored assets/generated build state stay local |

Final focused command:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- \
  tests/browser/ecosystem.spec.ts tests/browser/talk-layout.spec.ts --workers=2
```

Preserved regression command:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- \
  tests/browser/ecosystem.spec.ts tests/browser/shell.spec.ts \
  tests/browser/talk-layout.spec.ts tests/browser/membership-billing.spec.ts \
  tests/browser/company-platform.spec.ts tests/browser/council.spec.ts --workers=2
```

Two preexisting tests had an exact three-link assertion; their expected count is now four for the additive Ecosystem destination. No assertion, capability guard or production-denial check was removed. A stronger new check verifies all four links share one mobile row. The Talk tests retain transcript ratio, composer height, draft preservation, keyboard/focus return, reduced motion and short-screen visibility checks. Tests intercept synthetic AI/member/billing responses where specified; these are not live-provider or payment tests.

## Setup limitations and unrun gates

Cold full local Supabase images exhausted the 32GB VFS-backed Docker storage. Even a supported minimal Auth/Postgres/PostgREST/Kong configuration exhausted storage while extracting the pinned PostgreSQL 17 image. Alternate official registry routing addressed network failures but did not solve storage. Only newly downloaded, unused images were removed; no database was created/reset and no customer data was accessed. `test:integration` and `test:founder` remain UNRUN and need a larger Docker-capable environment or separately approved synthetic staging. Fast SQL tests do not establish real Auth/PostgREST readiness.

The initial build download needed the managed proxy and allowed `storage.googleapis.com`; this was resolved with `NODE_USE_ENV_PROXY=1` and the saved allowlist. TLS and model SHA-256 verification were never disabled. A supported `SUPABASE_HOME` avoids the read-only default home; no credential values were printed.

GitHub API calls to `api.github.com` returned Forbidden; its required domain is saved in the configuration draft. Native Git publication succeeded for both feature branches, and draft member PR #81 was created through the supported GitHub CLI flow despite earlier REST failures. No GitHub API token was requested merely because the CLI status failed. Corporate repository has no existing main/default commit to serve as a PR base. No new main/production branch is created by this phase.

The entire historical browser suite, real authenticated/model acceptance, physical Samsung Fold/DeX and installed-device checks were not rerun. Historical STATUS reports broad legacy failures; those are not claimed fixed or freshly reproduced. Only relevant scenario outcomes above are represented as verified.

No live Stripe product, Supabase schema, member account, domain or production deployment was changed. Cross-site origins and corporate inbox remain unset until founder verification. SSO and sensitive Health services remain planned.

Evidence: [directory desktop](evidence/ecosystem/directory-desktop.png), [directory phone](evidence/ecosystem/directory-phone.png), [Health desktop](evidence/ecosystem/health-desktop.png), [Health phone](evidence/ecosystem/health-phone.png).

## Delivery receipt

Member branch: `feat/human-ascendance-foundation`, implementation `e3d2d1974c26a7e94e2f5f779ba262b77155535e`. [Draft PR #81](https://github.com/neilaureliuscollective/gent-ascend-collective-app/pull/81), base main. Native push and remote SHA verified. Subsequent documentation receipt commits stay on this same review branch. No merge/deployment performed.

Corporate branch: [feat/corporate-headquarters](https://github.com/neilaureliuscollective/aethelios-human-ascendance/tree/feat/corporate-headquarters), implementation `497ffb2688e11eb37f1d53ae8141369417f6cd0d`. Native push and remote SHA verified; no remote main exists for a PR base. No main branch invented.

Cloud install/start instructions and required domain additions are saved as a review draft, separate from website deployment. Reusable steps prepare both repositories; publication of the cloud snapshot is user-managed.
