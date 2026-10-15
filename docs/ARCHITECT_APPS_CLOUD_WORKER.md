# Architect Apps cloud worker — commissioning path

Date: 2026-10-15. PR #130 continuation. This is not a production authorization, credential write, hosted migration, or purchase.

The web application and the isolated compilation worker are separate processes. Vercel serves the signed-in Architect UI, queues owner-approved builds, and signs preview sessions. It cannot compile generated code. Generated project code runs only inside the pinned toolchain image with `--network none`, user `65534:65534`, no Docker socket, and no host secrets.

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
- `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32)
- `ARCHITECT_APPS_WORKER_ID`
- Matching `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Server-only `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENV` parseable (`production` or `preview`)
- No `VERCEL` / `VERCEL_ENV`
- No `ARCHITECT_APPS_STORE=memory`
- No `ARCHITECT_APPS_ALLOW_HOST_FIXTURE=true`
- Schema tables listed in `requiredAppsSchemaNames` present

Paid OpenAI (`ARCHITECT_APPS_AI_ENABLED`) stays a separate founder decision.

## Images

| Image | Dockerfile | Role |
| --- | --- | --- |
| `aethelios-architect-apps:2026-10-15.1` | `deploy/architect-apps/Dockerfile` | Toolchain for generated compiles |
| `aethelios-architect-apps-worker:2026-10-15.1` | `deploy/architect-apps/worker/Dockerfile` | Supervised worker process |

Build on a host that already has Docker:

```
node scripts/architect-apps-image.mjs
node scripts/architect-apps-worker-image.mjs
```

The worker image copies a bundled `apps-worker.mjs` only. It never includes `.env*`, owner records, or generated app source. The toolchain image is pulled/built separately and used as a sibling container.

## Process commands

```
npm run architect:apps-worker:preflight
npm run architect:apps-worker:health
npm run architect:apps-worker
npm run architect:apps-worker:supervised
```

Preflight and health print sanitized JSON: `idle`, `working`, `unavailable`, or `misconfigured`, plus missing **names**. Secret values are not printed. `ARCHITECT_APPS_WORKER_HEALTH_PORT` may bind `127.0.0.1` only.

Graceful shutdown uses SIGINT/SIGTERM. Leases expire and are recovered by `recoverTimeouts`. Supervised retries use bounded exponential backoff. Commissioned concurrency is 1. Compile containers stay at 1024m / 2 CPUs / 128 pids.

## Preview sessions across instances

HMAC sessions remain `v1.nonce.exp.mac`. A process restart issues a new session on the next library GET. `ARCHITECT_APPS_PREVIEW_CLUSTER=true` on a production/preview web plane accepts a still-valid HMAC after the in-process map is empty so Vercel instances and replacement servers can reopen data without weakening expiry or owner binding. Memory-store and local unsigned fallbacks stay refused.

## Hosting decision (not provisioned)

Inspected 2026-10-15:

| Option | Docker daemon for sibling `--network none` compiles | Persistent supervised process | Cost | Verdict |
| --- | --- | --- | --- | --- |
| This Cursor cloud VM | No Docker CLI | Ephemeral | n/a | Verification only |
| GitHub Actions `ubuntu-latest` | Yes | No | Already used by this repository | **Used now** to build images, run isolated compile, and prove fail-closed commissioned preflight |
| Vercel | No | No | Existing web host | Web only. Worker remains forbidden |
| Fly.io Machines | Image boots as a Firecracker VM; no Docker daemon in the path | Yes | shared-cpu-1x 256 MB $2.19/mo; performance-1x 2 GB $33.00/mo ([Fly pricing](https://fly.io/pricing/)) | Not selected. Cannot run the current isolate adapter without a separately accepted DinD design |
| DigitalOcean Docker Droplet | Yes (Marketplace Docker 1-Click, no extra app fee) | Yes | Basic 2 GiB / 1 vCPU **$12/mo** cap, $0.01786/hr; 1 GiB $6/mo is below the 1024m compile tmpfs | **Selected recommendation** if a persistent worker is later approved |

No account was created and no Droplet was purchased.

## Rollback

1. Stop the worker process or Droplet.
2. Set `ARCHITECT_APPS_ENABLED=false` on the web plane. Owner tables stay.
3. Leave `ARCHITECT_APPS_DEPLOYMENT_MODE` unset/`closed` on production until a newer digest is proven.
4. Do not drop Apps tables to roll back.

## What this agent can complete vs what stays a founder action

Completed in code: fail-closed modes, worker/toolchain image recipes, preflight/health, supervised loop, sanitized logs, preview cluster restart behavior, CI verification of isolated compile and commissioned refusal.

Not done and not authorized here: apply hosted Apps migrations, create DigitalOcean/Fly credentials, store `SUPABASE_SERVICE_ROLE_KEY` or worker tokens on a host, enable production flags, or merge to main.
