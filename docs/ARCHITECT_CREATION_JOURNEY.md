# Architect creation journey — integration

Date: 2026-10-13. Branch `cursor/architect-creation-journey-165a`. Base: current `main` `9dda52549dac548b59b3e3175f2ee832cb4ed471` (PR #118 Live founder voice). This is functional integration of three source workstreams. No production merge, hosted migration, credential configuration, paid OpenAI call, or service provisioning.

## Incorporated source heads

| Workstream | PR | Branch | Exact head |
| --- | --- | --- | --- |
| Architect Construct | #116 | `cursor/architect-construct-pipeline-165a` | `ef3741e81fe7ef931cdc1054f7ffc49d86c6dfca` |
| Connections | #117 | `cursor/aethelios-connections-8d20` | `c5581234b6badf2d8dcf0b9ed21fb91256897b5f` |
| Architect immersive UI | #119 | `cursor/architect-immersive-studio-5865` | `7e0cf2c4534a3f8d88e337b22af8f127c0301a5b` |
| main at refresh | #118 | `main` | `9dda52549dac548b59b3e3175f2ee832cb4ed471` |
| Integration follow-up on this PR | #120 | `cursor/architect-creation-journey-165a` | `456eaadadc3a6cc323c8c27b868ae1f35ee438db` (atomic finish event, propose→approve→start, keyed panel, named Docker cancel). Source branches above were not rewritten. |

Those source branches were not rewritten. Shared overlap (docs, `.env.example`, `package.json`, `database.ts`, `tests/component-fixture/entry.tsx`, Architect workspace/spec) was combined, not blindly overwritten.

## What this integration adds

1. **Workbench adapters.** Client `construct-lifecycle.ts` talks to existing Construct propose/approve-change/enqueue/read/cancel. Authorized imported or pinned-git snapshots plus the project brief enter the proposal flow; the approved change is shown and then started through `startConstructRun`. Labelled fixtures stay a separate control. Server `connections-source.ts` talks only to Connections’ owner-scoped selected-repository and pinned-source reads. Connections remains read-only. No commit, publish, or deploy path was added.
2. **Truthful run lifecycle.** The workbench polls durable receipts. Queued, claimed, running, canceled, failed, and completed are shown from recorded status/events. Duplicate start reuses the request id. The Construct panel is keyed and reset by owner and project, late polls are aborted or ignored, and each enqueue uses a fresh idempotency key. Draft Origin input stays on the selected project. Last successful Construct output is held only for the same owner and project, labelled with its revision. Active cancellation and supervisor shutdown terminate that named isolated Docker job instead of waiting for a command timeout.
3. **Supervised external worker.** `ARCHITECT_CONSTRUCT_WORKER_MODE=supervised` or `npm run architect:worker:supervised` loops claim/execute with idle sleep, backoff, SIGINT/SIGTERM shutdown, cancellation, and recovery. Docker stays outside Vercel handlers. One-tick mode remains the default CI command.
4. **Tighter leases.** An expired claim cannot heartbeat, mark running, append, or finish merely because no replacement has arrived. Claim-token fencing is unchanged. A second finish after a successful terminal write is idempotent even though the lease was cleared; it cannot change the recorded status or add another finished event. Additive `20261013220000_architect_construct_lease_freshness.sql` is source-only and unapplied on hosted projects. `20261013230000_architect_construct_finish_event.sql` persists the terminal event in the same fenced finish transaction before `lease_until` is cleared.
5. **Provenance.** Owner/project/artifact/revision, pinned source hash, observed result hash, checks, and isolation receipts must all be present. Missing IDs never match. Process-fixture output is labelled test output and is not an isolated AI build. Running-server preview is not offered; no supported isolated application runtime exists. Demonstration HTML stays named demonstration.
6. **Gated proposal path.** Existing OpenAI adapter stays default-off and production-banned. `ARCHITECT_CONSTRUCT_AI_MOCK=true` enables a labelled Before→After mock in non-production only. That mock is not a paid call and not a model-generated self-build.

## Supported capabilities now

- Select an Origin project, describe a bounded fixture change, enqueue, poll, cancel, inspect recorded checks/diff/preview, leave and resume the same project.
- Read Connections selected repository / pinned file when the founder Connections apps are configured. Without them, Construct still runs labelled imported/fixture snapshots.
- Isolated Docker execution through the compiled worker against disposable local SQL.
- Labelled mocked proposals in development.

## Not supported

- Commit, branch publish, Vercel deploy, or running-server preview.
- Paid OpenAI proposals or a claim that Aethelios built itself.
- Hosted Construct/Connections migrations.
- Docker inside Next/Vercel request handlers.

## External worker deployment plan (do not provision here)

Use existing local/loopback infrastructure only.

1. Local Supabase already used by Origin (`127.0.0.1`). Additive Construct migrations stay unapplied on hosted projects until founder approval.
2. Run the compiled worker as a separate long-lived process on the founder workstation or a loopback VM:
   `ARCHITECT_CONSTRUCT_ENABLED=true ARCHITECT_ORIGIN_ENABLED=true ARCHITECT_CONSTRUCT_WORKER_MODE=supervised ARCHITECT_CONSTRUCT_WORKER_TOKEN=<32+> npm run architect:worker:supervised`
3. Docker Engine on that same machine, image `node:24-alpine`, `--network none`, nobody 65534. Do not mount the host docker socket or app secrets.
4. Do not place the worker on Vercel. `/api/internal/architect-construct` stays closed in production.
5. If a later founder-approved host is needed, reuse an existing always-on box that already reaches loopback Supabase. Do not buy a new service in this phase.

## Founder-pilot model policy (activation only)

Production bans stay. A later authorized test would need all of:

- Non-production `APP_ENV`
- `ARCHITECT_CONSTRUCT_ENABLED=true`
- `ARCHITECT_CONSTRUCT_AI_ENABLED=true`
- Existing server-only `OPENAI_API_KEY` and `AURELIUS_AI_MODEL`
- Explicit funded-test authorization
- Isolated worker + Docker already proven on the same project

Until that checklist is completed, development uses `ARCHITECT_CONSTRUCT_AI_MOCK` or no proposal at all.

## Remaining founder setup (grouped)

Do not do these in this phase. One checklist after independent work:

1. Approve and apply additive Construct (`20261013160000`, `20261013180000`, `20261013193000`, `20261013220000`, `20261013230000`) and Connections (`20261013183000`, `20261013194500`, `20261013203000`) migrations on a chosen non-production database.
2. Register GitHub App + Vercel integration credentials and `CONNECTIONS_CREDENTIAL_KEY` if live selected-repository reads are wanted. Keep them server-only.
3. Set `ARCHITECT_CONSTRUCT_WORKER_TOKEN` locally and run the supervised worker beside Docker.
4. Authorize a funded non-production OpenAI proposal test before enabling `ARCHITECT_CONSTRUCT_AI_ENABLED`. Do not treat the labelled mock as that test.
5. Do not merge to main, deploy production, or change hosted billing/live configuration.

## Evidence

- Isolated durable journey: `scripts/architect-construct-durable-smoke.mjs` (enqueue, compiled worker, Docker, cancel, reload, cross-project isolation).
- Layouts: existing Origin/UI suites plus integrated Construct workbench coverage at 320/390/720/1440 and keyboard-height 344×430.
- Workbench screenshots: `docs/evidence/architect-construct/architect-creation-journey-1440.png`, `architect-creation-journey-keyboard.png`, and the Construct Plan/Changes/Checks/Preview receipts.
- Provider-mocked evidence stays in unit tests (`ARCHITECT_CONSTRUCT_AI_MOCK`). Isolated Docker evidence stays in host/durable smoke. They are not interchangeable.
