# Founder Live activation candidate — October 13, 2026

Integrated onto current main `810966302c2074df98eedf06edae6a6d8a030020` from recovery `398037e9587f0c1a5d84e712b97a1605005621b8`. That recovery was built on Talk `0c45b2f`; newer privacy/material commits are preserved. No hosted environment mutation, migration, credential, real microphone capture or paid provider call belongs to the code change. Construct PR116, Connections PR117 and Architect first-site remain separate.

Shared-shell overlap: `src/components/shell.tsx` now computes Live availability from `liveShellAvailability` and the session `founder_access` result already loaded as `founderOffice`. The local harness `founder` prop still only gates `/dev`. `.env.example`, `docs/STATUS.md` and `docs/DECISIONS.md` received Live-only notes; Construct/Connections keys were not edited.

## Implemented

The original production guards (`liveConfig` `env.mode === 'production'` and Shell `APP_ENV`/`VERCEL_ENV` production exclusions) existed to prevent accidental paid Realtime admission, public/beta rollout, and voice without proven independent expiry. They are replaced only by equivalent intentional checks: default-off `AETHELIOS_LIVE_ENABLED`, production-only `AETHELIOS_LIVE_FOUNDER_PILOT`, `AETHELIOS_LIVE_CONTROL_READY`, canonical Gent binding, independent expiry configuration, supported model and existing OpenAI key. Ordinary beta accounts cannot pass founder-only admission. Authority comes from the session-bound `founder_access` row before reservation/provider admission and is rechecked during the existing five-second monitor even when beta membership remains. Talk always exposes the Live control; when admission is closed it explains why instead of returning null. Preflight reports configuration only, never acceptance.

The existing WebRTC/Realtime engine, owner RPCs, explicit transcript/context consent, 120-second reservation, sideband context acknowledgement and expiry leases remain. No GPT-Live adapter swap, additional scheduler, migration, background execution default, Health flag or external action was added.

Lifecycle repairs: a late remote-description result cannot install an expiry timer after End; simultaneous End requests share a receipt, but a late POST admission always causes a fresh cleanup after an earlier End; HTTP success without `{ended:true}` leaves cleanup pending and blocks another start; delayed playback promises cannot mutate a later session. Transcript positions are reserved before late ASR. Context seed items are not rendered as user utterances. Server persistence keeps response order, latches interruption before completion, waits for final usage, and does not double-count duplicate completions. Sideband cleanup now checks the database End acknowledgement. Provider admission rejects redirects.

## Single expiry path (authoritative)

Do **not** activate `ops/live-expiry.vercel.json`. It remains an unused template. `vercel.json` has no `crons` on current main, this branch, or the inspected preview worker. Adding Vercel Cron would duplicate cleanup.

| Role                        | Authoritative choice                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduler                   | Existing Gent `pg_cron` job `aethelios-live-preview-expiry` (every minute). Conditional HTTP when expired unconfirmed calls exist.                                                       |
| Endpoint                    | `GET /api/internal/live-expiry` on the job’s current target host.                                                                                                                        |
| Last inspected target       | `https://gent-ascend-collective-app-git-integration-7ec769-stutes-legacy.vercel.app` · deployment `dpl_7X5B5rQqrtpsqjVRrx2PwLBDm2Ad` · source `bfff19edb65875dc961c7a8fadc2661e830bc933` |
| Worker source compatibility | Git blobs for `src/domains/live/cleanup.ts`, `expiry.ts`, `expiry-readiness.ts` and `src/app/api/internal/live-expiry/route.ts` are identical on `bfff19e` and this PR head.             |
| Not this path               | Next `after()` monitor (best-effort while the admitting function lives). Owner `recoverExpiredLive` (runs only when the owner admits again).                                             |

Reverified 2026-10-13 from this workspace: unauthenticated GET of the preview target returned Vercel Authentication (302 / login HTML), so this environment cannot prove the cron request reaches the handler. Unauthenticated GET of `https://www.gentascend.com/api/internal/live-expiry` returned `404 {"error":"Not found."}` — the production route is present and fail-closed because `AETHELIOS_LIVE_EXPIRY_ENABLED` is not true. Idle cron success is not HTTP-handler proof and not provider hangup proof.

`expiryReadiness` / production admission still inspect the **admitting deployment’s** `AETHELIOS_LIVE_EXPIRY_ENABLED`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Those names are required on Production before founder-pilot admission can open, even while the HTTP worker remains the preview target. That is configuration presence, not delivery. The worker’s `OPENAI_API_KEY` must be the same secret used at admission or HMAC hangup verification fails. Do not retarget the cron job or weaken Vercel protection without a specific approved change.

## Current resources, read-only evidence

Canonical Gent project `volpzkfsnmtztrovexcw` has all seven core Live migrations, plus three later preview scheduler/delivery migrations. `pg_cron`, `http`, `pg_net` and Vault are installed. No new hosted migration was applied in this work.

Vercel environment metadata (no secret values read) puts Supabase URL/publishable key, APP_ENV, harness setting and OpenAI key in shared production/preview records. Existing expiry/service-role/cron-secret/canonical-pilot settings are restricted to the integration preview branch. There is no proven isolated Gent backend: its branch list is empty. Separate `esna-command` and `RAS App` projects are other products, not authorized test targets. An ordinary preview is therefore not proof of database isolation. Docker responds locally, but no Supabase containers were running; no new local stack or credentials were provisioned.

## Verification and limits

Regression tests cover browser and server cancellation, late admissions, receipt uncertainty, autoplay promise rejection, founder revocation with beta retained, ordered speech/typed transcripts, context consent and sideband seed acknowledgement. A disk-backed PGlite test applies the existing migration chain to synthetic data, saves typed and spoken turns through owner RPCs, closes/reopens the database and verifies owner readback plus cross-person denial. Its Auth/Storage catalogs are test adapters: it is not real Supabase Auth/PostgREST acceptance.

Exact final commands, SHA, logs and browser results are in the separate evidence archive. The standard prebuild asset fetch remains runner-DNS blocked (`storage.googleapis.com`); the separate optimized webpack build is not an equivalent asset-preparation result. Physical Fold/iPhone/DeX, microphone/audio quality, real provider cancellation/latency, authenticated hosted ownership/persistence, Storage and paid expiry termination remain unverified. An enabled UI or a successful cron receipt does not close those gates.

## Proposed approval boundary, not executed

1. Preserve the accepted Talk deployment and its rollback. Refresh source/configuration again before any hosted operation. Publish only this reviewed candidate to a protected preview after approval; retain deployment protection and use an already authenticated founder browser route. Do not create shareable authentication-bypass links. If no authorized authenticated route is available, stop at that specific access blocker.
2. Recommended existing-resource route is an explicitly acknowledged **shared canonical database founder pilot**, not fictional staging. Reuse the current OpenAI credential, session-bound founder Auth, installed schema and existing minute scheduler. No migration, separate product project, new API key or duplicate job. Preview needs explicit APP_ENV=preview with harness off and branch-specific existing Live/control/canonical/expiry/worker configuration. Keep admission off until signed expiry cleanup and ownership acceptance pass. Existing scheduler can continue against the same canonical DB/key; do not retarget it merely to rename the application preview.
3. Request a bounded acceptance window: up to four sessions, each at most 120 seconds, one verified founder, synthetic transcript content only, personal context off, background tools off. Permit only synthetic owner conversations/turns/Live reservations/usage/expiry rows and deletion of the created conversations after readback; retain usage/cleanup receipts as designed. Test explicit Stop, VAD interruption, typed-to-voice history, End, reload and one intentionally abandoned expired call with the admitting browser/process absent. No real sensitive history, email, image/music/voice cloning or external execution. Reserve at most US$5 of existing OpenAI credit for the window, with provider usage checked before/after and no unattended retries. This is a requested spend ceiling, not a demonstrated application dollar cap: if bounded usage cannot be enforced or confirmed with existing controls, do not start paid acceptance.
4. Production promotion is separate and held until evidence closes the gate or Neil explicitly accepts the named exception. Production configuration would need the new founder gate plus existing controls and safely scoped existing worker credentials; no secrets in chat/artifacts. Keep broader beta admission off. Roll back by disabling admission first and redeploying the accepted Talk SHA; keep independent expiry and its credentials alive until all admitted sessions have confirmed cleanup. Never roll back data by deleting migrations or resetting the shared database.

Neil accepted the already-deployed Talk release for his hands-on testing. That acceptance is preserved and is not a new authorization for this paid hosted Live window. No additional approval of existing Talk is requested.

## Rollback that drains sessions

1. Disable admission first: set `AETHELIOS_LIVE_ENABLED=false` and `AETHELIOS_LIVE_FOUNDER_PILOT=false` on the affected environment, then redeploy. Keep `AETHELIOS_LIVE_EXPIRY_ENABLED`, worker database authority and `CRON_SECRET` in place until every admitted session has a confirmed hangup/end receipt.
2. Do not rotate `OPENAI_API_KEY` or HMAC-relevant secrets until cleanup has finished; old call tags would fail verification.
3. Redeploy the previous accepted production SHA if the Live code path itself must be removed. Independent expiry should remain reachable until drain completes.
4. Never roll back data by deleting Live migrations or resetting the shared Gent database. Saved Talk transcripts and usage/cleanup receipts stay.

A disabled Live button with an unavailable explanation is the expected post-rollback Talk state. An inactive preview is not production voice.
