# Domain and data model

## Initial migration

| Table               | Ownership / writes                                                          | Purpose                                                      |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| persons             | unique auth_user_id; owner may edit display name, timezone, onboarding only | Stable application identity distinct from Auth               |
| membership_accounts | person primary key; owner read only, trusted billing writes later           | Tier, subscription state, trial/access expiry and beta grant |
| personal_events     | person FK; owner read only initially                                        | Minimal typed longitudinal event index                       |

Auth-user creation provisions person and free membership transactionally with a fixed-search-path trigger. User metadata never sets privileges. Profile mutation has a column grant so ownership IDs cannot be changed. No authenticated update grant on billing or event infrastructure.

All tables enable RLS, explicitly revoke anon access and restrict authenticated grants. Index auth lookup and (person_id, occurred_at desc). Account deletion cascades the initial non-regulated records; clinical retention rules require a separate decision before clinical data exists.

## Next concrete slices

Stage 2: goals, metric_definitions and measurements (typed numeric value/unit, method, observed_at, recorded_at, timezone, source, external id). Enforce person ownership on relationships and normalize units at ingestion while preserving original measurement. Corrections supersede the original; do not silently overwrite history.

Routines and completion records are separate entities. Workouts, lab panels/results, scans, mood and appointments get typed domain tables as those capabilities arrive. No giant JSON health table. Timeline events reference domain records and expose authorized summaries; a generic event must never grant access to its target.

## Memory and AI records (planned, not migrated)

Canonical profile facts and goals retain domain ownership. Preferences may be user-confirmed. Inferences have provenance, confidence, review status, expiry and supersession. Summaries retain source IDs and invalidate when a source is edited/deleted. Conversation records are not automatically durable memory. User inspection, correction, deletion and retention preferences are required before persistent AI memory.

## Clinical isolation (planned)

Use a clinical gateway interface and separate authorization, consent, audit and storage policy. Provider identity and decisions are distinct from person identity. Start with opaque partner references and user-approved provider briefs; do not copy raw clinical information into events/logs/analytics. A future separate compliant project can sit behind the gateway without rewriting the core. Do not create clinical tables in Stage 1.

## Data lifecycle

Record origin (user/import/provider/derived), event time vs ingestion time and processing version. No real customer data in test seeds. Before beta implement export, deletion propagation, retention schedule, account closure and backup restoration. Before sharing implement explicit consent/grants, not shared ownership booleans.
