# Health validation and release evidence

Source baseline `c0a7f35`; branch `feat/health-intelligence-foundation`. Evidence is local implementation, not production activation.

- Lint and strict TypeScript: passed in completed checks; final results recorded below.
- Full Vitest regression: 449 tests / 65 files passed in latest completed run. Includes Health import/provenance, SQL ownership/grants/versioned amendments/revocation, durable deletion/tombstones, bounded PDF worker and HTTP origin/body boundaries.
- Optimized Next production webpack build: passed; six Health pages and three API routes included. Worker/dependency paths verified in the Health route deployment trace.
- Historical migration checker: passed for 28 recorded source hashes. It does not compare live schemas or prove the new migration applied.
- Browser bundle compiles offline from actual Health components and labeled synthetic data. Browser assertions added for phone/Fold/desktop, source values, explicit review, exact uncertain retry, permissions, dialog focus, account-change clearing and production HTTP privacy boundaries.
- Browser execution: blocked before page load. Chromium fails on sandbox-prohibited socket operations (crashpad setsockopt, then sandbox_host shutdown); seven fixture attempts failed at launch. No rendered screenshots, visual acceptance, overflow/contrast or physical-device acceptance is claimed.
- Local HTTP server: denied `listen EPERM 127.0.0.1:3102`. Real production-runtime HTTP tests remain unrun here.
- Real local Supabase Auth/Storage: unrun. Docker socket access is denied. Existing real-Auth smoke extended with Health owner/anonymous/unexposed-schema/inactive-ingestion checks for CI. SQL emulation is explicitly not real Auth or Storage API evidence.
- `npm run build` prebuild: blocked retrieving the existing pinned Mirror model. Direct fetch failed DNS; proxy-aware fetch failed socket EPERM. The additional network request was interrupted. The successful webpack build was invoked directly; no missing-model fake asset was supplied and the Mirror prebuild was not weakened.
- Supabase CLI migration creation: failed on read-only `/home/agent/.supabase`; added sandbox permission request was interrupted. The additive SQL migration was prepared as a documented local fallback, with actual timestamp and tested full migration application in PGlite. No CLI reset/type generation, hosted apply, migration repair or production seed occurred.
- Node child-process PDF parser initially failed spawn EPERM. Replaced with bounded worker-thread parser; real ordinary/exchange/invalid PDF tests pass. No source text is logged.
- React best-practices review: server authorization retained, independently degraded reads, conditional parser/model loading, no shared mutable request cache, no sensitive browser persistence, cleanup on session/page visibility changes, native dialog/focus mechanics reused. Whole-page visual/accessibility verification remains open.

CI can run `npm run check`, `npm run test:e2e`, local Supabase reset/advisors, `npm run test:integration`, and founder browser gates on a permitted runner. No check is suppressed or represented as green when unrun.
