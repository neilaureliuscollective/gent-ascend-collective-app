# Architect Apps release path — not live

Implemented on PR #130. This is not a production authorization and not a claim that review-ready means hosted.

## Implemented code

- Owner APIs, durable Apps RPCs, isolated Docker compile, compiled iframe, host collections, mutation identity, and the Origin workbench.
- Explicit founder-pilot generation policy: `ARCHITECT_APPS_FOUNDER_PILOT`. Production stays identified as production. Mock generation is refused in production.
- Local additive migrations: `20261015080000_architect_apps.sql`, `20261015120000_architect_apps_durable.sql`, `20261015140000_architect_apps_mutation.sql`, `20261015155000_architect_apps_retain_verified.sql`, `20261015156000_architect_apps_preview_sessions.sql`, `20261015156500_architect_apps_pilot_budget.sql`, `20261015156600_architect_apps_execution_gate.sql`, `20261015156700_architect_apps_budget_lock.sql`.
- Pinned images `aethelios-architect-apps:2026-10-15.1` and `aethelios-architect-apps-worker:2026-10-15.1`. Prepare both with `node scripts/architect-apps-prepare-runtime.mjs` on the host that will compile.
- Labelled mocked provider (`ARCHITECT_APPS_AI_MOCK`) for local/test Field Notes only. Do not set it on hosted production.

## Missing hosted infrastructure

| Prerequisite | Current | Smallest action |
| --- | --- | --- |
| Hosted Apps migrations | Unapplied | Founder-authorized hosted apply of the shared Talk/Apps files once, then the #130 extras below. Recorded history is not physical schema. Health `20261015181000` is unrelated and stays on its own approval. |
| Worker host | Code-complete commissioned path; no persistent host | Founder-approved DigitalOcean Docker Droplet (Basic 2 GiB, $12/mo) or equivalent daemon host. Set `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`. Vercel and Fly Machines are not that host. A founder laptop is not the plan. |
| Isolated images | Built in Quality `apps-isolate` and Origin `local-auth` after prepare-runtime | Same pinned tags on the worker host; work root uid 1000 mode 0755; no unsandboxed fallback |
| `ARCHITECT_APPS_PREVIEW_SECRET` | Required; shared `architect_app_preview_sessions` | Hosted secret ≥16 chars plus `ARCHITECT_APPS_PREVIEW_CLUSTER=true` on the web plane. Missing/revoked sessions deny. |
| Feature flags | Default false | Hosted `ARCHITECT_ORIGIN_ENABLED` + `ARCHITECT_APPS_ENABLED`. Leave `ARCHITECT_APPS_AI_MOCK` unset. |
| Founder-pilot model | Disabled until commissioned | Separate founder authorization for `ARCHITECT_APPS_FOUNDER_PILOT=true` + `ARCHITECT_APPS_AI_ENABLED=true` + server-only `OPENAI_API_KEY`. Propose, approve, start, retries and revisions all require session `founder_access`. Credit does not provide worker, DB, image or permissions. Ordinary accounts stay unavailable. |
| Worker presence before spend | Implemented in code; no commissioned host | Paid propose reads `architect_apps_worker_readiness` (schema, digest, isolation, queue, artifacts, 90s heartbeat). Missing/stale evidence sends no model request. |
| Acceptance budget | Implemented in code; $1.00 reserved, two calls | Atomic reserve/begin/finish on `gpt-6-astra` short-context $10/$50 per 1M. Clients cannot cancel or reduce started or uncertain usage. The conservative token bound is not a guaranteed spending cap. OpenAI spend alerts are not a cap. |
| SQL execution policy | Implemented; default off | `architect_apps_execution_policy.founder_pilot` plus `founder_access` on approve/start/reserve/begin/finish. Env flags do not authorize a direct PostgREST call. |
| Talk adapter | Pending on this checkout | Integrate Talk #131 `ddfd497` / retain `f357385` candidate; do not copy Talk files from this branch |

## Sequence if later authorized

Merging this PR to `main` typically triggers the existing Vercel Production deploy. That is not authorized here. The web plane would go live without a worker or hosted schema. Generation would still stay off until the founder-pilot names are set.

1. Apply shared Apps schema once (coordinate with Talk) and the #130 extras (`156000`, `156500`, `156600`, and `155000` only when Talk retain will not apply), then verify the physical schema including `architect_app_preview_sessions`, `architect_app_generation_runs`, `architect_app_worker_presence`, and `architect_apps_execution_policy`.
2. Provision the approved Docker Droplet. Prepare both images and the uid-1000 work root. Prove write, compile and topology.
3. Set preview secret and Apps flags on Vercel only after worker preflight is green. Do not enable `ARCHITECT_APPS_AI_MOCK` on production.
4. Start the supervised packaged worker. Confirm one isolated Field Notes compile before inviting anyone else.
5. Only after that compile, and only with a separate founder approval, set `ARCHITECT_APPS_FOUNDER_PILOT` and `ARCHITECT_APPS_AI_ENABLED` with a server-only key.
6. Only after that, and only with a separate founder approval, `select public.architect_apps_set_execution_policy(true)` as service-role. Env flags do not authorize direct PostgREST execution.
7. Rollback: `architect_apps_set_execution_policy(false)`, then unset `ARCHITECT_APPS_FOUNDER_PILOT` and `ARCHITECT_APPS_AI_ENABLED`, then `ARCHITECT_APPS_ENABLED`, stop the worker, leave tables in place. Do not drop owner records. Revert the image tag only after a newer tag has failed isolation.

See [ARCHITECT_APPS_ACTIVATION.md](ARCHITECT_APPS_ACTIVATION.md) for the exact activation decision.

## Rollback that is not authorized here

No hosted migration, credential, paid service, main merge or production deploy is performed by this workstream.
