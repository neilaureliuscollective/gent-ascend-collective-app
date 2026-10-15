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
- Talk-owned boards require `src/domains/architect-design-direction/talk-source.ts` using published contract `talk.architect.source.resolve`. Architect does not invent a Talk store. Talk registers `createTalkAuthorizedSourceAdapter` from immutable server records. The adapter is pending on the Talk workstream until that registration exists.
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

## Talk checkout registration

This Talk branch registers `createTalkAuthorizedSourceAdapter` from `src/domains/talk-creation/architect-source.ts` against Architect head `2da0b6d`. Durable destination rows use Architect’s unchanged `20261015080000_architect_apps.sql` and `20261015120000_architect_apps_durable.sql`. Talk does not add a second receiver or store. Architect’s own checkout still documents the adapter as pending until that registration exists there. Schema/module version remains `2026-10-14.1`. Talk maps slug direction IDs to deterministic UUIDs, color roles to canvas/ink/muted/accent/reserve/emerald, typography to display/body tokens, spacing to stack/split/gallery plus board, and hero-product to labelled `none`. Typefaces, shape/material, surface/border and packaging pixels stay on the Talk board.
