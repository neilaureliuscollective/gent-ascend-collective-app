# Ascend Performance Phase 3 — evidence-led progression

Authorized September 28, 2026: research, plan and build the next phase. Continues Phase 2; incorporates main's current Aethelios conversation room and Studio work without replacing it. Production promotion is a separate decision.

## Brief

**The next useful step:** each session learns from its own recorded outcomes. Review now explains whether to hold its targets or consider one more rep. The user approves every target change. An immutable decision connects evidence → proposal → approval → program revision; the next workouts can test that decision.

**Experience:** Review becomes a quiet sequence of session-level decisions. Show the proposed change prominently, source workout dates and completion beneath an expandable detail, a specific hold reason where evidence is missing, and approved-change history. Today and Training retain their distinct purposes. No new dashboard, score or chatbot navigation.

**Aethelios:** optional interpretation can receive these bounded decisions with the existing consented Performance context. The prompt cannot propose progression beyond eligible candidates. No write tools, new automatic memory, or autonomous prescription.

## Research checked September 28, 2026

- ACSM's 2026 position-stand summary emphasizes consistency and individualization; it does not validate a universal recovery/progression score. https://acsm.org/resistance-training-guidelines-update-2026/
- Bartolomei et al., 2024, “Autoregulation Does Not Provide Additional Benefits to a Mixed-Session Periodized Resistance Training Program in Trained Men.” Evidence does not justify claiming that autoregulation inherently outperforms a considered program. https://pubmed.ncbi.nlm.nih.gov/38814694/
- Hevy already provides previous-performance reference, exercise records and effort logging. Showing prior sets is not a category breakthrough. Ascend's useful incremental contribution is the explicit per-session decision, its source lineage, atomic approval and retained outcome context. https://www.hevyapp.com/features/track-exercises/
- Supabase database functions and owner RLS support the existing Postgres transactional boundary. No external queue, vector store or extra provider is needed. https://supabase.com/docs/guides/database/functions and https://supabase.com/docs/guides/database/postgres/row-level-security

The exact thresholds below are **product heuristics**, not clinically validated or experimentally personalized cutoffs. This phase creates a testable learning foundation; it does not claim a learned physiological Physical Twin.

## Rule version 1

For each program slot, evaluate the two latest completed workouts, ordered by start time and ID. Never skip a recent difficult, adapted or incomplete workout to find convenient older evidence. Workouts must fall on distinct local dates in the last 28 days, have no future completion, contain no discomfort flag, use the full planned mode, and match the current complete session plan. An unchanged session can use evidence from an older global program revision (editing a different slot does not erase its history).

Require all planned sets in both workouts completed. The first exercise in plan order with every set meeting the rep target at exactly the planned load and known effort <=7/10 can receive **+1 rep per set**, at the same load, with targets below 20 reps. Only one exercise in that session changes. Load increments, simultaneous changes across the program and rep-range periodization are intentionally deferred.

A known profile with no recorded limitations and today's complete sleep/energy/soreness check-in are required. Under six hours reported sleep, energy below 3/5, high soreness, a server-active session or discomfort in the latest completed workout pauses proposals. These are conservative review gates, not a diagnosis or a clearance to train. An active or unsynced workout on this device also disables approval; the server cannot know an unsynced workout on another device. Historical discomfort is not automatically declared resolved.

## Architecture and safeguards

CLI-created additive migration: `20260928151743_ascend_performance_progression.sql`.

- A single private SQL evaluator supplies both the read preview and acceptance validation. There is no divergent browser/server implementation of the rule.
- Public RPCs resolve the authenticated person; callers cannot provide an owner ID. The raw owner-argument helper is not executable by members. Keep `performance_private` out of exposed schemas.
- Acceptance obtains the same person lock used by all Performance writers, re-evaluates evidence, compares a token bound to rule, plan/slot, profile/check-in versions, source sessions, day and timezone, then versions the program, saves evidence and emits `performance.progression.approved` in one transaction.
- Identical request replay returns the original version; reused IDs with changed input and stale candidates reject. Evidence and program changes cannot race through the approval boundary.
- `performance_progression_decisions` retains the exact review, immutable source IDs, from/to revisions, rule version and timestamp. Owner SELECT RLS; no direct writes. Recent 20 decisions are shown, not an assertion that the complete history is exported.
- Preview data may cross a concurrent read; the acceptance boundary always recomputes atomically. Health details are not written into public logs or prompts without the existing opt-in review action.
- No new cache of account responses. Program approval needs connectivity. Existing device workout drafts, immutable prescriptions, offline sync and old program revisions stay compatible.

## Sequence after this build

**Now:** per-session evidence, bounded progression proposal, explicit approval, audit history and grounded opt-in review.

**Next, after usage:** assess whether proposals were accepted, completed or manually revised; improve exercise taxonomy and realistic load increments. Add user-selected rep ranges and deload review only with explicit product rules and sufficient coverage.

**Architected, later:** immutable evidence and versioned decisions support outcome analysis, personal experiments, source normalization and future coach policies. Wearable onboarding and native Health Connect/HealthKit need a separate native integration slice.

**Not yet:** automatic overload decisions, overtraining diagnosis, personalized injury prescriptions, calories from noisy expenditure, calibrated forecasts, 3D body transformations or claims of predictive accuracy.

## Integration fixes

Full regression exposed two control-overlap issues in the incoming conversation room and one stale heading assertion. Keep appearance controls inside the immersive room, hide the covered shell toolbar, size the replacement orb to its preview grid column, prevent decorative graphics from capturing clicks, and restore a semantic room heading. Existing click tests remain unforced.

## Verification and release

Local lint, strict types, 119 unit/SQL tests, production build and migration-ledger checks passed before review. CI adds full browser regression at phone/unfolded/desktop widths and real Supabase Auth/PostgREST approval, replay and owner-isolation tests. Final CI evidence belongs on the review PR; physical-device offline behavior and a live Aethelios response still need founder acceptance.

Apply Phase 1 → Phase 2 → Phase 3 migrations to staging after reconciling the hosted migration ledger and current Studio migrations. Do not blindly push the shared hosted ledger. No hosted migration or production promotion is performed here. Reverting application code leaves additive history intact; legacy/program session writes remain compatible.
