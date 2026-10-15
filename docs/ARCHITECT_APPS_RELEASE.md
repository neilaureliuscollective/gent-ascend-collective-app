# Architect Apps release path — not live

Implemented on PR #130. This is not a production authorization and not a claim that review-ready means hosted.

## Implemented code

- Owner APIs, durable Apps RPCs, isolated Docker compile, compiled iframe, host collections, mutation identity, and the Origin workbench.
- Local additive migrations: `20261015080000_architect_apps.sql`, `20261015120000_architect_apps_durable.sql`, `20261015140000_architect_apps_mutation.sql`, `20261015155000_architect_apps_retain_verified.sql`.
- Pinned image `aethelios-architect-apps:2026-10-15.1` from `deploy/architect-apps/Dockerfile`.
- Labelled mocked provider (`ARCHITECT_APPS_AI_MOCK`) for Field Notes. Paid OpenAI stays off until separately authorized.

## Missing hosted infrastructure

| Prerequisite | Current | Smallest action |
| --- | --- | --- |
| Hosted Apps migrations | Unapplied | Founder-authorized hosted apply of the four local files above, after Talk #131 retain/provenance order is decided |
| Worker host | Code-complete commissioned path; no persistent host | Founder-approved DigitalOcean Docker Droplet (Basic 2 GiB, $12/mo) or equivalent daemon host. Set `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`. Vercel and Fly Machines are not that host |
| Isolated image | Built in CI and local Docker | Same pinned tag available to the worker host; no unsandboxed fallback |
| `ARCHITECT_APPS_PREVIEW_SECRET` | Required; in-process session map | Hosted secret ≥16 chars. After process restart, library GET issues a new session. Do not weaken verification |
| Feature flags | Default false | Hosted `ARCHITECT_ORIGIN_ENABLED` + `ARCHITECT_APPS_ENABLED`. Keep `ARCHITECT_APPS_AI_MOCK=true` until a paid model run is authorized |
| Model | Unrun | Separate founder authorization for `ARCHITECT_APPS_AI_ENABLED` + `OPENAI_API_KEY`. Credit does not provide worker, DB, image or permissions |
| Talk adapter | Pending on this checkout | Integrate Talk #131 `ddfd497` / retain `f357385` candidate; do not copy Talk files from this branch |

## Sequence if later authorized

1. Apply Apps migrations to the chosen hosted project.
2. Set preview secret and flags. Do not enable paid generation in the same step unless authorized.
3. Build and pin `aethelios-architect-apps:2026-10-15.1` on the worker host.
4. Start the existing worker. Confirm one isolated Field Notes compile before inviting anyone else.
5. Rollback: disable `ARCHITECT_APPS_ENABLED`, stop the worker, leave tables in place. Do not drop owner records. Revert the image tag only after a newer tag has failed isolation.

## Rollback that is not authorized here

No hosted migration, credential, paid service, main merge or production deploy is performed by this workstream.
