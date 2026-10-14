# Talk → Architect design-direction contract

Architect owns this receiving contract. Talk owns generating or selecting the design board and requesting transfer. Do not edit Talk producer UI from this module.

| Item | Value |
| --- | --- |
| Schema | `talk-architect-direction/v1` |
| Compatible text import | `talk-architect-handoff/v1` |
| Version | `2026-10-14.1` |
| Module | `src/domains/architect-design-direction/contract.ts` |
| Receiver | `src/domains/architect-design-direction/receiver.ts` |
| Path | `POST /api/architect-design-direction` |
| Command | `{ action: 'receive', requestId, projectId, receipt }` |

## Authority

- Authenticated session cookie only.
- Owner, project and digest authority come from server-owned records.
- Compatible `talk-architect-handoff/v1` text import binds the digest to the submitted payload. That is integrity of the import, not verification of a Talk board.
- Talk-owned boards require `src/domains/architect-design-direction/talk-source.ts`. Architect does not invent a Talk store. The adapter is pending on the Talk workstream.
- A client-supplied hash is not authority.
- Retry of the same `requestId` creates or reopens exactly one private project.
- Execution never starts on import (`started: false`).
- Schema/module version stays `2026-10-14.1`. Communicate any later version change explicitly to the Talk workstream.

## v1 fields

- Identity: conversation, board, board version, direction.
- Role-based color tokens, typography tokens, allowed layout/style tokens.
- Trusted demo specification, approved copy, asset references and provenance.
- Integrity digest over owner-authorized immutable server records.

`mapTextHandoffToDirection` preserves existing v1 text imports as an explicit compatible extension. Those imports are not generated applications.
