# Phase 7 — Movement & broader training

Authorized September 29, 2026. Continue the saved Phase 6 branch in the canonical repository. No production promotion.

## Plan and boundaries

- Searchable starter strength library with stable identities, movement pattern and equipment filters. Original metadata; no scraped instructions, exercise media or imported proprietary database. Existing custom movements remain valid and are not silently matched by name.
- Add or replace a movement inside the existing plan/program editor. Preview the change, explicitly accept it, reset load to zero and start separate identity/history. Save the plan/program to commit. Existing workouts keep their recorded prescription. Custom renaming creates a new identity at save.
- Per-exercise progression setting: review eligible rep increases or keep targets manual. Existing plans retain prior behavior; newly selected library exercises start manual. Both server evaluation/acceptance and the legacy plan flow respect this control. No custom safety thresholds or autonomous increases.
- Movement space for completed walking, running, cycling, rowing, swimming, other cardio and mobility. Record local date, minutes, optional distance with original units, optional self-reported intensity and a short note. Mobility uses duration, without cardio distance/intensity fields.
- Versioned correction and explicit removal from summaries (retained audit revisions), exact retries and stale checks. Owner-only read/write RPC; twenty records per day including removed records bounds each 28-day view at 560.
- Seven-day cardio and mobility minutes separately, intensity unknowns, normalized distance grouped by activity, and 28-day editable history. No calories, VO2 max, equivalent resistance volume or inferred progress score. These records do not qualify for strength progression.

## Research, September 29

- Hevy [exercise library](https://www.hevyapp.com/features/exercise-library/) and [programming options](https://www.hevyapp.com/features/exercise-programming-options/): searchable equipment/movement selection and explicit replacement reduce entry friction. Ascend retains immutable completed-workout history and separates timed activity from reps/load.
- CDC [measuring activity intensity](https://www.cdc.gov/physical-activity-basics/measuring/index.html): intensity is relative to the person. Capture an optional self-report, never derive it from activity name or pace. No population target is imposed.
- Supabase changelog and [database functions](https://supabase.com/docs/guides/database/functions): retain owner resolution, fixed search path, scoped private writer/public invoker and revoked direct writes. Current Postgres minor-release notices do not affect the new schema's types/operators.
- Installed Next.js route documentation: use existing authenticated no-store domain service; no new backend or provider.

## Acceptance

Exercise IDs/labels remain consistent; replacements require review, clear load and leave history unchanged; manual settings block fresh progression approval; numeric/unit/date/type validation; mixed-unit distance normalization by activity; removed/old/future data excluded; quotas, ownership, stale/replay safety; responsive keyboard workflows; full existing training/Fuel/Restore regression; actual Supabase Auth and signed-in persistence in CI.

This starter library is not individualized exercise suitability advice or a technique-coaching system. Advanced exercise media, wearable imports, automatic exercise substitutions and native sensors remain expansion work. Phase 8 is the sourced physical profile and integrated review; Phase 9 is integration/release.

## Validation and release

Local lint/types, 150 unit/SQL tests and production build pass. New browser cases cover 344/390/768/1440 widths, unit conversion, exact retry, mobility field clearing, retained removal values and exercise replacement. Real Auth/PostgREST checks cover owner isolation, direct-write denial, replay/stale handling, strict mobility values and removal revisions; a signed-in founder browser test verifies save/reload/remove through the real app. Final executed CI results are recorded on the stacked Phase 7 PR.

Apply migrations only through the separately approved release sequence after reconciling the shared hosted ledger. Phases 1–7 are source-complete, not a production deployment. Physical-device review and release reconciliation remain Phase 9 gates. Two core V1 phases remain.
