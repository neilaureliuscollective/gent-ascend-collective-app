# Architect generated applications

Dedicated `architect-apps` domain for one supported profile: React + TypeScript + Vite (`react-ts-vite` / `2026-10-14.1` / `vite-8.3.0+react-19.3.0+typescript-6.0.3`). This is not arbitrary generated servers, independent authentication, payments, unrestricted packages, or production publishing.

## What is implemented

- Immutable source-tree snapshots and app revisions, separate from Origin documents and Construct receipt JSON.
- Explicit create/update/delete only under `src/`, bound to exact base hashes. Package, lock, Vite, TypeScript and runner files stay sealed.
- Approved dependency catalog only. Model-defined package scripts, Dockerfiles and plugins are never executed.
- App-generation and revision contracts returning files, declared collections and intended behaviors.
- Trusted typecheck (`tsc --noEmit`) and Vite production bundle through a versioned host/image adapter.
- Private compiled preview (inlined bundle, `sandbox="allow-scripts"` without `allow-same-origin`, restrictive CSP, service workers disabled).
- Host-managed collections over a versioned postMessage bridge. Generated code receives no platform credential.
- Additive schema evolution only. Records belong to the app and survive preview sessions.
- App workbench: working canvas, desktop/phone viewports, files/changes/records/revisions, adjacent Refine, recovered approve → explicit start → lost response → retry.

## Talk contract

Architect owns `talk-architect-direction/v1`. Module: `src/domains/architect-design-direction/contract.ts`. Receiver: `src/domains/architect-design-direction/receiver.ts`. Path: `POST /api/architect-design-direction`. Talk must not treat a client hash as authority. Retry creates exactly one private project. Execution never starts on import. See [ARCHITECT_DESIGN_DIRECTION.md](ARCHITECT_DESIGN_DIRECTION.md).

## Host requirement

Isolated builds need image `ARCHITECT_APPS_IMAGE` (default `aethelios-architect-apps:2026-10-14.1`) with pinned React/TypeScript/Vite preinstalled, no Docker socket, no inherited secrets, measured CPU/memory/disk/process/time/network limits. This checkout uses a trusted in-process toolchain adapter when those binaries are already installed for the platform. That adapter is development evidence, not an isolated production sandbox.

## Flags

| Name | Default | Meaning |
| --- | --- | --- |
| `ARCHITECT_APPS_ENABLED` | false | Owner API and workbench |
| `ARCHITECT_APPS_FIXTURE` | false | Labelled tracker fixture |
| `ARCHITECT_APPS_AI_MOCK` | false | Labelled mocked provider |
| `ARCHITECT_APPS_AI_ENABLED` | false | Authorized non-production OpenAI |
| `ARCHITECT_APPS_STORE` | unset | `memory` only for tests/non-production |

Additive migration `20261015080000_architect_apps.sql` is local-only until founder-approved hosted application.

## First founder action for a real non-production generated journey

Inspected settings: Origin, Construct and Apps flags default to false; no `.env.local` Apps enablement; OpenAI app generation remains unauthorized; hosted Apps migrations are unapplied; this host has no isolated build image. The first founder action is: apply `20261015080000_architect_apps.sql` on the local Supabase instance and set `ARCHITECT_ORIGIN_ENABLED=true` plus `ARCHITECT_APPS_ENABLED=true` and `ARCHITECT_APPS_FIXTURE=true` in local env. Leave `ARCHITECT_APPS_AI_ENABLED` false. That is a labelled fixture journey, not a paid model call.
