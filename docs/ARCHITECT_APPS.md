# Architect generated applications

Dedicated `architect-apps` domain for one supported profile: React + TypeScript + Vite (`react-ts-vite` / `2026-10-14.1` / `vite-8.3.0+react-19.3.0+typescript-6.0.3`). This is not arbitrary generated servers, independent authentication, payments, unrestricted packages, or production publishing.

## What is implemented

- Generalized generation adapter. The labelled tracker fixture stays `demo=tracker`. Supported apps and revisions use the same production adapter with mocked or authorized OpenAI transport bound to the user brief, selected design, existing collection schemas, the host data-bridge contract, and exact source contents plus hashes. Paths and character counts are not a revision base.
- Durable owner-scoped store for apps, immutable source revisions, compiled artifacts, jobs, records and design-direction receipts. Writes go through SECURITY DEFINER RPCs. `person_id` is `persons.id`; authenticated identity is `persons.auth_user_id = auth.uid()`.
- Isolated Docker build adapter: pinned image, nobody `65534:65534`, `--network none`, no Docker socket or host secrets, versioned toolchain check, fenced results, active cancellation, and confirmed named-container teardown. The emitted `apps-runner.mjs` is an ES module and walks artifacts with `readdirSync`. Host-fixture compilation is labelled local evidence for the tracker fixture only and cannot mark a mock or model-generated app as isolated success.
- Dedicated Apps worker (`npm run architect:apps-worker`) is separate from the Vercel web application. Local ticks still reuse the Construct worker entry. Production compilation stays closed unless `ARCHITECT_APPS_DEPLOYMENT_MODE=commissioned` on a non-Vercel host. See [ARCHITECT_APPS_CLOUD_WORKER.md](ARCHITECT_APPS_CLOUD_WORKER.md).
- Versioned `architect-apps-data/v1` bridge. Compact `v1.nonce.exp.mac` preview sessions require `ARCHITECT_APPS_PREVIEW_SECRET`, expire, and revoke on replacement. Ready or last-working revisions only. Parent→API payloads are allowlisted; iframe fields never overwrite owner, project or revision. Async bridge replies bind to the original document/session/generation and are dropped after replacement.
- Sealed Vite single-bundle contract (`assets/app.js`, `inlineDynamicImports`). Preview assembly inserts that IIFE by literal splice so `$&` / `$n` patterns survive. Extra JavaScript chunks are refused. Direct preview GET applies `Content-Security-Policy: sandbox allow-scripts allow-forms` without `allow-same-origin`. The iframe sandbox matches; `allow-forms` is required for native submit and does not grant parent storage.
- Each user mutation has a distinct stable request identity bound to an immutable payload snapshot. Retries reuse that identity only for the same payload after an uncertain result. A changed payload with the same key is rejected. Concurrent edits use integer `version`. `record.id` is not an idempotency key.
- Generation context includes the complete `architect-apps-data/v1` request/response/replay/error contract, session bootstrap, CRUD examples, and approved direction colors/typography/layout/assets plus an explicit unsupported list.
- Workbench shows the selected saved revision, file contents, actual before/after changes, host collections in use, and truthful stages derived from jobs/events/save acknowledgments. The last working preview stays when a later build fails.
- Required isolated path: `deploy/architect-apps/Dockerfile` plus `scripts/architect-apps-image.mjs`. `.github/workflows/quality.yml` `apps-isolate` builds the pinned image and runs isolated compile, failure cleanup and cancellation. Host-fixture remains labelled and cannot mark a mock app isolated.
- Talk `talk-architect-direction/v1` remains stable. Text-import compatibility is preserved. Talk board verification requires the documented adapter on the Talk workstream.

## Isolation

| Runner | When | Can mark isolated success |
| --- | --- | --- |
| Docker image `ARCHITECT_APPS_IMAGE` (`aethelios-architect-apps:2026-10-15.1`) | Normal and mock/OpenAI apps | Yes, only when `isolation=docker` and `sandbox=true` |
| Host-fixture TypeScript/Vite | Labelled `demo=tracker` with `ARCHITECT_APPS_ALLOW_HOST_FIXTURE=true` | No. `sandbox` stays false |

Generated project code does not execute in the credentialed host process for the production path. Model-controlled package scripts, build plugins and Dockerfiles stay prohibited.

## Talk contract

Architect owns `talk-architect-direction/v1` and the published shared contract `talk.architect.source.resolve` (`2026-10-14.1`). Talk registers `createTalkAuthorizedSourceAdapter` against immutable Talk server records. A client-computed content digest is not source authorization. Talk #131 latest inspected head `ddfd497` (retain candidate `f3573856002d16ac69341eb99f91e32deff76f64`) implements that registration and derived-board verification on the Talk checkout (`src/domains/talk-creation/architect-source.ts`, `20261015160000_architect_apps_retain_authority.sql`, `20261015170000_architect_apps_retain_provenance.sql`). This Architect branch does not copy those files and still reports the adapter as pending. Durable receipts stay. `architect_apps_retain_design` keeps the Talk-compatible six-argument signature; browser callers cannot self-assert `p_verified` or `p_source_kind`. This checkout stores text-import as integrity-only (`verified=false`) and treats caller `talk-authorized` as `pending`. Talk's later migrations win on merge. See [ARCHITECT_DESIGN_DIRECTION.md](ARCHITECT_DESIGN_DIRECTION.md).

## Flags

| Name | Default | Meaning |
| --- | --- | --- |
| `ARCHITECT_APPS_ENABLED` | false | Owner API and workbench |
| `ARCHITECT_APPS_FIXTURE` | false | Labelled tracker fixture |
| `ARCHITECT_APPS_AI_MOCK` | false | Labelled mocked provider (Field Notes) |
| `ARCHITECT_APPS_AI_ENABLED` | false | Authorized non-production OpenAI |
| `ARCHITECT_APPS_STORE` | unset | `memory` only for tests/non-production |
| `ARCHITECT_APPS_ALLOW_HOST_FIXTURE` | false | Permit host-fixture compilation for the labelled tracker only |
| `ARCHITECT_APPS_IMAGE` | `aethelios-architect-apps:2026-10-15.1` | Pinned isolated build image |
| `ARCHITECT_APPS_PREVIEW_SECRET` | required | Preview session HMAC. Fallback signing secrets are not permitted. |
| `ARCHITECT_APPS_DEPLOYMENT_MODE` | inferred | `local` / `preview` / `commissioned` / `closed`. Production infers `closed` unless commissioned. |
| `ARCHITECT_APPS_REQUIRE_ISOLATION` | false | Required true for commissioned compiles |
| `ARCHITECT_APPS_IMAGE_DIGEST` | unset | `sha256:` pin; must match `docker image inspect` |
| `ARCHITECT_APPS_PREVIEW_CLUSTER` | false | Accept unexpired HMAC after process restart on production/preview web planes |

Additive migrations `20261015080000_architect_apps.sql`, `20261015120000_architect_apps_durable.sql`, `20261015140000_architect_apps_mutation.sql` and `20261015155000_architect_apps_retain_verified.sql` are local-only until founder-approved hosted application. The 15155000 prefix stays before Talk #131 `f357385` retain/provenance files so those later migrations remain the merge-winning contract.

## Evidence classes

- Deterministic mocked-provider generation is labelled `mock`, not a paid model call.
- Tracker fixture is labelled `fixture`.
- Simulated phone/Fold/desktop viewports are not physical-device acceptance.
- Intercepted browser HTML (`Working tracker`) is a UI fixture, not app execution or persistence acceptance.
- Funded OpenAI generation stays closed until founder-authorized.

## First founder action

A founder phone/laptop does not need Docker. Architect CI already builds the pinned toolchain image and can build the worker image. Persistent production compilation still needs a commissioned non-Vercel host (recommended DigitalOcean Docker Droplet, $12/mo) plus founder-approved hosted Apps migrations. OpenAI credit alone does not provide the worker, database, permissions or isolated image. See [ARCHITECT_APPS_CLOUD_WORKER.md](ARCHITECT_APPS_CLOUD_WORKER.md).
