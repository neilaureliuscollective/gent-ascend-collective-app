# Ascend Daily Command — Phase One

Implemented October 2, 2026 on `feat/ascend-daily-command`. No main merge, hosted migration or production promotion.

## Focused inspection and research

Base: main `9af7473dec0fa0c1bfb5b9f5c373380a604a2e94`. Main already contains Performance programs, actual sets, progression/outcomes, recovery, fuel, movement and Grooming rituals/scan/look/professional history. Draft refinements #37 (`feat/performance-refinement-v8`) and #38 (`feat/grooming-refinement-v2`) retain those contracts. Keep this PR independent; do not import their UI work or obsolete stacked Performance PRs. Compatibility is checked separately.

Daily already owns intention, actions, completion, review, current goal and carried-forward blockers. Reuse those records rather than creating a second task manager. Command's adapter uses bounded owner-scoped projections of existing tables instead of loading photos, full workout prescriptions, AI conversations or scan assets.

Focused primary evidence reviewed October 2:
- Oura separates readiness contributors and short/longer-term context: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors. Extract explanation and contributor visibility; do not import wearable claims or a numerical physiological score.
- MacroFactor's adherence-neutral coaching accommodates imperfect adherence: https://macrofactor.com/adherence-neutral/ and https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules. Apply nonpunitive feedback and a fast default flow, not its nutrition algorithm.
- Progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/. Show decisions first; expose evidence, arrival and feedback on demand.
- Supabase RLS/grants: https://supabase.com/docs/guides/database/postgres/row-level-security. Reviewed changelog index; no new extension/index/cipher dependency affected by the September PostgreSQL minor-release caveat. Use existing pinned SSR/Auth architecture, authenticated caller JWT, owner resolution and explicit grants.
- Installed Next.js 16.3.5 route-handler documentation inspected before route implementation. No new packages.

These are product design interpretations, not demonstrated retention or medical outcomes.

## What shipped

Member `/app` becomes a compact Daily Command. Signed-out sample dashboard remains intact. Existing intention/action/history/reflection UI is preserved at `/app/daily`; internal action/review links are redirected there. Public cinematic experience and existing worlds remain intact.

Pure domain: signals, state, confidence, decisions, snapshot and outcome. Server adapter composes same-day Daily/Performance reports, seven-day completed training and effort, recovery practices/sleep reports, movement, fuel references/logs, goal, unfinished priority, blocker, grooming goal/morning ritual, and next-seven-day grooming occasion. Partial source failure is visible and does not fabricate zeroes.

Optional morning arrival: sleep minutes, energy 1–5, soreness, bandwidth and available training time. Null defers to existing same-day reports; no previous-day sleep/energy imputation. Explicit saved Command arrival wins for the day. Where Daily and Performance both report a field, the latest update wins, with per-field fallback for missing values. Command arrival never rewrites those source records.

Rules V1 are deliberately conservative product heuristics:
- RECOVER: reported high soreness, energy ≤2, sleep <360 minutes, or reported training discomfort in the current/prior two calendar days.
- READY: all three recovery arrival signals present, sleep ≥420 minutes, energy ≥4, soreness not high, bandwidth not limited, absent caution.
- PUSH: READY conditions plus energy 5, no soreness, explicitly open bandwidth, some known training in the prior six days, no session already recorded today, no demanding recent training, no unavailable source, and no yesterday feedback saying too much. It is an invitation to consider scope, not a progression prescription.
- STEADY: remaining cases, including wholly unknown arrival.
- Recent demanding training: mean reported completed-set effort ≥8 or ≥16 recorded completed sets within current/prior two days. Missing effort is unknown. No cross-exercise tonnage aggregation or biological causation.
- Confidence is qualitative completeness of the three recovery arrival signals, downgraded for unavailable sources; not statistical confidence or a probability. Supporting history remains separately visible.

At most five decisions. Saved occasion, saved focus, training/recovery, optional fuel and due morning ritual. Already-recorded training leads to recovery. Recorded water below the member's own daily reference is described as partial-day logging, never dehydration; missing water creates an optional check, never a deficit. A saved occasion is not a booking or calendar integration.

Interpretation on Command is explicitly rule-based. Aethelios opens a bounded editable draft of displayed signals and recommendations only after the member chooses the handoff. No automatic send, model call on render, new AI memory, plan write or goal change. Real Aethelios availability/entitlement remains governed by the existing chat system.

Evening feedback references the *saved* command, even if refreshed current suggestions differ. Done/partial/skipped/unknown are user accounts, separate from observed workout/action/ritual history. Fit and tomorrow context are versioned. Yesterday's confirmed tomorrow text contributes a priority; yesterday's “too much” requests smaller scope without modifying plans. No learning claim beyond this explicit feedback rule.

## Persistence and boundaries

One additive migration: `20261002141618_ascend_daily_command.sql`. One owner/day record plus immutable revisions. Snapshots retain structured training, fuel, priority and grooming context alongside the explained signals, so later learning does not have to parse prose. Authenticated RPC derives the owner, locks that person's row, validates local day/bounds, checks expected version, saves record/revision atomically, and recognizes exact request/content retries. No direct client writes; owner-only SELECT; anonymous denied. Maximum 30 revisions/day. POST never accepts a client snapshot: the server builds it; the lower-level owner RPC retains saved suggestions, not authoritative medical facts or app-domain completion events. Correction by new arrival resets current feedback and retains old feedback in revisions.

Account-bound request IDs and owner checks prevent stale UI applying drafts to a newly signed-in account. API is private/no-store, requires same-origin JSON, bounds request bytes, and redacts unexpected errors. No localStorage/sessionStorage, private URL payload, shared caching, service-role access or public personal records.

## Verification / release

Run `npm run check`, `npm run db:ledger`, `git diff --check`, `npm run test:e2e`. Added pure rule/bounds tests, SQL migration ownership/replay/stale/outcome tests, browser arrival/feedback/conflict/no-overflow tests at 344/768/1440px with reduced motion, API origin/anonymous tests, a real Auth/PostgREST command smoke slice and a real signed-in save/reload founder journey. SQL emulation and intercepted browser fixtures are not real Supabase/model tests. See STATUS.md and the PR for observed results.

Release requires migration before code, real Auth/PostgREST and founder persistence acceptance, physical Fold/iPhone review and live Aethelios evaluation. Hosted schema remains untouched here. No wearables, multi-day adaptive models, automatic memory, general calendar integration, weight-derived recommendations, clinical inference, personalized hydration prescription or body twin added. Recovery/fuel observations are conservative, not a wearable readiness replacement.
