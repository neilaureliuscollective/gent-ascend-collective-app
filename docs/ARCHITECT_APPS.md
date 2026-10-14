# Architect generated applications

Dedicated `architect-apps` domain for one supported profile: React + TypeScript + Vite (`react-ts-vite` / `2026-10-14.1` / `vite-8.3.0+react-19.3.0+typescript-6.0.3`). This is not arbitrary generated servers, independent authentication, payments, unrestricted packages, or production publishing.

## What is implemented

- Generalized generation adapter. The labelled tracker fixture stays `demo=tracker`. Supported apps and revisions use the same production adapter with mocked or authorized OpenAI transport bound to the user brief, selected design, existing collection schemas, the host data-bridge contract, and exact source contents plus hashes. Paths and character counts are not a revision base.
- Durable owner-scoped store for apps, immutable source revisions, compiled artifacts, jobs, records and design-direction receipts. Writes go through SECURITY DEFINER RPCs. `person_id` is `persons.id`; authenticated identity is `persons.auth_user_id = auth.uid()`.
- Isolated Docker build adapter: pinned image, nobody `65534:65534`, `--network none`, no Docker socket or host secrets, versioned toolchain check, fenced results, active cancellation, and confirmed named-container teardown. The emitted `apps-runner.mjs` is an ES module and walks artifacts with `readdirSync`. Host-fixture compilation is labelled local evidence for the tracker fixture only and cannot mark a mock or model-generated app as isolated success.
- Worker entry supplies the durable Apps store. Optional supervisor hook is no longer the only wiring.
- Versioned `architect-apps-data/v1` bridge. Compact `v1.nonce.exp.mac` preview sessions require `ARCHITECT_APPS_PREVIEW_SECRET`, expire, and revoke on replacement. Ready or last-working revisions only. Parent→API payloads are allowlisted; iframe fields never overwrite owner, project or revision. Async bridge replies bind to the original document/session/generation and are dropped after replacement.
- Sealed Vite single-bundle contract (`assets/app.js`, `inlineDynamicImports`). Preview assembly inserts that IIFE by literal splice so `$&` / `$n` patterns survive. Extra JavaScript chunks are refused. Direct preview GET applies `Content-Security-Policy: sandbox allow-scripts allow-forms` without `allow-same-origin`. The iframe sandbox matches; `allow-forms` is required for native submit and does not grant parent storage.
- Each user mutation has a distinct stable request identity. Retries of that mutation reuse it. `record.id` is not an idempotency key.
- Workbench shows the selected saved revision, file contents, actual before/after changes, live job status, and keeps the last working preview when a later build fails.
- Talk `talk-architect-direction/v1` remains stable. Text-import compatibility is preserved. Talk board verification requires the documented adapter on the Talk workstream.

## Isolation

| Runner | When | Can mark isolated success |
| --- | --- | --- |
| Docker image `ARCHITECT_APPS_IMAGE` (`aethelios-architect-apps:2026-10-14.1`) | Normal and mock/OpenAI apps | Yes, only when `isolation=docker` and `sandbox=true` |
| Host-fixture TypeScript/Vite | Labelled `demo=tracker` with `ARCHITECT_APPS_ALLOW_HOST_FIXTURE=true` | No. `sandbox` stays false |

Generated project code does not execute in the credentialed host process for the production path. Model-controlled package scripts, build plugins and Dockerfiles stay prohibited.

## Talk contract

Architect owns `talk-architect-direction/v1` and the published shared contract `talk.architect.source.resolve` (`2026-10-14.1`). Talk registers `createTalkAuthorizedSourceAdapter` against immutable Talk server records. A client-computed content digest is not source authorization. Until Talk connects that adapter, only compatible `talk-architect-handoff/v1` text import can be retained and the dependency is reported as pending. Durable receipts stay. See [ARCHITECT_DESIGN_DIRECTION.md](ARCHITECT_DESIGN_DIRECTION.md).

## Flags

| Name | Default | Meaning |
| --- | --- | --- |
| `ARCHITECT_APPS_ENABLED` | false | Owner API and workbench |
| `ARCHITECT_APPS_FIXTURE` | false | Labelled tracker fixture |
| `ARCHITECT_APPS_AI_MOCK` | false | Labelled mocked provider (Field Notes) |
| `ARCHITECT_APPS_AI_ENABLED` | false | Authorized non-production OpenAI |
| `ARCHITECT_APPS_STORE` | unset | `memory` only for tests/non-production |
| `ARCHITECT_APPS_ALLOW_HOST_FIXTURE` | false | Permit host-fixture compilation for the labelled tracker only |
| `ARCHITECT_APPS_IMAGE` | `aethelios-architect-apps:2026-10-14.1` | Pinned isolated build image |
| `ARCHITECT_APPS_PREVIEW_SECRET` | required | Preview session HMAC. Fallback signing secrets are not permitted. |

Additive migrations `20261015080000_architect_apps.sql` and `20261015120000_architect_apps_durable.sql` are local-only until founder-approved hosted application.

## Evidence classes

- Deterministic mocked-provider generation is labelled `mock`, not a paid model call.
- Tracker fixture is labelled `fixture`.
- Simulated phone/Fold/desktop viewports are not physical-device acceptance.
- Intercepted browser HTML (`Working tracker`) is a UI fixture, not app execution or persistence acceptance.
- Funded OpenAI generation stays closed until founder-authorized.

## First founder action

Install Docker locally and load or build image `aethelios-architect-apps:2026-10-14.1`. Set `ARCHITECT_APPS_PREVIEW_SECRET`, apply both Apps migrations on the local Supabase instance, and enable Origin/Apps plus a local worker token. Leave `ARCHITECT_APPS_AI_ENABLED` false. That is the remaining blocker for isolated success of a non-fixture app.
