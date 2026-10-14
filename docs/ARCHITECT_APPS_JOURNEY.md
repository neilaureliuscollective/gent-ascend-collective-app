# Architect Apps journey receipts — PR #130

Deterministic local evidence. Not physical-device acceptance and not a funded OpenAI call.

## Verified on this head

| Check | Result |
| --- | --- |
| Field Notes multi-file generation through production adapter + mocked transport | Pass |
| Additive tag revision preserves untouched `src/calc.ts` and rejects stale base hashes | Pass |
| Tracker remains labelled `fixture` | Pass |
| Compact `v1.nonce.mac` preview session ≤ 96 characters | Pass |
| Allowlisted data payload ignores forged project/revision/action | Pass |
| Isolated Docker invocation: nobody 65534, network none, no socket/secrets | Pass |
| Injected isolated runner emits fenced docker/sandbox success | Pass |
| Host-fixture cannot mark mock generation isolated | Pass |
| PGlite durable approve/start/claim/finish with `persons.auth_user_id` ≠ `person_id` | Pass |
| Foreign authenticated owner denied apps, revisions, artifacts, jobs, records | Pass |
| Worker lease fencing; host-fixture sandbox=true result rejected by SQL | Pass |
| Authenticated memory journey: approve → recover → explicit start → records → revise → reopen revision 1 → failed later build keeps last working app | Pass |
| Intercepted browser `Working tracker` HTML | UI fixture only |

## Unavailable in this workspace

- Docker executable is not installed (`docker: command not found`). Live isolated image execution and image-version verification against `aethelios-architect-apps:2026-10-14.1` were not run.
- No funded OpenAI call was made.
- Talk board adapter is pending on the Talk workstream. Text-import remains compatible.
- Hosted Apps migrations are unapplied.

## Screenshots

Simulated viewports of the persisted Field Notes journey document (isolated-success artifact after create/update):

- desktop 1440×900, phone 390×844, Fold 768×1024

Host-fixture also compiled the real multi-file Field Notes bundle (`sandbox=false`). Playwright `setContent` of that inlined module document did not mount in this environment; the workbench iframe is the intended renderer. These are simulated viewports, not physical-device acceptance.
