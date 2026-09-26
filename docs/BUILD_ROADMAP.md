# Build roadmap and acceptance gates

> Current founder-approved direction (2026-09-26): Arrival + Command is implemented on the working branch. Read docs/ARRIVAL_COMMAND.md (or ARRIVAL_COMMAND.md from docs/) for public `/` + member `/app` architecture, honest product previews, Reserve gateway, installation and mobile Aethelios. This supersedes older dashboard-first and commerce-last sequencing below. Production promotion still requires founder approval and the recorded release gates.


| Stage    | Working outcome                                                        | Validation                                                          |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0        | Constitution, architecture, researched versions, risk/decision log     | Official repo inspection; documented sources; scope agreed by brief |
| 1        | Responsive shell + local founder harness + first schema                | Gates below; no required production services                        |
| 2A       | Edit profile and one goal, ownership enforced                          | Save/reload with two-user isolation; error and empty states         |
| 2B       | Log one metric + routine completion; see 30-day progress               | Transactional timeline, timezone/units, reproducible personas       |
| 3A       | Aurelius reads authorized profile/goals/history context                | Cross-user denial; sources, uncertain/missing data and usage limits |
| 3B       | User-controlled memory and confirmed actions                           | Correction/deletion propagation; tool approval/idempotency          |
| 4        | Selective private beta + Stripe test lifecycle                         | Invitations, real auth, billing replay/order/cancellation, recovery |
| 5+       | Expand validated product loop; body visualization, commerce, community | Feature-specific usefulness, privacy and access checks              |
| Clinical | Partner-powered care behind clinical gateway                           | Explicit legal/provider/data-contract readiness gate                |

## Current execution order — 2026-09-21

Aurelius 1C identity → **Aurelius 1D daily dashboard** (founder explicitly authorized; see DAILY_DASHBOARD.md) → real-service activation and phone/foldable testing → founder intelligence evaluation → a grounded, user-reviewed daily briefing. The dashboard adds bounded user-entered observations/actions, not the full former Stage 2B measurement/routine scope. All body/human rendering is explicitly deferred until measurements and requirements are ready.

## Earlier founder-directed sequence update — 2026-09-20

The founder explicitly prioritized usable Aurelius intelligence before measurement/routine modules. Stage numbers below are historical labels, not execution order. Current order: Stage 1/2A validation → **Aurelius 1A (the Stage 3A conversation foundation plus manual memory controls)** → **Aurelius 1B (premium workspace and disconnected exploration)** → real-service activation → founder daily conversation evaluation and corrections → research/continuity improvements → choose the first metric/routine that genuinely strengthens Aurelius. Do not resume feature expansion merely because old Stage 2B appeared earlier in the table.

## Stage 1 acceptance

- One canonical repository; root AGENTS and all planning documents present.
- Current stable compatible framework/runtime; lockfile; strict TypeScript; explicit lint, typecheck, build and test scripts.
- Premium black/gold/purple shell at 360/768/1440 widths; keyboard-accessible global Aurelius panel; usable navigation; no horizontal overflow; reduced-motion support.
- No email/Stripe/onboarding dependency for local founder entry. Real local Supabase Auth ID resolves to real person; session-bound queries exercise RLS.
- Harness forbidden under hosted preview/production and production builds. Protected console uses server-validated scenario controls; no client-granted real access.
- SQL migration and deterministic synthetic seed reset on actual local Supabase. Cross-user ownership and billing privilege tests.
- Environment validation, error/empty/unconfigured states, no secret exposure.
- Lint, typecheck, unit, production build, critical browser interactions, SQL migration validation and actual Supabase auth smoke all pass. Record separately if full Supabase runtime cannot execute.
- No production deployment, no fake functioning clinical/AI modules.

## Test strategy

Vitest for capability policy, configuration guards, signed scenario tampering/expiry. Browser tests for responsive shell, navigation, panel keyboard closure and forbidden harness endpoints in production. PGlite as a dev-only fast SQL/RLS engine exercises migration syntax/grants with an explicitly minimal auth schema; it does not validate GoTrue/PostgREST. Docker-backed CLI reset + actual password session + two-user API reads is the required integration gate. CI should run both.

Use meaningful failure cases; no arbitrary test-count target. Each stage exposes a useful founder action and ends with observed gate results and remaining risks.

## Now vs later

Now: framework, tokens, Auth adapter, ownership schema, capability calculator, local console, synthetic data, tests/CI, docs. Aurelius 1A adds the model SDK, private conversations and explicit memory. Later: Stripe API, workflow durability, private file storage, notifications, telemetry vendor, automatic memory proposals, provider integrations and digital twin renderer. Redis, microservices, queues and additional databases require evidence of need.

## Stage 2A acceptance

Implemented scope is in STAGE_2A.md; observed results are in STATUS.md. Required: profile save/reload, a goal with next step surfaced on Command, complete/archive with retained history, stale-tab rejection, one active goal, two-user RLS, event atomicity, free-member access, usable 360/768/1440 layouts and honest errors. Run both `npm run test:integration` (real Auth/PostgREST) and `npm run test:founder` (real Next/browser journey) after local setup. Browser editor fixtures alone cannot close this stage.

Measurement/routine work is deferred behind the working Aurelius milestone. See the sequence update above and AURELIUS_1A.md.

## Aurelius 1B — founder-authorized disconnected refinement

Scope and observed acceptance: [AURELIUS_1B.md](AURELIUS_1B.md). Build the real conversation navigation and inspectable context experience while the founder postpones account reconnection. A signed-out preview is presentation only, with no model answers, identity, private records or write access. Preserve the same connected service and database contracts. No additional infrastructure or dependency is needed.

Next: connect the existing backend/model adapter, validate real identity/persistence and use the founder evaluation rubric. Live results should guide the next intelligence enhancement; do not fill the waiting period with speculative product modules.

## Aurelius 1C — implemented; physical-device review pending

Founder requested a materially more immersive, premium and futuristic aesthetic before the rest of the Life OS grows. Research and implementation scope: [AESTHETIC_ELEVATION_PROPOSAL.md](AESTHETIC_ELEVATION_PROPOSAL.md). Proposed order: shared materials/type/layout → Command and Aurelius → bounded 3D and motion → functional/accessibility/performance verification. The founder subsequently approved the phase and supplied the official logo. Implementation and verification: [AURELIUS_1C.md](AURELIUS_1C.md). Real-service activation remains necessary afterward; visual refinement does not close those gates.

## Aurelius 1D — daily dashboard

Acceptance: truthful empty and fictional sample states; check-in/intention/action/reflection interactions; sample produces no API writes; personal data uses real session ownership; local calendar date, normalized actions, bounded atomic save, stale-version denial, owner-only reads and no direct writes. 7/30-day chart has exact accessible values and visible gaps. Starters open reviewable drafts, saved conversation resumes without automatic sending. Phone/unfolded/desktop, short screen, keyboard, reduced motion, build and database checks are required. Real Supabase/founder persistence and physical-device gates remain separate. Scope, research and measured evidence: [DAILY_DASHBOARD.md](DAILY_DASHBOARD.md).

## Aurelius 1E — approved material correction

Rebalance the existing dashboard/shared shell toward obsidian, reflective gold and localized purple. Add a bounded decorative connection field and finite entry/interaction lighting, retaining Still, reduced-motion, solid and forced-color operation. Verify current workflows and response/payload cost. Scope/evidence: AURELIUS_1E.md. This is the current authorized visual phase; service activation and intelligence evaluation remain the subsequent product milestones.

## Aurelius 1F — founder-approved Orb

Focused upgrade after 1E: dark crystalline core, metallic orbit bands, shared static identity, truthful request-state visuals, and labeled in-memory voice-motion previews. Validate graphics/lifecycle, layout, accessibility and existing workflows. See AURELIUS_1F.md. This supersedes the earlier visual stopping point at the founder’s explicit direction. It does not authorize new voice/model services; physical-device review and real-service activation remain next.
