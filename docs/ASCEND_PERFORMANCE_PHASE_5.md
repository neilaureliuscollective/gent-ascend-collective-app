# Phase 5 — Fuel & Body

Authorized September 28, 2026: research, plan and build. Continues Phase 4; no production promotion.

## Why this phase

The first four implementation phases built a useful strength-training loop but left nutrition and body observations as buried check-in fields. Expand the physical domain now rather than repeatedly extending strength-only review. Keep the main Gent Ascend experience about the whole man.

## Build

- A Fuel & Body space inside Performance: today's recorded intake beside optional, explicitly user-set reference targets; no automatic calorie prescription.
- Focused intake/weight capture for today or the previous 27 days. Reuse the existing versioned daily record so there is no duplicate nutrition ledger. Preserve sleep/energy/soreness when editing fuel. Blank stays unknown; zero stays a recorded value; partial days remain partial.
- Optional calorie, protein, water and goal-weight references. Save with stale-version checks, idempotent receipts and immutable revisions. Unit changes convert the weight target explicitly and do not relabel old readings.
- Last-seven-day nutrition averages with the actual denominator for each metric. Calories/protein use only days declared complete; water uses recorded days and is labeled accordingly. No historical adherence score against a newly edited target.
- Twenty-eight-day body record in four seven-day windows. Normalize pounds/kilograms for display, retain original readings, show gaps/counts, and compare the two latest windows only with at least three readings in each. Three is a product display threshold, not a validated precision guarantee. No body-fat, causal, expenditure or forecast claim.
- Existing opt-in Aethelios review can receive the targets and bounded summaries with an updated disclosure. It cannot change targets, prescribe intake or infer missing measurements.

## Research

Reviewed September 28, 2026:
- NIDDK [choosing a weight-management program](https://www.niddk.nih.gov/health-information/weight-management/choosing-a-safe-successful-weight-loss-program) supports self-monitoring as part of a broader supported process. It does not establish this app as a clinical program.
- NIDDK [Body Weight Planner research](https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner) uses a dynamic mathematical model. A few weigh-ins and partial intake cannot substitute for that model; this phase reports observations only.
- Supabase [database functions](https://supabase.com/docs/guides/database/functions) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): keep direct writes revoked, owner-bound reads, fixed search path, scoped private writer and public invoker wrapper.
- Installed Next.js 16.3.5 route guide: authenticated domain service and no-store API continue unchanged in architecture.

## Acceptance

Target save/reload/clear; exact retry and reused-ID/stale rejection; owner isolation and denied direct writes; retained target history; no replacement of check-in recovery fields; partial/missing/future entries excluded appropriately; mixed-unit normalization; truthful sparse-data states; phone/Fold/desktop and keyboard interactions; no extra model calls on view; existing training/offline behavior unchanged.

This is a daily-total workflow, not meal recognition, a food database, a meal planner, body composition estimation or a native health connector. Those need separate source/accuracy and integration work.

## Remaining sequence

See ASCEND_PERFORMANCE_ROADMAP.md. The early five-phase concept grouped broad areas; it was not the later fine-grained implementation numbering. This revised V1 sequence makes four phases remain after Phase 5, with specific exit criteria and advanced integrations tracked separately.

## Delivery and release checks

Local lint, strict type checking, 136 unit/SQL tests, production build and migration-ledger verification passed. Database tests use PGlite, not real Supabase Auth. The PR records browser and fresh real Supabase Auth/PostgREST CI results separately. Browser fixtures use synthetic records and intercepted requests; no live model test is claimed.

Stack this branch on Phase 4. Apply all prior Performance migrations in order before `20260928215620_ascend_performance_fuel_body.sql`, then verify the new RPC and owner grants. Hosted shared-ledger reconciliation, real-device acceptance and founder-approved rollout remain release gates. No hosted migration was applied during this build.
