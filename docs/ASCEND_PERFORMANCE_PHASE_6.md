# Phase 6 — Recovery & sleep

Founder authorized research, planning and implementation on September 28, 2026. Builds on Phase 5; source publication is separate from production rollout.

## Product plan

Replace the static Restore panel with a usable record → choice → next-day review loop. Keep it inside Performance and preserve the whole-man hierarchy.

1. Focused sleep/energy/soreness capture for today or the preceding 27 days, using existing versioned check-ins and preserving nutrition/body fields. Sleep duration is a self-report, not sleep quality or measured recovery.
2. Seven calendar days of visible observations, actual per-metric denominators and unknowns. No blended readiness score, inferred sleep stages, or claim that duration establishes restorative sleep.
3. One deliberately chosen daily routine: quiet wind-down, screen break, gentle mobility or protected rest. User sets minutes and an optional cue that works with their schedule. The latest routine can seed today's draft; nothing saves automatically.
4. Next-day follow-through: done, partly, skipped or not recorded. Pair each dated routine with only the exact following calendar day's existing check-in. Missing days stay missing; later records never substitute. The comparison is context, not evidence that the routine caused an outcome.
5. Plans can be created/edited only on the owner's current local date. After that, the planned action/minutes/cue are frozen; follow-through can be corrected for 27 days. Corrections keep immutable versions. Same request replays once; stale edits fail without discarding the draft.
6. Optional existing Aethelios review receives seven-day recovery summaries and bounded routine context only after explicit consent. No automatic changes or additional model calls.

## Research and choices

Reviewed September 28, 2026:
- NHLBI [sleep diary](https://www.nhlbi.nih.gov/resources/sleep-diary): longitudinal self-reports provide context; this deliberately small workflow is not a clinical sleep diary.
- CDC [About Sleep](https://www.cdc.gov/sleep/about/index.html): duration and quality are distinct. Retain separate observations and do not equate logged hours with readiness.
- NHLBI [healthy sleep habits](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits): quiet time and a suitable sleep environment support routine design; shift-work guidance argues against a universal bedtime. Cues are user-defined, no prescribed clock time or alarm.
- Supabase changelog (September 25 Postgres minor upgrades): no ltree/btree_gist/custom operator or legacy encryption dependency added. [Database functions](https://supabase.com/docs/guides/database/functions) and owner RLS guide the private authenticated writer/public invoker boundary.
- Installed Next.js 16.3.5 route documentation: domain service remains the authority behind the no-store API.

## Acceptance and release

Test partial/empty data, zero sleep, seven-day boundaries, exact next-day pairing, owner-local dates, frozen past plans, failed saves, immutable revisions, request replay, stale conflicts, two-user isolation and denied direct writes. Check narrow phone/Fold/desktop, keyboard, reduced motion, and preservation of training/Fuel workflows. PGlite checks do not substitute for real Supabase Auth/PostgREST and signed-in browser CI.

The additive migration follows Phase 5 and all prior Performance migrations. Hosted migration reconciliation, real-device acceptance and approved production rollout remain release gates. No new provider, clinical guidance, wearable measurement, automated reminder or training-plan mutation is introduced.

## Validation record

Local lint, strict type checking, 142 unit/SQL tests, production build and migration ledger passed. PGlite exercised malformed inputs, owner isolation, replay, stale revisions, premature outcomes and frozen past intent. Local Docker is unavailable; the CI database job runs the fresh real Supabase reset, security advisors, Auth/PostgREST smoke and signed-in browser persistence checks. Browser fixture, full CI and signed-in results are recorded on the Phase 6 PR rather than represented as hosted acceptance. No live model call was made for this build.
