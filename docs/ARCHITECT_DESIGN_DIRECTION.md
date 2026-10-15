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
- Talk-owned boards require `src/domains/architect-design-direction/talk-source.ts` using published contract `talk.architect.source.resolve`. Architect does not invent a Talk store. Talk registers `createTalkAuthorizedSourceAdapter` from immutable server records.
- Talk #131 integration candidate (do not merge blindly): inspected head `ae37393d191207d83ff548801ec3682a82a1a56f` on `cursor/talk-creative-conversation-5b08`. That checkout adds `src/domains/talk-creation/architect-source.ts` and Talk receipt-hardening. This Architect checkout keeps the receiver and reports the adapter as pending. Do not copy Talk files or overwrite Talk receipt work. Reuse owner, digest, direction version and durable destination acknowledgment from the published contract. A client digest is not authority.
- A client-computed content digest is not source authorization.
- Retry of the same `requestId` creates or reopens exactly one private project.
- Execution never starts on import (`started: false`).
- Schema/module version stays `2026-10-14.1`. Communicate any later version change explicitly to the Talk workstream.

## v1 fields

- Identity: conversation, board, board version, direction.
- Role-based color tokens, typography tokens, allowed layout/style tokens.
- Trusted demo specification, approved copy, asset references and provenance.
- Integrity digest over owner-authorized immutable server records.

`mapTextHandoffToDirection` preserves existing v1 text imports as an explicit compatible extension. Those imports are not generated applications.
