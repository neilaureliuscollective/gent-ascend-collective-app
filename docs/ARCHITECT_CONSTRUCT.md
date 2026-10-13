# Aethelios Architect — Construct execution foundation

Date: 2026-10-13. Working branch `cursor/architect-construct-pipeline-165a` on canonical `neilaureliuscollective/gent-ascend-collective-app`. Base: `810966302c2074df98eedf06edae6a6d8a030020` (merged PR #115). No hosted migration, production merge, billing change, credential configuration, or paid OpenAI/runtime call is authorized.

## Verified initial state

- Working tree was clean on `main` at the PR #115 merge.
- Architect Origin remains planning-only: `architect_origin_runs` store exploration/proposal receipts. The Origin service does not execute software changes.
- Recovery identifiers `928f74a6e327a21fdeb1df9b0182060d8eb579f8` and `aa7ff09` are **not present** in this checkout or reachable remotes. No recovery files were supplied. This implementation does not claim to import that work and does not recreate the separate first-site editor.
- Older PRs #82/#83 and #65–74/#80 were inspected only as overlap notes; they were not merged. Static HTML generation is not treated as a general application runner.

## What this slice implements

One narrow pipeline inside existing `/app/architect`:

`request → approved source-pinned brief → isolated worker execution → actual diff → actual checks → preview/result → durable review`

1. **Source and brief.** Every run binds the authenticated owner, existing Origin project, immutable project revision, repository name, exact source commit when provided, allowed paths, protected paths, intended change, acceptance checks, and resource limits. Source kinds are labelled `fixture`, `imported`, or `git`. A git pin without files is a blocker. Changing the project revision or source tree invalidates prior approval.
2. **Durable runs.** Owner-scoped start/read/cancel, append-only events, request-id idempotency, atomic worker claim, lease recovery, timeout, and cancellation. Duplicate clicks reuse the same request. Uncertain runs are not replayed. Clients cannot write results, expand allowlists, or mark a release complete.
3. **Execution adapter.** Trusted patch/check/diff/preview engine plus a disposable Docker invocation (`--network none`, no docker.sock, no host secrets, no privileged flags). Long-running work is outside user Next handlers (`npm run architect:worker` compiles `worker-entry.ts` and `/api/internal/architect-construct` stays closed). An authenticated `kind=fixture` label cannot select host execution. In-process fixture playback is a test-only trusted source that database/API callers cannot choose.
4. **OpenAI adapter.** Server-only Responses/`generateText` proposal path, default-off. It can propose a bounded patch only. It cannot execute, start a run, or retry paid calls. A funded OpenAI account does not supply a sandbox, worker, or repository connection.
5. **Existing Architect UI.** New Construct surface with Plan / Changes / Checks / Preview. Drafts, history, Talk, Studio, and Origin save behavior are unchanged.

## Runtime dependencies (names only)

| Name | Role |
| --- | --- |
| `ARCHITECT_ORIGIN_ENABLED` | Existing Origin persistence gate. |
| `ARCHITECT_CONSTRUCT_ENABLED` | Construct user API/UI gate. Default `false`. |
| `ARCHITECT_CONSTRUCT_AI_ENABLED` | Model proposal gate. Default `false`. Production mode refuses it. |
| `OPENAI_API_KEY` | Existing server-only OpenAI credential. Not used in this run. |
| `AURELIUS_AI_MODEL` | Existing configured Responses model. |
| `ARCHITECT_CONSTRUCT_WORKER_TOKEN` | Server-only worker bearer, ≥32 characters. |
| `ARCHITECT_CONSTRUCT_WORKER_ID` | Worker lease identity. |
| `ARCHITECT_CONSTRUCT_IMAGE` | Disposable image name. Default `node:24-alpine`. |
| Additive migration `20261013160000_architect_construct.sql` | Durable SQL contracts. Unapplied on hosted projects. |
| Additive migration `20261013193000_architect_construct_isolation.sql` | Rejects owner-chosen fixture imports and adds per-claim lease tokens. Unapplied on hosted projects. |

`sandbox: true` is recorded only after a disposable container starts and returns a verified result whose displayed diff and hashes come from observed output bytes. A successful Docker version probe, or an image being present, is `runtime_available` only. The labelled process fixture stays `isolation: process-fixture`, `runtime_available: false`, `sandbox: false`, and is not available on the durable worker path. Worker claims use a unique process identity and per-claim lease token, renewed for the whole job. Stale workers cannot finish or write artifacts.

Writable `/work`, `/tmp` and `/out` are tmpfs mounts owned by nobody (`uid=65534,gid=65534`). The container does not run as root. CI on `94343b2` reached this path and failed with `EACCES` copying `/src/README.md` → `/work/README.md` because the tmpfs had no explicit nobody ownership.

Unit tests inject the probe and container launcher. They do not read the host PATH or installed Docker. The host integration check in `tests/architect-construct-host.test.ts` inspects the real machine and records `passed`, `failed`, or `unavailable`.

## First model-generated candidate

**Find and resume Architect projects** remains the first genuinely model-generated Aethelios feature candidate. Its solution was not prewritten. Fixture playback is execution-mechanics evidence only.

## Recovery and next activation

1. Apply the additive Construct migration only on a founder-approved local/preview database.
2. Set `ARCHITECT_CONSTRUCT_ENABLED=true` locally with Origin already enabled.
3. Add `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32) and run `npm run architect:worker` against the local app.
4. Queue the labelled fixture from Construct and reload Plan/Changes/Checks/Preview.
5. Install Docker only if isolated non-fixture execution is required; do not mount the host docker socket or application secrets.
6. Run `npm run architect:worker` as a process separate from Next. User routes enqueue/read/cancel only. The worker claims the durable queue with the server-only service role; that credential never enters the sandbox.
7. Do not enable `ARCHITECT_CONSTRUCT_AI_ENABLED` or call OpenAI until funded testing is explicitly authorized.

## Source connection interface (Connections chat)

This PR does not add GitHub/Vercel OAuth, connection UI, or repository publishing. A later Connections-owned slice should supply:

- repository identity (`owner/name`)
- exact commit SHA
- imported file tree matching that pin
- owner-scoped credential storage that never reaches generated code or the disposable container

Until that exists, Construct only runs labelled fixture/imported snapshots already attached to the brief.

Architect cannot build Aethelios until a real model-generated change completes isolated execution, verification, and preview.

## Verification in this run

Ran:

```sh
npm run lint
npx --no-install tsc --noEmit
npm test
npm run db:ledger
npm run build
npx --no-install next build --webpack
npx --no-install playwright test --config playwright.origin.config.ts --grep "Construct plan|complete synthetic journey|Blueprint selection"
```

Results:

- Lint: pass, zero warnings.
- Typecheck: pass.
- Unit/SQL: 794+ across 135 files, including durable owner/worker-plane persistence. PGlite SQL is not real Supabase Auth.
- Migration ledger: pass. New `20261013160000_architect_construct.sql` is source-only and **not** in the hosted applied snapshot.
- Normal `npm run build` and `next build --webpack`: pass.
- Origin + Construct browser fixture: 3 passed. Not physical Fold/Safari, not disposable local Auth.

Unrun / blocked after the CI correction:

- Real disposable local Supabase Auth/PostgREST Construct acceptance in this executor (script `scripts/architect-construct-auth-smoke.mjs` is wired into the Origin local-auth job).
- Host Docker in this executor. Isolated container execution remains `unavailable` here until an engine and `node:24-alpine` are present.
- Paid OpenAI/runtime calls. Adapter remains disabled.
- Hosted migration, production enablement, physical device review.

Fixture receipt: `docs/evidence/architect-construct/fixture-receipt.json`. Screenshots: `docs/evidence/architect-construct/architect-construct-plan.png` and siblings.
