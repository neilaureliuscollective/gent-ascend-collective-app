# Architect commissioning and release readiness

Date: 2026-10-13. Branch `cursor/architect-creation-journey-165a`. Last reviewed head before this pass: `c1eaab9267314875abca432a0d5b333a0f839f29`. No production merge, hosted migration, credential write, OAuth grant, paid model call, or infrastructure purchase.

## Incorporated source heads

Verified with `git merge-base --is-ancestor` against this branch. Source PRs were not merged separately and were not rewritten.

| Workstream | PR | Branch | Exact head | In #120 |
| --- | --- | --- | --- | --- |
| Architect Construct | #116 | `cursor/architect-construct-pipeline-165a` | `ef3741e81fe7ef931cdc1054f7ffc49d86c6dfca` | yes |
| Connections | #117 | `cursor/aethelios-connections-8d20` | `c5581234b6badf2d8dcf0b9ed21fb91256897b5f` | yes |
| Architect immersive UI | #119 | `cursor/architect-immersive-studio-5865` | `7e0cf2c4534a3f8d88e337b22af8f127c0301a5b` | yes |
| main | #118 | `main` | `9dda52549dac548b59b3e3175f2ee832cb4ed471` | yes |
| Talk conversational creation | #121 | `cursor/talk-conversational-creation-5b08` | `9c514fc1c692735d408558b01ae302b8d2294595` | **no — keep on Talk** |

`#120` is 23 commits ahead of `main` and 0 behind. Source PR heads have not moved since incorporation.

### Talk #121 overlap

Shared files only: `docs/STATUS.md`, `docs/DECISIONS.md`, `src/platform/supabase/database.ts`. Talk adds `ai_talk_*` tables; this branch adds Construct and Connections tables. Do not copy Talk types here. A later merge must combine both additive Database blocks.

Talk stages `talk-architect-handoff/v1` and `ConversationDraft.take('architect')`. `imported` stays false until Architect acknowledges a package. This branch does **not** take that package and does **not** claim import. Receiver acknowledgment remains a follow-up after Talk #121.

## Readiness inventory

Marks: **implemented/tested**, **configuration-dependent**, **missing code**, **unverified**.

| Capability | Mark | Evidence |
| --- | --- | --- |
| Save and reopen a project and its revisions | implemented/tested | Origin browser suite; save receipts; revision history. Hosted Origin persistence is configuration-dependent (`ARCHITECT_ORIGIN_ENABLED` + `20261012230000_architect_origin.sql`). |
| GitHub/Vercel connection entry points | implemented/tested | `/app/founder/connections`, Founder Office, verified founder account. UI availability is not a connected account. |
| Supported connection permissions | implemented/tested | GitHub read-only: Contents, Metadata, Pull requests, Checks, Commit statuses. Vercel read-only: project, deployment, user, integration-configuration. No contents write, secrets, workflows, env-vars, domain, billing, or deploy write. |
| Select an authorized repository and verify an exact source commit | configuration-dependent | Code: `verifyConstructGitPin` + `architectPinnedSource`. Needs GitHub App registration, selected repository, and Connections migrations. Without them the UI shows setup/not-configured and imported files still work. |
| Proposal | implemented/tested (disabled/mock) | Production and default-off refuse `ARCHITECT_CONSTRUCT_AI_ENABLED`. Mock is labelled and non-production only. Live OpenAI proposal is configuration-dependent and requires funded-test authorization. Credit alone is not enough. |
| Approval bound to exact reviewed inputs | implemented/tested | Server digest; input change invalidates approval. Unit + Origin browser. |
| Replay-safe enqueue | implemented/tested | One idempotency key; lost-response start retry in Origin local-auth durable smoke. |
| Durable status | implemented/tested | Queued/claimed/running/cancelled/failed/succeeded from recorded events. |
| External worker claim, isolated execution | implemented/tested (CI) / configuration-dependent (hosted) | Compiled `npm run architect:worker` / `:supervised`. Closed on production and Vercel. Origin durable smoke + Quality host isolation. |
| Cancellation and cleanup | implemented/tested | Fail-closed; teardown confirmed only after bounded proven absence. Host cancel receipt `proof: confirmed` in Docker CI; `proof: unavailable` is not proof. Durable smoke is a different store. |
| Saved changes, checks, embedded preview | implemented/tested | Construct Plan/Changes/Checks/Preview. Checks are not-run until the worker records exit codes. Preview is isolated static HTML. No running-server preview. |
| Production publishing | implemented/tested as unavailable | Connections remain read-only. No commit, branch publish, or Vercel deploy path. Connecting an account ≠ executing a build ≠ publishing. |
| Model-generated build | missing activation, not missing code | All production/worker/AI restrictions stay. See conditions below. |

No item is inferred as configured from UI availability.

## Production restrictions — what must change for a model-generated build

Inspected in `readiness.ts`, `provider.ts`, `worker-entry.ts`, `.env.example`. **Adding OpenAI credit is not sufficient.**

A founder can run a model-generated **proposal** only when every item is true:

1. `APP_ENV` is not production (`constructAiReady` returns false in production).
2. `ARCHITECT_ORIGIN_ENABLED=true` and `ARCHITECT_CONSTRUCT_ENABLED=true`.
3. Additive Origin + Construct migrations are applied on that database.
4. `ARCHITECT_CONSTRUCT_AI_ENABLED=true`.
5. Server-only `OPENAI_API_KEY` is present.
6. Explicit funded non-production test authorization from the founder (policy, not a silent flag).
7. `ARCHITECT_CONSTRUCT_AI_MOCK` is not being treated as that test.

A founder can run a model-generated **build** (isolated execution of that proposal) only when the proposal conditions plus:

8. `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32) on the **same** non-Vercel worker host.
9. Supervised worker running outside Next/Vercel: `npm run architect:worker:supervised`.
10. Docker Engine on that host, image `node:24-alpine`, `--network none`, nobody 65534. No docker.sock or app-secret mounts.
11. Source snapshot exists (imported files or a verified Git pin). A Git pin without files is a blocker.
12. Isolated execution has already been proven on that project (host/durable receipts), not assumed from a Docker version probe.

`/api/internal/architect-construct` stays closed in production. `constructWorkerAuthorized` refuses production, `VERCEL`, and `VERCEL_ENV`. These restrictions were not removed.

## Configuration inspection (names only)

This agent runtime has no `.env`, `.env.local`, or `.env.development.local`. Every secret value is **unverified**. Docker is **not installed** here.

| Name | Role | This runtime | Hosted ledger / production |
| --- | --- | --- | --- |
| `APP_ENV` | Mode. Production closes Construct AI and the worker. | unverified | unverified here |
| `ARCHITECT_ORIGIN_ENABLED` | Origin persistence. Default false. | unverified | unverified; default closed |
| `ARCHITECT_ORIGIN_AI_ENABLED` | Origin model requests. Default false. | unverified | unverified |
| `ARCHITECT_CONSTRUCT_ENABLED` | Construct API/UI. Default false. | unverified | unverified; default closed |
| `ARCHITECT_CONSTRUCT_AI_ENABLED` | Live proposal. Default false. Production refuses. | unverified | unverified; default closed |
| `ARCHITECT_CONSTRUCT_AI_MOCK` | Labelled non-production mock. | unverified | must stay false in production |
| `ARCHITECT_CONSTRUCT_WORKER_TOKEN` | Worker bearer ≥32. Server-only. | unverified | must not be set on Vercel |
| `ARCHITECT_CONSTRUCT_WORKER_ID` | Lease identity. | unverified | n/a |
| `ARCHITECT_CONSTRUCT_WORKER_MODE` | `tick` (CI) or `supervised`. | unverified | n/a |
| `ARCHITECT_CONSTRUCT_IMAGE` | Default `node:24-alpine`. | unverified | n/a |
| `OPENAI_API_KEY` | Server-only. Reused; not created here. | unverified | do not print |
| `AURELIUS_AI_MODEL` | Responses model. | unverified | do not print |
| `CONNECTIONS_CREDENTIAL_KEY` | 64-hex AES. Independent. | unverified | unverified |
| `NEXT_PUBLIC_APP_URL` | Exact public origin for callbacks. | unverified | must be `https://www.gentascend.com` for production Connections |
| `GITHUB_APP_*` | App id/slug/client/secret/private key/webhook. | unverified | registration missing |
| `VERCEL_INTEGRATION_*` | Native integration slug/client/secret/webhook. | unverified | registration missing |
| `NEXT_PUBLIC_SUPABASE_URL` / publishable key | Canonical Gent project. | unverified | existing production binding; not inspected here |

### Required migrations vs hosted ledger

The recorded hosted snapshot in `scripts/check-migration-ledger.mjs` ends at Studio footage (`20261012095801`). **None of the following are in that snapshot.** They are source-only until founder-authorized apply.

Apply on a chosen **non-production** database first, in this order:

1. `20261012230000_architect_origin.sql`
2. `20261013160000_architect_construct.sql`
3. `20261013180000_architect_construct_worker_plane.sql`
4. `20261013183000_service_connections.sql`
5. `20261013193000_architect_construct_isolation.sql`
6. `20261013194500_connection_trusted_writes.sql`
7. `20261013203000_connection_broker_role.sql`
8. `20261013220000_architect_construct_lease_freshness.sql`
9. `20261013230000_architect_construct_finish_event.sql`

Talk #121 migrations (`20261013240000`, `20261013250000`) are not part of this PR.

Verify success: `npx supabase migration list` on that project shows the versions applied; a Construct enqueue against local Auth returns a durable run id.

## Worker

| Item | Value |
| --- | --- |
| Location | Founder workstation or an existing always-on box that already reaches the same Supabase. Not Vercel. Do not buy a host in this pass. |
| Commands | `npm run architect:worker` (one tick) or `npm run architect:worker:supervised` |
| Auth | `ARCHITECT_CONSTRUCT_WORKER_TOKEN` bearer, ≥32. Store uses the worker plane, not browser session. |
| Health | Tick prints JSON `{ ok, phase, run, status, isolation, sandbox, blocker, worker }`. Supervised logs `construct-worker: supervised start` and idle-sleeps 1.5s (backoff to 15s). |
| Shutdown | SIGINT/SIGTERM abort the loop, stop further claims, and print `supervised-shutdown`. Active cancel is fail-closed and teardown-confirmed. |
| Isolation | Docker outside Next handlers. `--network none`, nobody 65534, no docker.sock. |

## Evidence

- Host cancel uses `MemoryConstructStore`. Receipt field `not_durable_database: true`. `proof: confirmed` only after the named container is observed `RUNNING`, cancel is requested, teardown is confirmed, and terminal status is `cancelled`. `proof: unavailable` is unrun, not success.
- Durable enqueue/retry/worker/result/reload/owner isolation stays in `scripts/architect-construct-durable-smoke.mjs` (real Auth/PostgREST/SQL in Origin local-auth).
- CI uploads `docs/evidence/architect-construct/host-active-cancel-receipt.json` and `host-isolation-receipt.json` as `architect-construct-host-receipts`.
- A labelled fixture or mock proposal is not a model-generated self-build.

## READY preview

Existing Vercel preview for reviewed head `c1eaab9267314875abca432a0d5b333a0f839f29`:

https://gent-ascend-collective-ngxd22yvn-stutes-legacy.vercel.app

SHA confirmed from GitHub deployment `7051691470`. This is a READY preview, not a connected GitHub/Vercel account and not a Construct worker. No extra preview infrastructure was created.

## Can the new Architect interface be released now?

**Yes, as an honest interface**, if the founder authorizes production promotion of this branch **without** enabling Construct/Connections/AI flags and **without** applying hosted migrations.

What that gives: immersive Architect, Origin drafting/saving (only if Origin is already enabled on that environment; otherwise Origin stays labelled unavailable), Construct panel labelled “execution persistence is off”, Connections “setup required”, no fake progress, last successful Construct output retained when a later run is blocked.

What that does **not** give: a real isolated build, a Git pin, a publish, or a model-generated change.

A real change still needs the ordered founder checklist below.

## Ordered founder setup checklist

Do not paste credentials into chat. Enter secrets only in the named service.

1. **Choose the database.** Open the canonical Gent Supabase project used by `gent-ascend-collective-app`. Decide whether this first apply is a disposable local (`npx supabase start`) or a founder-approved non-production project. Production apply needs a separate explicit approval. Success: you can name the project ref. Unlocks: migration apply.
2. **Apply additive migrations in the order listed above.** Open Supabase SQL editor or `npx supabase db push` against that chosen project only. Success: `migration list` shows those versions. Unlocks: durable Origin/Construct/Connections tables.
3. **Enable Origin locally or on the chosen non-production env.** Setting: `ARCHITECT_ORIGIN_ENABLED=true`. Success: `/app/architect` saves a revision and reopens it. Unlocks: project persistence. Do not set this in production in this pass unless the interface-only release is separately approved.
4. **Enable Construct on the same env.** Setting: `ARCHITECT_CONSTRUCT_ENABLED=true`. Success: Construct panel no longer says persistence is off; enqueue returns a queued run. Unlocks: durable queue. The run will stay queued until the worker exists.
5. **Mint a worker token on the worker host, not in Vercel.** Setting name: `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (random, ≥32). Also `ARCHITECT_CONSTRUCT_WORKER_MODE=supervised`. Success: `npm run architect:worker:supervised` prints `supervised start` and does not exit 2. Unlocks: claim/execute.
6. **Install Docker on that same host.** Image `node:24-alpine`. Success: host isolation receipt `outcome: passed` and cancel receipt `proof: confirmed`. Unlocks: isolated execution. If Docker is absent, treat receipts as `unavailable`.
7. **Optional — Connections.** GitHub → Settings → Developer settings → GitHub Apps → New GitHub App. Callback/setup/webhook URLs from `NEXT_PUBLIC_APP_URL`. Read-only permissions listed above. Vercel → Integrations → Create native REST integration, read scopes only. Store the env **names** from `.env.example` in the intended local/preview environment. Success: Founder Connections shows Connected after you complete install + user association + selected repository; until then it must show Setup required. Unlocks: exact-commit pin reads. Does **not** unlock push or deploy.
8. **Optional — funded non-production proposal.** After steps 1–6 are proven, the founder authorizes a paid test. Then set `ARCHITECT_CONSTRUCT_AI_ENABLED=true` on that non-production env only. Success: a labelled real proposal appears and still requires explicit approval before enqueue. Unlocks: model-generated patch proposals, not a self-build claim.

### Actions that need secure entry or specific approval

- Hosted production migration apply.
- Production `ARCHITECT_*` flag changes.
- Creating the GitHub App / Vercel integration and storing secrets.
- Expanding any permission beyond read-only.
- `ARCHITECT_CONSTRUCT_AI_ENABLED=true`.
- Merge of #120 to `main` or production deploy.
- Talk #121 merge (separate owner).

## Release order and rollback

1. Keep Talk #121 on its branch.
2. Review this PR on the READY preview above.
3. Interface-only production (optional): merge with all Architect/Connections/AI flags false and migrations unapplied. Rollback: revert the merge; no schema rollback needed.
4. Non-production activation: apply migrations, enable Origin/Construct, run the worker beside Docker. Rollback: stop the worker, set flags false. Migrations are additive; do not drop them without a separate recovery plan.
5. Connections registration on the same non-production origin. Rollback: disconnect in Founder Connections; uninstall the GitHub App / Vercel integration in those dashboards.
6. Funded proposal test only after isolated fixture execution is proven. Rollback: `ARCHITECT_CONSTRUCT_AI_ENABLED=false`.
7. Do not enable publishing. There is no publish path to roll back.

Smoke after each step: save/reopen project; enqueue labelled fixture; worker claim; Plan/Changes/Checks/Preview show recorded data only; cancel while RUNNING yields `proof: confirmed`; Connections remain read-only.
