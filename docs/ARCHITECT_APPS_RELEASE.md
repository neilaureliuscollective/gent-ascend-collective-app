# Architect Apps release path — not live

Implemented on PR #130. This is not a production authorization and not a claim that review-ready means hosted.

## Implemented code

- Owner APIs, durable Apps RPCs, isolated Docker compile, compiled iframe, host collections, mutation identity, and the Origin workbench.
- Local additive migrations: `20261015080000_architect_apps.sql`, `20261015120000_architect_apps_durable.sql`, `20261015140000_architect_apps_mutation.sql`, `20261015155000_architect_apps_retain_verified.sql`, `20261015156000_architect_apps_preview_sessions.sql`.
- Pinned images `aethelios-architect-apps:2026-10-15.1` and `aethelios-architect-apps-worker:2026-10-15.1`. Prepare both with `node scripts/architect-apps-prepare-runtime.mjs` on the host that will compile.
- Labelled mocked provider (`ARCHITECT_APPS_AI_MOCK`) for Field Notes. Paid OpenAI stays off until separately authorized.

## Missing hosted infrastructure

| Prerequisite | Current | Smallest action |
| --- | --- | --- |
| Hosted Apps migrations | Unapplied | Founder-authorized hosted apply of the five local files above. Recorded history is not physical schema. Health `20261015181000` is unrelated and stays on its own approval. |
| Worker host | Code-complete commissioned path; no persistent host | Founder-approved DigitalOcean Docker Droplet (Basic 2 GiB, $12/mo) or equivalent daemon host. Set `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`. Vercel and Fly Machines are not that host. A founder laptop is not the plan. |
| Isolated images | Built in Quality `apps-isolate` and Origin `local-auth` after prepare-runtime | Same pinned tags on the worker host; work root uid 1000 mode 0755; no unsandboxed fallback |
| `ARCHITECT_APPS_PREVIEW_SECRET` | Required; shared `architect_app_preview_sessions` | Hosted secret ≥16 chars plus `ARCHITECT_APPS_PREVIEW_CLUSTER=true` on the web plane. Missing/revoked sessions deny. |
| Feature flags | Default false | Hosted `ARCHITECT_ORIGIN_ENABLED` + `ARCHITECT_APPS_ENABLED`. Keep `ARCHITECT_APPS_AI_MOCK=true` until a paid model run is authorized |
| Model | Unrun | Separate founder authorization for `ARCHITECT_APPS_AI_ENABLED` + `OPENAI_API_KEY`. Credit does not provide worker, DB, image or permissions |
| Talk adapter | Pending on this checkout | Integrate Talk #131 `ddfd497` / retain `f357385` candidate; do not copy Talk files from this branch |

## Sequence if later authorized

Merging this PR to `main` typically triggers the existing Vercel Production deploy. That is not authorized here. The web plane would go live without a worker or hosted schema.

1. Apply the five Apps migrations to the chosen hosted project and verify the physical schema.
2. Provision the approved Docker Droplet. Prepare both images and the uid-1000 work root. Prove write, compile and topology.
3. Set preview secret and flags on Vercel only after worker preflight is green. Do not enable paid generation in the same step unless authorized.
4. Start the supervised packaged worker. Confirm one isolated Field Notes compile before inviting anyone else.
5. Rollback: disable `ARCHITECT_APPS_ENABLED`, stop the worker, leave tables in place. Do not drop owner records. Revert the image tag only after a newer tag has failed isolation.

## Rollback that is not authorized here

No hosted migration, credential, paid service, main merge or production deploy is performed by this workstream.
