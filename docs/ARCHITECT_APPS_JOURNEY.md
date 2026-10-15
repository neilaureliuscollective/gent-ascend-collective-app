# Architect Apps journey receipts — PR #130

Deterministic local evidence. Not physical-device acceptance and not a funded OpenAI call.

## Verified on this head

| Check | Result |
| --- | --- |
| Production adapter receives exact source contents, hashes, collections, complete bridge, brief and design tokens | Pass |
| Additive tag revision binds exact base hashes and preserves untouched `src/calc.ts` | Pass |
| Tracker remains labelled `fixture` | Pass |
| Compact `v1.nonce.exp.mac` preview session ≤ 96 characters; replacement revokes the prior session | Pass |
| Fallback preview signing secret refused | Pass |
| Allowlisted data payload ignores forged project/revision/action | Pass |
| Isolated Docker invocation: nobody 65534, network none, no socket/secrets | Pass |
| Emitted `apps-runner.mjs` is ESM (`readdirSync`, no `require`) and walks real artifacts | Pass |
| Named-container `docker rm -f` plus inspect confirmation | Pass |
| Host-fixture cannot mark mock generation isolated | Pass |
| Create → edit A → same-payload retry → edit B; changed payload on the same key rejected | Pass (MemoryAppStore, PGlite, Auth smoke) |
| Uncertain create retains record ID + operation key; lost-ack retry stays one record | Pass in compiled Field Notes fixture; connected UI journey required in Origin local-auth |
| Concurrent edit with stale `expectedVersion` rejected | Pass |
| Memory and SQL owner/app/collection isolation | Pass |
| Compiled Field Notes host-fixture bundle satisfies `assets/app.js` single-bundle contract | Pass when toolchain present |
| Preview assembly preserves compiled `$&` replacement patterns | Pass |
| Required CI `apps-isolate` builds `deploy/architect-apps/Dockerfile` and runs isolated compile | Implemented; runs on GitHub-hosted Ubuntu |
| Sandboxed iframe mounts Field Notes and cannot read parent storage | Pass when toolchain present; parent-page records remain a mount unit test |
| Direct preview CSP includes `sandbox allow-scripts allow-forms` and omits `allow-same-origin` | Pass |
| Talk `talk.architect.source.resolve` pending on this checkout; Talk #131 `f357385` is the integration candidate | Documented, not merged |
| Intercepted browser `Working tracker` HTML | UI fixture only |

## Unavailable in this workspace

- This workstation has no Docker executable (`docker: command not found`). Isolated compile is implemented and required in `.github/workflows/quality.yml` `apps-isolate`. It is not accepted here.
- No funded OpenAI call was made.
- Talk authorized source adapter is implemented on Talk #131 `f3573856002d16ac69341eb99f91e32deff76f64` (`src/domains/talk-creation/architect-source.ts`, retain authority/provenance SQL) and remains pending on this Architect checkout. Talk files were not copied.
- Hosted Apps migrations are unapplied.
- Preview sessions are in-process. Library GET issues a new session after restart; that is not a srcdoc replacement of parent memory.

## Screenshots

Workbench and compiled Field Notes viewports:

- desktop 1440×900, phone 390×844, Fold 768×1024

These are simulated viewports, not physical-device acceptance.
