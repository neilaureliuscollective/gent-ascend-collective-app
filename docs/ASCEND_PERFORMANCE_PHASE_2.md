# Ascend Performance Phase 2 — program and session decisions

Authorized: September 28, 2026. Continues Phase 1 from draft PR #26 (`f8bd811`); no production promotion is implied. Whole man → Performance → physical record remains the hierarchy.

## Research and decision

The useful gap after Phase 1 is a program that survives actual life. A single repeatable workout cannot express an A/B cycle, and a warning about poor sleep is not a usable decision. This phase connects a versioned program, a reviewable session adjustment, an offline workout, and the next session.

Reviewed September 28:
- ACSM's March 2026 position-stand summary emphasizes individualization, maintainable training and consistency. It does not validate a numerical readiness prediction from sparse self-reports. https://acsm.org/resistance-training-guidelines-update-2026/
- Hevy documents reusable routines and organization into programs. The opportunity here is to connect those plans to explicit daily decisions and immutable outcomes. https://help.hevyapp.com/hc/en-us/articles/34953606698903-Build-a-Workout-Program-Create-Organize-Routines
- Fitbod documents duration-based session construction, with real duration affected by rest and workout structure. Ascend uses a clearly approximate estimate, not a promise or a learned model. https://help.fitbod.me/hc/en-us/articles/43488199311767-How-long-are-Fitbod-workouts-and-can-I-make-them-shorter
- Supabase function/RLS documentation supports the existing private transactional writer and session-bound reads. The changelog markdown endpoint was unavailable to the research tool; the HTML changelog was checked. No new SDK/API dependency is needed. https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/guides/database/postgres/row-level-security
- Installed Next.js 16 route-handler documentation verified the existing App Router boundary. No framework migration.

## Delivered experience

**Today:** a horizontal program sequence shows the next session. Missed days create no debt or punitive streak. The repeating cycle is intentionally separate from a calendar schedule.

**Program:** one active cycle with up to six independently editable strength sessions. Start by copying the Phase 1 plan, duplicate and edit sessions, reorder or remove them, then explicitly save the whole program. Existing session/unit/limitation controls remain. Session edits are staged until program save. No automatic training prescription or injury-specific exercise substitution.

**Before training:** select a session; read available self-report signals; keep the original, fit a time budget, or reduce sets. The exact omissions/reductions are visible before “Accept & start workout.” Choosing recovery changes no prescription or cycle position. Selecting a different equipment-specific session is supported through the program, with no automatic equipment inference.

**Training/review:** the immutable accepted plan and original plan accompany the workout through local persistence, offline completion and sync. Review shows what changed and which program revision it came from. Rest targets for program workouts come from the accepted snapshot, not today's edited program. Optional Aethelios review receives the explicitly requested decision context and cannot modify the program.

## Bounded adjustment rules

- As planned: no target change.
- Fewer sets: remove one set per movement, retaining at least one. Does not reduce load or claim physiological readiness.
- Fit my time: remove extra sets from later movements first; if still over budget, omit later movements until one remains. Movement order is the user's priority order. Never add volume to fill spare time.
- Estimate = five-minute warm-up allowance + one transition minute per movement + each set's 45-second work allowance and planned rest, rounded up. Conservative rest accounting includes each set's rest. Actual pace, warm-up needs and bilateral work vary; the UI makes the estimate explicit. A remaining over-budget minimum is shown honestly.
- Under-six-hour sleep, energy <=2, high soreness, recorded limitations or last-session discomfort are explanatory prompts only. Thresholds are product heuristics, not validated physiological cutoffs. They do not silently choose an option. Discomfort is not handled by an automated rehabilitation prescription.
- Legacy Phase 1 progression remains available only without an active program. Program progression is deliberate manual editing in this phase. Calibrated per-session progression comes after real usage data.

## Data and concurrency

Additive CLI-created migration `20260928145533_ascend_performance_programs.sql`:
- `performance_programs`: person-owned current revision and next-slot pointer.
- `performance_program_revisions`: immutable full session definitions.
- `performance_session_context`: immutable prescription and original snapshot, with compound owner foreign keys to the session and program revision.
- Private receipt table fingerprints full program/session decisions. Identical retries return the same result; changed payloads and stale edits reject.

The existing public `performance_save` RPC delegates to a private wrapper. Phase 1 records and pending offline requests remain compatible. The decision carries rule version 1; its SQL implementation remains versioned so future rules cannot reinterpret a retained offline workout. The wrapper independently reconstructs the accepted plan and verifies every set target against the program revision. Original snapshots cannot be forged, attached later, omitted or changed on later writes. The old private writer still owns normalized session/sets/timeline writes inside the same transaction.

Completing the current next slot advances once, including an explicitly finished partial session. Abandoning or training out of order does not advance. Two offline sessions for the same next slot do not skip the following slot. An old revision remains syncable after program edits but cannot advance the new revision. Editing preserves the next slot if it still exists; removing it restarts the sequence at the first remaining slot. This is a rotation pointer, not a dated occurrence scheduler.

All exposed tables have owner SELECT RLS and no direct mutations. No new cached account responses, service credentials, AI memory or background-sync claim. Program edits require connectivity; an accepted workout retains the existing consented offline behavior. The loaded export includes the current program and accepted/original snapshots in recent sessions, not all historical program revisions.

## Verification and release

Local checks: strict types, lint, unit/schema/SQL security tests, production build and migration ledger. CI additionally runs real Supabase Auth/PostgREST, founder browser flow and full browser regressions. Final evidence is recorded on the Phase 2 PR. Dedicated `performance-evidence` screenshots avoid the combined artifact's transfer limit.

Important scenarios: owner isolation; stale program saves; invalid/duplicate session definitions; client/SQL algorithm agreement; forged decision rejection; immutable target checks; completion replay; delayed offline completion after a program edit; recovery with zero writes; phone/unfolded/desktop preparation; staged builder conflicts; accepted adjustment surviving reload and advancing after sync.

Release still requires the Phase 1 migration followed by Phase 2, staging review, physical Fold/iPhone offline acceptance and live Aethelios interpretation. No hosted migration or production merge is performed during this build. Keep `performance_private` unexposed. Additive tables remain when reverting application code; legacy workouts stay readable.

## Next

Observed usage should guide per-session progression, coach-quality exercise substitution, movement taxonomy and program adherence. Wearables, native Health Connect/HealthKit, calorie adaptation, predictive Physical Twin models and 3D body representations remain later phases. No new infrastructure is needed for this slice.
