# Ascend Performance — Phase 1

Founder approved the planning brief on September 27, 2026. Implemented September 28 UTC on the canonical Gent Ascend repository, based on main `dfc3ed7e3a3dc56d565695fd766624ed5eb96a42`. Build authorization does not promote production.

## Delivered slice

- `/app/performance`, discoverable in My world. Today, Training, Restore and Review form one performance environment with the existing green/obsidian/gold identity. Whole-man Command remains the parent experience.
- Editable direction, experience, equipment, available time, limitations and unit preference. An equipment-specific starting template must be reviewed and saved; it is not an injury-specific prescription.
- Editable strength session with movement order, sets, reps, load and rest. Plans retain their own unit and revision. Plan history preserves the saved exercises, change reason and evidence session IDs.
- Workout set recording, optional effort, discomfort flag, note, partial completion and a timestamp-based rest timer while the page remains open. Completed records retain the session's original targets. Completed/abandoned sessions are immutable in this phase; corrections are a later explicit revision flow.
- Optional self-reported sleep, energy, soreness, weight, calories, protein and water. Partial nutrition and missing observations stay distinct. Weight retains the entered unit. Performance observations are separate from the existing daily journal and clinical records.
- Seven-day review, recent session history and optional OpenAI interpretation using the existing Aethelios provider and usage reservation. Sharing occurs only on the clearly described review request. It does not create AI memory.
- A deliberately narrow, explainable rule can propose one extra rep for one exercise after two recent matching sessions, all planned sets at the target load, effort <=7, no recorded discomfort/limitations or demanding current check-in. User approval is required. This is a trial rule requiring field evaluation, not a calibrated physiological model. No generated readiness/body-fat score, automatic calorie adjustment, clinical intervention or body rendering.

## Data and authorization

Additive CLI-created migration: `20260928021459_ascend_performance_phase_1.sql`.

Person-owned typed profiles, check-ins, sessions and normalized set rows. Plans carry validated exercise snapshots and immutable revision records. All public tables have owner SELECT RLS; direct application writes are revoked. The public invoker RPC delegates to a non-exposed private definer function with explicit `auth.uid()` ownership resolution, a fixed search path and per-person serialization. Keep `performance_private` out of Data API exposed schemas.

Each mutation has a UUID receipt and payload fingerprint. Identical retries return the saved version; changed payloads reusing an ID and stale versions fail. Session completion and its whole-man timeline reference commit together. A proposal also checks the current profile/check-in versions, local day, and latest evidence session IDs inside the transaction. No clinical values enter timeline payloads. The checked-in TypeScript contract follows the repository's existing manual-type approach; verify/generated types against the real local database before release.

## Offline contract

A user starts or resumes a workout through an explicit “keep on device” action. IndexedDB stores one workout per current account, not the full personal dashboard. Each device edit commits before it is reported as saved. A frozen pending request survives retries; subsequent edits wait behind its acknowledgment. Revision checks reject stale local-tab writes, Web Locks serialize sync where supported, and server receipts remain the fallback against duplicate transmission.

The service worker caches only public static offline assets. `/app/performance` falls back to a small static runner that can reopen and finish the retained workout. Account HTML/API responses never enter Cache Storage. Sync carries the original person ID and the server verifies the active account matches. Account switches remove the prior account's device data; explicit sign-out sets a reset marker handled in both the public shell and offline runner. Anyone with access to an unlocked browser can see this deliberately retained workout. Browser storage eviction can remove it; device save and account sync are distinct visible states.

Sync uses foreground/reconnect attempts, not a promise of background execution. Session writes preserve source times and stable IDs. Conflict handling retains the draft, allows export, and requires explicit choice before replacing it with the account version. The rest timer survives background tab delays using a deadline, but resets on reload. An explicit device removal control is available on the offline page. Account export in Review is honestly labeled as the loaded window: 60 sessions and 90 check-ins plus the retained draft, not a full historical export.

## Verification in this runner

- `npm run check`: passed lint, strict types, 103 tests, production build.
- `npm run db:ledger`: passed all 11 previously recorded applied-file hashes; the new migration is pending, not applied to hosted data.
- Tests include six new SQL cases for ownership, receipts, stale writes, invalid-set rollback, immutable completion, one timeline event, plan revision history and partial intake, plus six progression/schema cases.
- Production HTTP smoke: Performance and My world 200 with private/no-store, public offline assets 200, anonymous reads/writes denied, hostile-origin mutation denied.
- Seven browser scenarios are registered for 344/768/1440 layout/navigation, device reload/retry, remote conflict, HTTP boundaries and the service-worker fallback. The local browser could not run: agent-browser is absent; Playwright's Chromium download returned an invalid archive. Responsive visual, touch, IndexedDB and service-worker behavior remain unverified on an actual browser here. CI captures screenshots when executable.
- Real Auth/PostgREST integration is extended in `scripts/auth-smoke.mjs`, but could not run locally because Docker/local Supabase and the local environment file are absent. PGlite SQL/RLS checks do not substitute for this gate.
- No live paid OpenAI interpretation, hosted migration, production promotion, or physical Fold/iPhone battery/touch verification was performed.

## Release sequence

1. Pass CI and inspect browser evidence. Exercise real local/staging Auth with two accounts, session reconnect, account switch/sign-out, and lost acknowledgment. Verify the private schema is not exposed.
2. Review the Performance screens on Fold cover/unfolded and iPhone; complete an offline workout, reopen, reconnect and confirm one saved session. Verify the offline shell has installed before relying on it.
3. Run a live Aethelios interpretation with synthetic records and assess grounding, latency and usage behavior.
4. Reconcile this additive migration with the current hosted ledger; apply to staging, then production only during an approved release. Rollback application code independently; retain additive data tables.

## Extension seams and deferred work

The Physical Twin begins with these provenance-bearing facts, not a body mesh. Future imported observations need source IDs, original units, observation/ingestion times, method, uncertainty, deletions and source priority before aggregation. Add native Health Connect/HealthKit connectors and qualified wearable integrations in their approved phases. Upcoming work: multi-session programs, exercise-library coverage, calibration of adaptive rules, shared daily observation capture, full export/delete lifecycle, cardiovascular/mobility development, and proven outcome-based nutrition adjustment. A native companion is required for direct device health-store access; no rewrite of the current web domain is implied.

## Research used

Planning review, September 28 UTC: Android Health Connect architecture, sync and aggregate semantics; Apple HealthKit authorization; MacroFactor expenditure model; WHOOP behavior insights; Garmin training readiness; Hevy and Strong logging. The platform fits the existing person-centered modular monolith. Installed Next.js 16 route documentation and the Supabase RLS guide informed implementation.

- https://developer.android.com/health-and-fitness/health-connect/architecture
- https://developer.android.com/health-and-fitness/health-connect/sync-data
- https://developer.android.com/health-and-fitness/health-connect/aggregate-data
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.hevyapp.com/features/
- https://www.strong.app/
- https://help.macrofactorapp.com/dashboard/expenditure
