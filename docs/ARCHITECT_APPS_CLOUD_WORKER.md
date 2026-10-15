# Architect Apps cloud worker — commissioning path

Date: 2026-10-15. PR #130 continuation. This is not a production authorization, credential write, hosted migration, or purchase.

The web application and the isolated compilation worker are separate processes. Vercel serves the signed-in Architect UI, queues owner-approved builds, and signs preview sessions. It cannot compile generated code. Generated project code runs only inside the pinned toolchain image with `--network none`, user `65534:65534`, no Docker socket, and no host secrets.

## Three states (do not collapse these)

| State | What it is | What it is not |
| --- | --- | --- |
| Built image | `aethelios-architect-apps:2026-10-15.1` and `aethelios-architect-apps-worker:2026-10-15.1` exist (`docker image inspect`) | A running process or a production service |
| Running worker | Packaged worker container claimed a job, compiled under `ARCHITECT_APPS_WORK_ROOT`, published an artifact | A commissioned production service |
| Commissioned production service | Founder-approved hosted migrations + secrets + DigitalOcean Docker Droplet + `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned` | Anything this agent can turn on |

A founder phone or laptop is not in the production dependency chain. GitHub Actions `ubuntu-latest` is the authorized verification host for image build, topology, isolated compile, and the authenticated packaged-worker journey.

## Deployment modes

`ARCHITECT_APPS_DEPLOYMENT_MODE` is explicit. Production `APP_ENV` stays **closed** unless the mode is `commissioned`. Setting `APP_ENV=local` on a hosted project is still rejected by `parseEnvironment`. Calling production “local” does not authorize a worker.

| Mode | Where | Compiles |
| --- | --- | --- |
| `local` | Loopback development / CI Auth | Yes, when Origin/Apps flags, worker token, and a non-Vercel plane are present |
| `preview` | Non-production app plane | Same as local; still not Vercel |
| `commissioned` | Dedicated worker host matching the production database | Yes, only after isolation, digest, schema, identity and control-plane names all pass |
| `closed` | Default for `APP_ENV=production` | No |

Commissioned prerequisites (names only; values stay in the host secret store):

- `ARCHITECT_ORIGIN_ENABLED=true`
- `ARCHITECT_APPS_ENABLED=true`
- `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`
- `ARCHITECT_APPS_REQUIRE_ISOLATION=true`
- `ARCHITECT_APPS_IMAGE` and `ARCHITECT_APPS_IMAGE_DIGEST` (`sha256:` + 64 hex, must match `docker image inspect`)
- `ARCHITECT_APPS_WORK_ROOT` (identical absolute path on the Docker host and inside the worker)
- `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32)
- `ARCHITECT_APPS_WORKER_ID`
- Matching `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Server-only `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENV` parseable (`production` or `preview`)
- No `VERCEL` / `VERCEL_ENV`
- No `ARCHITECT_APPS_STORE=memory`
- No `ARCHITECT_APPS_ALLOW_HOST_FIXTURE=true`
- Schema contracts in `requiredAppsSchemaContracts` present, including `architect_app_artifacts.revision_id` and `architect_app_preview_sessions`

Paid OpenAI (`ARCHITECT_APPS_AI_ENABLED`) stays a separate founder decision.

## Images

| Image | Dockerfile | Role |
| --- | --- | --- |
| `aethelios-architect-apps:2026-10-15.1` | `deploy/architect-apps/Dockerfile` | Toolchain for generated compiles |
| `aethelios-architect-apps-worker:2026-10-15.1` | `deploy/architect-apps/worker/Dockerfile` | Supervised worker process |

A clean runner cannot reuse another job’s Docker cache. Build or inspect both images on the same host that will run the proof:

```
node scripts/architect-apps-prepare-runtime.mjs
```

That helper:

1. Requires a Docker daemon when `ARCHITECT_APPS_REQUIRE_ISOLATION=true`.
2. Builds `aethelios-architect-apps:2026-10-15.1` from `deploy/architect-apps/Dockerfile`.
3. Builds `aethelios-architect-apps-worker:2026-10-15.1` via `fs.mkdtempSync` + `docker build`.
4. Inspects both image IDs (`sha256:`).
5. Prepares `ARCHITECT_APPS_WORK_ROOT` as uid 1000 / gid 1000 / mode 0755.
6. Writes `docs/evidence/architect-apps/runtime-receipt.json`.

Job split:

| Job | Images | Packaged-worker acceptance |
| --- | --- | --- |
| Quality `application` | None required | No. Live topology/write/compile stay gated on `ARCHITECT_APPS_REQUIRE_ISOLATION` |
| Quality `apps-isolate` | Prepare-runtime first | Yes: `--prove-write`, `--prove-compile` (success + typecheck failure + cleanup), `--prove-topology` |
| Origin `local-auth` | Prepare-runtime first | Yes: write/compile proofs, then the signed-in packaged journey |
| Origin `application` | None required | Unit/browser only |

The worker-image helper stages with `fs.mkdtempSync(join(tmpdir(), 'apps-worker-image-'))` and executes `docker build`. A static import check is not the proof. The worker image copies a bundled `apps-worker.mjs` only. It never includes `.env*`, owner records, or generated app source.

## Shared-path isolation recipe

A temporary directory created inside the worker container is **not** visible to the host Docker daemon. Sibling `docker run -v` mounts the **host** path.

Ownership contract (least privilege; not 777, not root, not privileged):

| Actor | UID:GID | May write | Docker socket |
| --- | --- | --- | --- |
| Host launcher | runner user | Creates the path, then `sudo install -d -o 1000 -g 1000 -m 0755` | Host daemon only |
| Packaged worker | `1000:1000` (`USER node`) plus `--group-add` docker gid | Shared work root 0755 | Yes, sibling compiles only |
| Generated compile | `65534:65534` | tmpfs `/work` `/tmp` `/out` | No |

`--group-add` must stay a separate flag. Splicing it between `--user` and `1000:1000` turns the image name into a numeric tag.

Required recipe:

```
export ARCHITECT_APPS_WORK_ROOT=/var/lib/architect-apps-work
node scripts/architect-apps-prepare-runtime.mjs
node scripts/architect-apps-packaged-worker.mjs --prove-write
node scripts/architect-apps-packaged-worker.mjs --prove-compile
node scripts/architect-apps-packaged-worker.mjs --prove-topology
node scripts/architect-apps-packaged-worker.mjs --once
```

`--prove-write` must create and delete a worker-owned file as uid 1000. `--prove-compile` must compile Field Notes, fail a broken typecheck, keep no leftover `architect-apps-iso-*` directories, and confirm named containers are gone. A readable host marker is not that proof.

`scripts/architect-apps-packaged-worker.mjs` runs the worker image with:

- `--network host` so the worker can reach Supabase
- `--group-add` the Docker socket group
- `-v /var/run/docker.sock:/var/run/docker.sock` on the **worker only**
- `-v $ARCHITECT_APPS_WORK_ROOT:$ARCHITECT_APPS_WORK_ROOT` at the identical path
- `-e ARCHITECT_APPS_WORK_ROOT=...`

Generated compile containers stay `--network none`, user `65534:65534`, no socket, no secrets, 1024m / 2 CPUs / 128 pids.

## Process commands

```
npm run architect:apps-worker:preflight
npm run architect:apps-worker:health
npm run architect:apps-worker
npm run architect:apps-worker:supervised
npm run architect:apps-worker:image
npm run architect:apps-worker:prepare
npm run architect:apps-worker:write
npm run architect:apps-worker:compile
npm run architect:apps-worker:packaged -- --once
npm run architect:apps-worker:topology
```

Preflight validates each table/RPC against its real contract (`architect_app_artifacts` uses `revision_id`). Failures are classified `unavailable`, `denied`, or `misconfigured`. Health prints sanitized JSON: `idle`, `working`, `unavailable`, or `misconfigured`, plus missing **names**. Secret values are not printed. `ARCHITECT_APPS_WORKER_HEALTH_PORT` may bind `127.0.0.1` only.

Graceful shutdown uses SIGINT/SIGTERM. Leases expire and are recovered by `recoverTimeouts`. Supervised retries use bounded exponential backoff. Commissioned concurrency is 1.

## Preview sessions across instances

HMAC sessions remain `v1.nonce.exp.mac`. That is not authorization by itself. Current nonce, owner, revision, expiry and explicit revocation live in `architect_app_preview_sessions` (or an equivalent shared store). `ARCHITECT_APPS_PREVIEW_CLUSTER=true` requires that shared store. A missing in-process map, a process restart, a revoked nonce, a replaced revision, or an account switch is **deny**. Two web instances succeed only when they share the store.

## Hosting decision (not provisioned)

Inspected 2026-10-15:

| Option | Docker daemon for sibling `--network none` compiles | Persistent supervised process | Cost | Verdict |
| --- | --- | --- | --- | --- |
| This Cursor cloud VM | No Docker CLI | Ephemeral | n/a | Verification only |
| GitHub Actions `ubuntu-latest` | Yes | No | Already used by this repository | **Used now** to build images, prove topology, run isolated compile, run the packaged worker, and prove fail-closed commissioned preflight |
| Vercel | No | No | Existing web host | Web only. Worker remains forbidden |
| Fly.io Machines | Image boots as a Firecracker VM; no Docker daemon in the path | Yes | shared-cpu-1x 256 MB $2.19/mo; performance-1x 2 GB $33.00/mo ([Fly pricing](https://fly.io/pricing/)) | Not selected. Cannot run the current isolate adapter without a separately accepted DinD design |
| DigitalOcean Docker Droplet | Yes (Marketplace Docker 1-Click, no extra app fee) | Yes | Basic 2 GiB / 1 vCPU **$12/mo** cap, $0.01786/hr; 1 GiB $6/mo is below the 1024m compile tmpfs | **Selected recommendation** if a persistent worker is later approved |

No account was created and no Droplet was purchased.

## Founder approval package (not executed)

Required target: DigitalOcean Docker Droplet, Basic 2 GiB / 1 vCPU, Marketplace Docker, **$12/month**.

Configuration names (values stay in the Droplet secret store, never in Git):

- `APP_ENV=production`
- `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`
- `ARCHITECT_APPS_REQUIRE_ISOLATION=true`
- `ARCHITECT_APPS_WORK_ROOT=/var/lib/architect-apps-work`
- `ARCHITECT_APPS_IMAGE` / `ARCHITECT_APPS_IMAGE_DIGEST`
- `ARCHITECT_APPS_WORKER_ID`
- `ARCHITECT_CONSTRUCT_WORKER_TOKEN`
- Matching `NEXT_PUBLIC_SUPABASE_URL` + publishable key
- Server-only `SUPABASE_SERVICE_ROLE_KEY`
- `ARCHITECT_APPS_PREVIEW_SECRET` on the **web** plane, plus `ARCHITECT_APPS_PREVIEW_CLUSTER=true` there
- No `VERCEL*` on the worker, no memory store, no host-fixture

Migrations, in order, local-only until founder-approved hosted application:

1. `20261015080000_architect_apps.sql`
2. `20261015120000_architect_apps_durable.sql`
3. `20261015140000_architect_apps_mutation.sql`
4. `20261015155000_architect_apps_retain_verified.sql`
5. `20261015156000_architect_apps_preview_sessions.sql`

A merge of this PR into `main` is **not** a GitHub-only operation. The connected Vercel project deploys Production from `main`. Merging would publish the web plane without a commissioned worker, without hosted Apps migrations, and without preview-cluster secrets. Do not merge until those hosted steps are separately approved. Vercel never runs the worker. An HTTP 200 from the Next.js server is not worker readiness.

Readiness (`--health` / `--preflight`) reports isolation, schema contracts, work-root ownership, digest match and missing **names**. If the worker is down, Architect keeps jobs `queued` and the workbench says the build is queued; it does not invent a compiled preview.

Deployment sequence after approval:

1. Apply the five Apps migrations to the existing Gent Ascend database (not from a founder laptop checklist; use the authorized hosted SQL path). Recorded migration history is not the same as a verified physical schema — confirm the five files exist on the chosen project before enabling flags.
2. Build both images on the Droplet from this repository SHA (`node scripts/architect-apps-prepare-runtime.mjs`).
3. `node scripts/architect-apps-packaged-worker.mjs --prove-write`
4. `node scripts/architect-apps-packaged-worker.mjs --prove-compile`
5. `node scripts/architect-apps-packaged-worker.mjs --prove-topology`
6. `node scripts/architect-apps-packaged-worker.mjs --preflight` must report `ok` / `idle` with work-root `ready`.
7. Start the supervised packaged worker.
8. Enable `ARCHITECT_APPS_ENABLED=true` and preview-cluster on Vercel only after preflight is green.
9. Do not enable paid OpenAI in the same step.

Cost: **$12/month** Droplet. No additional Docker license. OpenAI remains a separate credit decision. A founder laptop with Docker is not the deployment plan.

Missing host/configuration decision if this is refused: there is no authorized persistent Docker host in existing infrastructure. GitHub Actions can prove a running packaged worker for a job; it cannot remain the production worker.

## Rollback

1. Stop the worker process or Droplet.
2. Set `ARCHITECT_APPS_ENABLED=false` on the web plane. Owner tables stay.
3. Leave `ARCHITECT_APPS_DEPLOYMENT_MODE` unset/`closed` on production until a newer digest is proven.
4. Do not drop Apps tables to roll back.

## What this agent can complete vs what stays a founder action

Completed in code: fail-closed modes, worker/toolchain image recipes with a real `docker build`, per-job image prerequisites, uid-1000 work-root contract, contract-aware preflight, shared preview revocation, shared-path packaged-worker recipe, write/compile/topology proofs, supervised loop, sanitized logs, CI verification of isolated compile, and commissioned refusal.

Not done and not authorized here: apply hosted Apps migrations, create DigitalOcean/Fly credentials, store `SUPABASE_SERVICE_ROLE_KEY` or worker tokens on a host, enable production flags, provision the $12 Droplet, spend money, or merge to main.
