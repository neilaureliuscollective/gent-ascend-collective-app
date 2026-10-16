# Architect Apps activation preparation — not activated

Current source and dated production facts: [ARCHITECT_COMMISSIONING.md](ARCHITECT_COMMISSIONING.md), inspected 2026-10-16. This replaces the earlier uncommissioned snapshot; no hosted apply, purchase, credential configuration, generation enablement, merge or deployment is authorized here. #154's release remains separate.

## Reviewed order, not executed

1. Review the physical existing base/retain schema and the four missing Apps dependencies listed in commissioning. Obtain a separate approval for additive hosted completion. Preserve all projects, versions and records; no reset, replay or interim retain overwrite.
2. Approve and commission a persistent Docker worker host. Prove image integrity, shared work-root write, isolated compile and packaged-worker topology on that host. Record exact source SHA and immutable image digests. A build log or listening port alone is insufficient.
3. Separately configure web/worker settings below through the owner's secret store. Keep paid generation off until readiness and fixture/approved-source compilation pass. The worker needs no OpenAI key. Normal preflight reports worker presence, so invoking it against hosted data requires the corresponding authorization.
4. Review exact integrated-candidate tests and compatibility with #154, then obtain separate merge/deployment authorization. This branch's code has not been deployed by this task.
5. Separately authorize founder-pilot generation flags and the database execution policy. Default policy stays false. Env flags alone cannot authorize direct PostgREST approve/start/reserve/begin.
6. Separately approve a bounded real-model proposal for the existing Nexus project, then review/approve/compile/preview/revise/reopen as in commissioning. Stop on uncertain or failed spend; do not automatically retry a provider call.

## Web plane, Vercel

Name-only checklist; no secret values belong in Git or chat:

- `APP_ENV=production`, existing matching public Supabase URL/publishable key; existing owner session and person-bound `founder_access`.
- `ARCHITECT_ORIGIN_ENABLED=true` (observed already set), `ARCHITECT_APPS_ENABLED=true` (not observed).
- Shared `ARCHITECT_APPS_PREVIEW_SECRET` of at least 16 characters and `ARCHITECT_APPS_PREVIEW_CLUSTER=true`; matching physical preview-session schema.
- `ARCHITECT_APPS_IMAGE_DIGEST` matching the worker's immutable toolchain image. **Required on web as well as worker** for paid-generation admission.
- Only after separate approval: `ARCHITECT_APPS_FOUNDER_PILOT=true`, `ARCHITECT_APPS_AI_ENABLED=true`, existing server-only `OPENAI_API_KEY`; `AURELIUS_AI_MODEL` unset or `gpt-6-astra`.
- Never enable mock/fixture/memory-store/host-fixture settings in production. Optional GitHub credentials do not enable Apps and are not required for standalone builds.

The web model adapter generates source; Vercel does not execute generated code. Compile worker credentials never enter generated bundles or iframe code.

## Smallest host matching the current worker limits

A persistent Linux Docker Engine host, **at least 2 vCPU / 2 GiB RAM**, single worker concurrency, sufficient disk for both pinned images and transient work. The current compile invocation requests `--cpus 2`, `--memory 1024m`, `--pids-limit 128`, read-only root, bounded writable tmpfs, uid 65534, all capabilities dropped, no-new-privileges and **network none**. The earlier 1-vCPU recommendation does not match this CPU request. 4 GiB RAM offers more daemon/build-image headroom, but is not claimed necessary without a host proof.

DigitalOcean's [current Basic pricing](https://www.digitalocean.com/pricing/droplets), read 2026-10-16, lists 2 GiB / 2 vCPU / 60 GiB at **$18/month** and 4 GiB / 2 vCPU / 80 GiB at **$24/month**, excluding tax/optional services. Purchase/provisioning is not approved. The $18 option is a candidate minimum, not a measured Nexus-host acceptance result. An existing equivalent dedicated Docker host could avoid a new purchase; no such host was verified here.

Worker names:

- `APP_ENV=production`, `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`, Origin/Apps enabled, `ARCHITECT_APPS_REQUIRE_ISOLATION=true`.
- `ARCHITECT_APPS_IMAGE=aethelios-architect-apps:2026-10-15.1`, `ARCHITECT_APPS_WORKER_IMAGE=aethelios-architect-apps-worker:2026-10-15.1`; record actual image digests, with matching `ARCHITECT_APPS_IMAGE_DIGEST` on web.
- `ARCHITECT_APPS_WORK_ROOT=/var/lib/architect-apps-work`, identical host/container path; uid 1000, mode 0755 or 2775 with Docker socket group. Never chmod 777.
- Unique `ARCHITECT_APPS_WORKER_ID`, server-only `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (at least 32 characters), matching Supabase URL/publishable key and service-role key.
- No `VERCEL`/`VERCEL_ENV`; no OpenAI key passed to the packaged worker. Host Docker socket is powerful control-plane authority; generated-code containers never receive it or secrets.
- Supervise the packaged worker with automatic restart and boot startup (existing entrypoint loops); restrict SSH, expose no public worker port, health only on loopback. Keep private durable jobs/artifacts in the existing database; no separate project database is needed.

Existing prepare-runtime and packaged-worker write/compile/topology/preflight scripts supply receipts. They are **not executed by this document**. Worker freshness is 90 seconds; missing, stale, malformed or mismatched evidence blocks paid generation. A stopped worker must leave queued work honestly queued, not fabricate a preview.

## Spend and rollback boundaries

Current code permits at most two calls per run, 16k bounded input / 4k output tokens per call, $1 reserved allowance, `maxRetries=0`, 30s generation and 90s compile limits. The bound is not a provider-guaranteed spending cap; pricing/model availability must be verified when asking for spend approval. No model call was made here.

For a separately authorized rollback, disable SQL execution policy and generation flags first, then stop worker/disable Apps if needed. Preserve all tables, project revisions, artifacts and records. A code rollback is not a schema rollback. No rollback actions are executed here.
