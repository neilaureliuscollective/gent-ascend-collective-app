# Architect Apps activation preparation — not activated

Current source and dated production facts: [ARCHITECT_COMMISSIONING.md](ARCHITECT_COMMISSIONING.md), inspected 2026-10-16. This replaces the earlier uncommissioned snapshot; no hosted apply, purchase, credential configuration, generation enablement, merge or deployment is authorized here. #154's release remains separate.

## Revised SQL candidate — earlier approval not executed

The 2026-10-16 21:10 UTC approval covered the four files at `7f237291`. Fresh production preflight stopped before any write: production default grants give `authenticated` ALL table privileges, while two files only revoked PUBLIC/anon. A disposable replay confirmed authenticated TRUNCATE succeeded despite RLS. No transaction or migration receipt was created; all five new tables remained absent. The earlier fixture had not modeled those defaults.

This candidate changes only two SQL privilege declarations (plus explanatory comments): revoke ALL from `public, anon, authenticated`, then retain the existing GRANT SELECT to authenticated, on `architect_app_preview_sessions` and `architect_app_generation_runs`. It removes default INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN privileges without changing owner SELECT policies, RPC signatures/bodies, data or service-role authority. The execution-policy and budget-lock files, and the worker-presence declaration, already revoke authenticated/anon defaults; their SQL is unchanged. Existing service-role default privileges remain unchanged and must not be described as narrowed to the explicit grants.

**Revised files require fresh review and explicit approval. The earlier approval is not reused.** Exact candidate SHA and final CI are recorded on draft PR146. The single release manifest contains these amended file hashes; its historical source profiles still do not certify the current hosted state.

| Ordered file | SHA-256 |
| --- | --- |
| `20261015156000_architect_apps_preview_sessions.sql` | `3f9487760e56d0dccaa58a5de841a14aa2cf3cab97892b301c519dd38dcc9204` |
| `20261015156500_architect_apps_pilot_budget.sql` | `d11ed64353225d3e6ce82adb51664e240f791034ebc68463f5cb5925978a4d4d` |
| `20261015156600_architect_apps_execution_gate.sql` | `a483c7820a6b9ac3f43ca9001fda88cf8754729b69d4a671923db374d346346b` |
| `20261015156700_architect_apps_budget_lock.sql` | `fcd7758b35c6805bab2829d1756da2abc4c209058988ed96f1bf24beb05fe369` |

The revised transaction plan, **not executed**:

1. Reconfirm approval for the exact candidate/hash set and only `volpzkfsnmtztrovexcw`; verify all five additions absent, prerequisite schemas/signatures/default ACLs unchanged, no duplicate receipt, and preserve current Origin/data and retain/provenance fingerprints. Stop on drift. Confirm the selected migration route guarantees one atomic execution with assertions before commit and reliable receipt recording; otherwise stop before writing.
2. Apply exactly the four files above in order inside that single transaction. No partial commits, 155000 replay, later retain replay, PR154 migration, entitlement grant or generation enablement.
3. Before commit, assert one policy row with `founder_pilot=false`; final schema/function contracts and obsolete overload removal; no anon table access; authenticated SELECT only on preview sessions, generation runs and execution policy, no direct access to worker presence/budget locks; no authenticated/anon mutation, TRUNCATE, REFERENCES, TRIGGER or MAINTAIN on any new table. Assert owner RPC EXECUTE grants, service-only privileged RPC grants, intended service-role operations and unchanged existing data/retain/provenance fingerprints. Any mismatch aborts the entire transaction.
4. Record one truthful new completion receipt naming the four source files, their hashes and candidate SHA. Do not mark old versions or later migrations applied. Read back physical contracts, ACLs, disabled policy, preservation fingerprints and receipt after commit. Report committed, rolled back or not executed precisely; never retry blindly after an uncertain response.

Regression coverage models production ALL table/function defaults, denies actual authenticated/anon INSERT/UPDATE/DELETE/TRUNCATE statements on all five tables, checks the complete privilege matrix, and exercises owner reads/lifecycle plus service-role policy/presence/probe operations. These disposable tests do not establish hosted acceptance.

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

## Prepared bounded approval requests — not granted
1. **Schema only:** approve the revised four-file hash set and exact PR146 candidate described above for `volpzkfsnmtztrovexcw`, with all precommit assertions and receipt requirements. The earlier approval was stopped and does not authorize these revised files. No hosted SQL batch has run.
2. **Preview configuration only (two explicit targets):** (a) approve repairing only the matching Supabase URL/publishable-key pair for PR146's Vercel preview environment, without changing production credentials; a new preview attempt requires explicit authorization. (b) separately approve production web ARCHITECT_APPS_ENABLED=true, an owner-managed shared ARCHITECT_APPS_PREVIEW_SECRET, ARCHITECT_APPS_PREVIEW_CLUSTER=true and ARCHITECT_APPS_IMAGE_DIGEST matching the commissioned toolchain. Keep AI/founder-pilot flags and SQL policy off. Place values through the owner's secret store, never chat/Git. No service-role/model secrets go to browser/generated code. No deployment or generation permission is implied by either configuration grant.
3. **Worker commissioning only:** select an approved existing persistent Linux Docker host or explicitly approve a 2-vCPU/2-GiB Basic Regular host at $18/month (tax/options excluded); 2-vCPU/4-GiB at $24/month is a separate option. Neither has been benchmarked. The historical 1-vCPU/$12 option cannot satisfy --cpus 2. Approve owner-managed server credentials, pinned image digests, uid-1000 shared work root, one supervised worker and hosted presence/health writes after the queue review. First prove isolated approved-source/fixture compile without provider calls; generated containers get no network/secrets/socket. Keep generation off; stop on memory/disk/isolation failure rather than silently resize or purchase.
4. **Founder-only enablement:** after the recorded identity resolution, authenticated owner verification, exact-candidate CI, schema and host receipts, separately approve ARCHITECT_APPS_AI_ENABLED=true and ARCHITECT_APPS_FOUNDER_PILOT=true plus SQL founder_pilot=true for a controlled acceptance window. The implemented entitlement covers existing founder_access holders, not a special Neil-only allowlist; verify intended population before approval. This permission does not itself authorize a provider call. Preserve ordinary-account denial and retain an approved shutdown procedure (policy/flags off and worker stopped if queue execution must cease).
5. **First real Nexus build:** only after the preceding gates and explicit integration/merge/deployment approval, authorize the confirmed owner on the existing saved project for one bounded proposal and at most one revision: gpt-6-astra, maximum two calls total for that existing project/run, ≤16k bounded input/4k output per call, $1 reserved allowance, no automatic retry. Reconfirm provider pricing/availability before spend approval; the allowance is not a provider hard cap. Proposal is the paid boundary, before file/compile approval. Review each proposal before approve/start; demonstrate real isolated compile, preview, search/inspect/focus, owned create/edit/relationships, reload/reopen, one bounded revision and last-good recovery at phone/Fold widths. Stop on uncertain spend or failed evidence; no new run/project to evade the allowance, no hand-coded substitute, ingestion, new dependencies or publishing. Disable the acceptance window using the separately authorized shutdown procedure.

No requests above have been approved by this addendum. No hosted SQL writes, credential/flag changes, provisioning or paid calls occurred.
