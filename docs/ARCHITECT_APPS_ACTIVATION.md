# Architect Apps activation package

Date: 2026-10-15. PR #130 continuation. This is a reviewable production path and a concrete activation decision. It is not authorization to merge, deploy, provision, apply hosted SQL, configure credentials, or make a paid model call.

## Exact head and compatibility

Previous verified green head was `507c27587199a5ae4e432401f6af8532301859de` (all six PR workflows passed). This continuation adds end-to-end founder execution, worker-readiness-before-spend, and a two-call `$1.00` reserved budget. Current `origin/main` at refresh: `804c877`. Merge-tree against that main was clean. Terminal Quality/Origin checks for the published head of this pass are the publish gate.

The founder-production capability is **off** until every name below is deliberately set. Default production remains production. Mock output cannot be presented as live AI generation.

## Intended capability

The founder uses the real OpenAI adapter inside the actual Aethelios Architect workbench: propose → approve → isolated compile → compiled preview → revise → reopen. Ordinary signed-in users receive an accurate not-enabled state.

| State | What happens |
| --- | --- |
| Disabled (default) | `appsAiReady` is false. Propose returns unavailable. Worker may compile already-approved revisions only after commissioned compile flags exist. |
| Enabled founder pilot | Production `APP_ENV` stays `production`. `ARCHITECT_APPS_FOUNDER_PILOT=true`, `ARCHITECT_APPS_AI_ENABLED=true`, server-only `OPENAI_API_KEY`, commissioned worker, and `currentFounderAccess()` (session + `founder_access` RLS) all pass. `defaultAppGenerationTransport` selects `openaiAppTransport`. |
| Denied mock-in-production | `ARCHITECT_APPS_AI_MOCK=true` in production is a refused configuration. Worker preflight/health fail. No mocked files are labelled as model output. |
| Ordinary account | Server-verified founder check fails on propose, approve, start, retries and revisions. HTTP 403 class `permission`. Ownership of a project is not founder entitlement. Browser flags and client-supplied founder IDs do nothing. Existing owned records and compiled previews remain readable by the owner. |

Identity is the existing person-bound `founder_access` row. Email, membership, user metadata, cookies, and client headers are not authorization.

## Required schema

Talk #131 head inspected `ae406d6` publishes this **18-name Talk/Architect package**:

1. `20261013240000_talk_creation.sql`
2. `20261013250000_talk_image_entitlement.sql`
3. `20261013260000_talk_creation_candidates.sql`
4. `20261014010000_talk_origin_import.sql`
5. `20261014020000_talk_origin_import_bind.sql`
6. `20261014030000_talk_origin_import_atomic.sql`
7. `20261014040000_talk_origin_import_consistency.sql`
8. `20261014100000_talk_design_board.sql`
9. `20261014120000_talk_live_bindings.sql`
10. `20261014130000_talk_direction_transfers.sql`
11. `20261014140000_talk_live_bind_authority.sql`
12. `20261015080000_architect_apps.sql`
13. `20261015120000_architect_apps_durable.sql`
14. `20261015140000_architect_apps_mutation.sql`
15. `20261015160000_architect_apps_retain_authority.sql`
16. `20261015170000_architect_apps_retain_provenance.sql`
17. `20261015180000_talk_live_trusted_observe.sql`
18. `20261015190000_talk_live_bind_intended_turn.sql`

Shared with #130 (apply once): `20261015080000`, `20261015120000`, `20261015140000`.

**Additional #130 dependencies** for the current worker / preview-session / schema-probe contracts:

| File | Why | Order |
| --- | --- | --- |
| `20261015155000_architect_apps_retain_verified.sql` | Interim retain contract on this branch | After `140000`, before `156000`. **Skip** if Talk `160000`/`170000` are applied in the same commissioning — Talk remains the merge-winning retain contract. |
| `20261015156000_architect_apps_preview_sessions.sql` | `architect_app_preview_sessions` plus `architect_apps_preview_issue` / `read` / `current` / `revoke`. Talk’s 18-name package does **not** include this. | After the shared Apps three (and after `155000` only when that file is used). |
| `20261015156500_architect_apps_pilot_budget.sql` | `architect_app_generation_runs`, `architect_app_worker_presence`, reserve/finish/presence/readiness RPCs, and the replaced schema probe. Talk’s 18-name package does **not** include this. | After `156000`, before Talk `160000`/`170000`. Unique forward file; do not replay Talk’s batch. |

Probe contracts that must exist after apply: tables `architect_apps`, `architect_app_revisions`, `architect_app_artifacts.revision_id`, `architect_app_jobs`, `architect_app_events`, `architect_app_records`, `architect_app_preview_sessions.nonce`, `architect_app_generation_runs.request_id`, `architect_app_worker_presence.worker_id`; RPCs `architect_apps_approve`, `_start`, `_claim`, `_heartbeat`, `_finish`, `_write_record`, `_timeout`, `_schema_probe`, `_preview_issue`, `_preview_read`, `_preview_current`, `_preview_revoke`, `_reserve_generation`, `_finish_generation`, `_report_worker_presence`, `_worker_readiness`.

This branch also carries Origin tool/repair files that are not on current main (`20261014080000`, `190000`, `203000`, `220000`, `224500`). They are not Apps worker contracts. Do not assume hosted Talk apply creates them.

Do not execute hosted SQL from this workstream. Shared names must be applied once.

## Environment names (no secret values)

Web plane (Vercel Production), generation only:

- `APP_ENV=production`
- `ARCHITECT_ORIGIN_ENABLED=true`
- `ARCHITECT_APPS_ENABLED=true`
- `ARCHITECT_APPS_FOUNDER_PILOT=true` (off until commissioned)
- `ARCHITECT_APPS_AI_ENABLED=true` (off until commissioned)
- `OPENAI_API_KEY` (server-only; existing OpenAI credit path)
- `AURELIUS_AI_MODEL` (optional; default `gpt-6-astra`)
- `ARCHITECT_APPS_PREVIEW_SECRET` (≥16)
- `ARCHITECT_APPS_PREVIEW_CLUSTER=true`
- Matching `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Leave `ARCHITECT_APPS_AI_MOCK` **unset**
- Leave `ARCHITECT_APPS_STORE` unset
- Leave `ARCHITECT_APPS_ALLOW_HOST_FIXTURE` unset

Worker host (not Vercel):

- `APP_ENV=production`
- `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned`
- `ARCHITECT_APPS_REQUIRE_ISOLATION=true`
- `ARCHITECT_APPS_IMAGE=aethelios-architect-apps:2026-10-15.1`
- `ARCHITECT_APPS_IMAGE_DIGEST` (`sha256:` + 64 hex from `docker image inspect`)
- `ARCHITECT_APPS_WORK_ROOT=/var/lib/architect-apps-work` (identical host/container path)
- `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32)
- `ARCHITECT_APPS_WORKER_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only on the worker)
- Matching public Supabase URL + publishable key
- No `VERCEL` / `VERCEL_ENV`
- Generation names may be present so readiness can verify policy; the worker does not call OpenAI

Readiness (`--preflight` / `--health`) must report isolation, schema classification, work-root ownership, digest match, **and** generation policy (`mode`, `permitted`, `founderPilot`, `generationReady`). A listening HTTP port or a successful `docker build` is not readiness.

## Hosting recommendation and cost

Official sources inspected 2026-10-15:

- DigitalOcean Droplet pricing: Basic 2 GiB / 1 vCPU / 50 GiB SSD / 2,000 GiB transfer, **$12.00/month** cap, **$0.01786/hour**. Per-second billing from 1 January 2026, minimum 60 seconds or $0.01. https://www.digitalocean.com/pricing/droplets
- Docker 1-Click Marketplace image: Ubuntu 22.04 with docker-engine and docker-compose. The 1-Click adds **no extra app fee**; you pay the Droplet. https://docs.digitalocean.com/products/marketplace/catalog/docker/ (catalog page generated 17 August 2026)

| Item | Ongoing | Uncertainty |
| --- | --- | --- |
| Docker Droplet Basic 2 GiB / 1 vCPU | **$12/month** (or hourly until destroyed) | Region/tax. 1 GiB / $6 is below the 1024m compile tmpfs and is not recommended. |
| Docker 1-Click software | $0 | Image slug/version may change; pin by inspecting `docker version` after create. |
| Optional Droplet backups / snapshots | Confirm current percentage in the control panel before enabling | Not required for this package. |
| Outbound transfer over 2,000 GiB | Overage at DigitalOcean’s published rate | Unlikely for founder-only compiles. |
| Existing Vercel Production | Already paid/used by the web app | Merge to `main` typically auto-deploys this web plane. |
| Existing Supabase project | Already paid/used | Hosted Apps SQL is a separate approval. |
| OpenAI | Usage only; see acceptance case | Model list price can change. Default config is `gpt-6-astra`. |

No account, Droplet, or purchase is created here. A founder laptop is not the host.

## Credentials and permissions the owner must configure

Through DigitalOcean’s own login / billing (not this agent):

- Droplet create from the Docker 1-Click image, SSH key, firewall (SSH + no public worker port; health binds `127.0.0.1` only).

Through Vercel / existing secret store (not this agent):

- Apps flags and preview secret on Production.
- Founder-pilot names only after worker preflight is green.

Through OpenAI’s own dashboard (not this agent):

- Confirm the existing server-only `OPENAI_API_KEY` and credit. Do not paste the value into chat or Git.

Through Supabase (not this agent):

- Founder-approved SQL apply of the ordered files.
- Confirm the physical tables/RPCs, not only migration history.
- Worker uses the service-role key; owner APIs stay session + RLS.

`founder_access` must already exist for the founder person. Do not invent a browser grant.

## Ordered commissioning

Do not merge `main` until the founder separately approves the automatic Vercel Production deploy that merge causes.

1. **Schema.** Apply shared Apps `080000` / `120000` / `140000` once (skip if Talk already applied those exact names). Apply `156000` then `156500` from this branch. Apply `155000` only when Talk retain `160000`/`170000` will not be applied. Apply Talk’s remaining files on the Talk release, not twice. Do not replay the original 18-name batch.
2. **Worker host.** Create the $12 Docker Droplet. Install nothing extra if `docker version` already works. Clone this SHA. `node scripts/architect-apps-prepare-runtime.mjs`.
3. **Proofs.** `--prove-write`, `--prove-compile`, `--prove-topology`. Then `--preflight` must be `ok` / `idle` with work-root `ready` and generation `permitted`.
4. **Denied proof.** A disposable local env with production + `ARCHITECT_APPS_AI_MOCK=true` must report generation `refused` and fail health. Do not use that env for hosting.
5. **Supervise.** Start the packaged worker. Jobs stay `queued` if it stops; the UI must not invent a preview.
6. **Web flags.** Set Origin/Apps + preview cluster on Vercel. Generation names stay **off**.
7. **Compile acceptance.** One labelled Field Notes isolated compile (mock or fixture on a local/CI host, or an already-approved revision). Not a paid model call.
8. **Founder-pilot enable.** Separate approval: set `ARCHITECT_APPS_FOUNDER_PILOT` and `ARCHITECT_APPS_AI_ENABLED` with the existing server-only key. Confirm an ordinary account still sees not-enabled.
9. **Bounded real-model case.** Only after step 8 and a separate spend approval.

## Bounded real-model acceptance case (not executed)

Selected model: configured default `AURELIUS_AI_MODEL=gpt-6-astra` (not GPT-5.5). Official standard short-context list price inspected 2026-10-15 from https://developers.openai.com/api/docs/pricing: **$10.00 / 1M input** and **$50.00 / 1M output** for ≤272K input tokens. Long-context (>272K) is $20 / $75 and is refused by the 16k input ceiling.

Server-side acceptance allowance (atomic, person+run): 2 calls, 16k input / 4k output per call, **$1.00 reserved cap**. Two ceiling reservations cost $0.72 list ($0.16 input + $0.20 output each). Per-call `maxRetries=0`, `maxOutputTokens=4000`, 30s generation timeout, 90s compile timeout remain. Concurrent requests and retries reuse the same `requestId` without a second provider call.

1. Sign in as the founder on production Aethelios. An ordinary owner of the same project must still receive not-enabled on propose/approve/start.
2. Confirm worker readiness (`architect_apps_worker_readiness`) is recent, digest-matched, isolated, and schema/queue/artifact capable. Do not send a paid propose if it is missing or stale.
3. Create a small Field Notes app from a short brief (create).
4. Accept, start, wait for isolated compile and compiled preview.
5. Revise with “Add an optional tag.”
6. Accept, compile, confirm last-good retention if the revise compile fails.
7. Reopen the last working revision.

**Proposed maximum spend: $1.00 USD** for those two `gpt-6-astra` calls. This is the server reserved cap, not an OpenAI dashboard alert. OpenAI spend alerts notify only and do not stop traffic. Organization/project hard spend limits can slightly overshoot while the limit state propagates (https://developers.openai.com/api/docs/guides/spend-limits). If the provider omits usage, the receipt keeps the reserved ceiling. If either call errors, stop; do not re-run without a new approval. A single preflight cannot keep the worker available after admission; a later worker failure must fail the job without a second model call or a false compile success.

Implemented readiness (code + local tests) is not commissioned infrastructure. No worker host, hosted SQL, or production flags exist until the approvals below.

## Recovery and rollback

1. Unset `ARCHITECT_APPS_FOUNDER_PILOT` and `ARCHITECT_APPS_AI_ENABLED` on Vercel. Generation stops immediately. Existing revisions remain.
2. Set `ARCHITECT_APPS_ENABLED=false` if the workbench must disappear.
3. Stop the worker process or power off the Droplet. Queued jobs stay queued.
4. Leave tables in place. Do not drop owner records.
5. Revert `ARCHITECT_APPS_IMAGE_DIGEST` only after a newer digest has failed isolation proofs.
6. Revert the Vercel Production deployment to the last main SHA if a merge was the mistake.

## Exact approvals still required

| Action | Status |
| --- | --- |
| Merge PR #130 to `main` (auto-deploys Vercel Production) | Not approved |
| Hosted SQL apply | Not approved |
| Create DigitalOcean account / Droplet / SSH | Not approved |
| Write `OPENAI_API_KEY`, worker token, or service-role key onto a host | Not approved |
| Set `ARCHITECT_APPS_FOUNDER_PILOT` or `ARCHITECT_APPS_AI_ENABLED` in production | Not approved |
| Paid OpenAI acceptance case (max $1.00, gpt-6-astra short-context) | Not approved |
| Talk #131 merge / Talk SQL | Separate Talk release |

This workstream may only publish code and documentation to the review branch.
