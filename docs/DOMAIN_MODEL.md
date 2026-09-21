# Domain and data model

## Shipped migration chain

| Table               | Ownership / writes                                                                 | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| persons             | unique auth_user_id; owner may edit name, timezone, units, priority and onboarding | Stable application identity distinct from Auth                   |
| membership_accounts | person primary key; owner read only, trusted billing writes later                  | Tier, subscription state, trial/access expiry and beta grant     |
| goals               | person FK; owner insert and active-goal edits; no delete                           | One active focus, next step, date and retained lifecycle history |
| personal_events     | person FK; owner read only initially                                               | Minimal typed longitudinal event index                           |

Auth-user creation provisions person and free membership transactionally with a fixed-search-path trigger. User metadata never sets privileges. Profile mutation has a column grant so ownership IDs cannot be changed. No authenticated update grant on billing or event infrastructure.

All tables enable RLS, explicitly revoke anon access and restrict authenticated grants. Index auth lookup and (person_id, occurred_at desc). Account deletion cascades the initial non-regulated records; clinical retention rules require a separate decision before clinical data exists.

## Stage 2A constraints

Profile: unit_system (imperial/metric), current priority, updated_at and monotonically increasing version. Name cannot be blank; database validates timezone names. Updates use an expected version so stale browser tabs do not overwrite newer edits.

Goals: title, body/mind/life domain, reason, next_step, nullable calendar target_date, active/completed/archived status, created/updated/closed times and version. Partial unique index allows one active goal per person. Closed goals are immutable in this slice. Column grants prohibit changing owner/version/timestamps. The application does not accept a person ID from a submitted form.

Goal changes append goal.created/updated/completed/archived events transactionally through a narrow definer trigger with a fixed empty search_path and no public EXECUTE grant. Events contain references and metadata, not duplicate personal text. Compound (person_id, goal_id) FK prevents cross-owner linkage. This is lifecycle history, not full edit snapshots or an audit ledger. Personal events remain client read-only.

## Next concrete slices

Stage 2B: metric_definitions and measurements (typed numeric value/unit, method, observed_at, recorded_at, timezone, source, external id). Enforce person ownership on relationships and normalize units at ingestion while preserving original measurement. Corrections supersede the original; do not silently overwrite history.

Routines and completion records are separate entities. Workouts, lab panels/results, scans, mood and appointments get typed domain tables as those capabilities arrive. No giant JSON health table. Timeline events reference domain records and expose authorized summaries; a generic event must never grant access to its target.

## Memory distinctions and future derived records

Canonical profile facts and goals retain domain ownership. Preferences may be user-confirmed. Inferences have provenance, confidence, review status, expiry and supersession. Summaries retain source IDs and invalidate when a source is edited/deleted. Conversation records are not automatically durable memory. User inspection, correction, deletion and retention preferences are required before persistent AI memory.

## Clinical isolation (planned)

Use a clinical gateway interface and separate authorization, consent, audit and storage policy. Provider identity and decisions are distinct from person identity. Start with opaque partner references and user-approved provider briefs; do not copy raw clinical information into events/logs/analytics. A future separate compliant project can sit behind the gateway without rewriting the core. Do not create clinical tables in Stage 1.

## Data lifecycle

Record origin (user/import/provider/derived), event time vs ingestion time and processing version. No real customer data in test seeds. Before beta implement export, deletion propagation, retention schedule, account closure and backup restoration. Before sharing implement explicit consent/grants, not shared ownership booleans.

## Aurelius 1A records

- ai_conversations: owner, title and timestamps. Owner can read/delete; creation occurs in the bounded begin-turn RPC.
- ai_turns: compound owner/conversation FK, user/assistant text, pending/complete/failed/cancelled state, prompt version, configured model, context inclusion and explicit feedback. Owners may update feedback only through direct grants. Turn content/finalization goes through owner-scoped RPCs. These are private working records, not immutable provenance evidence.
- ai_usage: non-content request IDs, owner/time and optional token counts. Read-only to authenticated users; survives conversation deletion for rate limits, cascades on account deletion. Cleanup/retention job remains a pre-beta requirement.
- ai_memories: explicitly confirmed user facts/preferences, source=user, content, confirmation time and optimistic version. Bounded create/correct/delete RPCs; no AI inferred truth or vectors.

All new tables enable RLS, deny anon access and isolate owner reads. Fixed-search-path definer RPCs derive owner from auth.uid() and grant no cross-person access. No raw AI text is copied into the generic personal timeline. Memory and conversation deletion are separate intentional operations.

## Aurelius 1D daily records

Migration 202609210004_daily_dashboard.sql adds `daily_entries` keyed by (person_id, local calendar day), with saved timezone, optional ordinal energy 1–5, optional manually entered sleep minutes 0–1440, intention (160 characters), reflection (500 characters), optimistic version and updated_at. Null means missing; zero minutes is distinct. All are user reports, not clinical/derived metrics. `daily_actions` has a composite owner/day FK, stable UUID, title, completion and position; at most five per day.

The authenticated `daily_save` RPC derives the person from auth.uid(), locks that person, checks local day and expected version, then replaces entry/action snapshot atomically. Direct client table writes are denied. Reads embed the action relationship in the same SQL statement so entry version and actions cannot come from different snapshots. Goals/latest conversation are separate read-only projections. Basic daily capabilities do not require paid billing. Date changes require explicit reload; no browser-provided timezone can change ownership/date authority.

The UI reads the last 30 days and edits today only. Older records are retained; 30 days is a display window, not a deletion policy. Past reflections/action details are stored but their browsing UI is deferred; this phase charts energy and shows dated energy/sleep values. Records cascade on person/account deletion. Define full export, record deletion and retention controls before sensitive beta use. No daily text is duplicated into generic events, AI memory, summaries or provider context. A future authorized timeline projection can reference these domain records without replacing them.
