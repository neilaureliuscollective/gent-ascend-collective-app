# Build roadmap and acceptance gates

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

Now: framework, tokens, Auth adapter, ownership schema, capability calculator, local console, synthetic data, tests/CI, docs. Later: Stripe API, model/provider SDK, workflow durability, private file storage, notifications, telemetry vendor, AI memory, provider integrations, digital twin renderer. Redis, microservices, queues and additional databases require evidence of need.

## Stage 2A acceptance

Implemented scope is in STAGE_2A.md; observed results are in STATUS.md. Required: profile save/reload, a goal with next step surfaced on Command, complete/archive with retained history, stale-tab rejection, one active goal, two-user RLS, event atomicity, free-member access, usable 360/768/1440 layouts and honest errors. Run both `npm run test:integration` (real Auth/PostgREST) and `npm run test:founder` (real Next/browser journey) after local setup. Browser editor fixtures alone cannot close this stage.

Next product increment is Stage 2B after the persistence gates pass: choose one useful measurement and one routine, then show honest recorded progress. Confirm the exact metric and routine with founder use before expanding schemas.
