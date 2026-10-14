# Architect Apps journey receipts — PR #130

Deterministic local evidence. Not physical-device acceptance and not a funded OpenAI call.

## Verified on this head

| Check | Result |
| --- | --- |
| Production adapter receives exact source contents, hashes, collections, bridge, brief and design | Pass |
| Additive tag revision binds exact base hashes and preserves untouched `src/calc.ts` | Pass |
| Tracker remains labelled `fixture` | Pass |
| Compact `v1.nonce.exp.mac` preview session ≤ 96 characters; replacement revokes the prior session | Pass |
| Fallback preview signing secret refused | Pass |
| Allowlisted data payload ignores forged project/revision/action | Pass |
| Isolated Docker invocation: nobody 65534, network none, no socket/secrets | Pass |
| Emitted `apps-runner.mjs` is ESM (`readdirSync`, no `require`) and walks real artifacts | Pass |
| Named-container `docker rm -f` plus inspect confirmation | Pass |
| Host-fixture cannot mark mock generation isolated | Pass |
| PGlite create → edit → retry with distinct mutation identities | Pass |
| Memory and SQL owner/app/collection isolation | Pass |
| Compiled Field Notes host-fixture bundle satisfies `assets/app.js` single-bundle contract | Pass when toolchain present |
| Preview assembly preserves compiled `$&` replacement patterns | Pass |
| Compiled create → edit → retry → reload against durable records; failed later build keeps last good app | Pass when toolchain present |
| Sandboxed iframe mounts Field Notes, creates/edits/replays records, and cannot read parent storage | Pass when toolchain present |
| Direct preview CSP includes `sandbox allow-scripts allow-forms` and omits `allow-same-origin` | Pass |
| Talk `talk.architect.source.resolve` pending until Talk registers; client digest refused | Pass |
| Intercepted browser `Working tracker` HTML | UI fixture only |

## Unavailable in this workspace

- Docker executable is not installed (`docker: command not found`). Live isolated image execution against `aethelios-architect-apps:2026-10-14.1` was not run. There is no Docker-enabled Apps job in `.github/workflows/architect-origin.yml`.
- No funded OpenAI call was made.
- Talk authorized source adapter is implemented on the Architect side and still pending Talk workstream registration.
- Hosted Apps migrations are unapplied.

## Screenshots

Simulated viewports of the compiled Field Notes preview document:

- desktop 1440×900, phone 390×844, Fold 768×1024

These are simulated viewports, not physical-device acceptance.
