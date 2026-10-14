# Talk conversational creation — 2026-10-13

Development branch only. No production merge, hosted migration, Live flag change, paid provider call or Architect rewrite.

## Implemented

Talk now keeps useful work inside the conversation:

- Schema-validated **brief**, **plan** and **palette** artifacts with owner-scoped versions. Edits write a new version against an explicit predecessor; a stale predecessor is rejected.
- Palettes render **actual CSS swatches** and calculated contrast. Image generation is never used to draw color blocks.
- Natural-language **image create/edit** reuses Studio generation (`generateStudio`) through Talk-only `ai_talk_propose_image` / `ai_talk_claim_image`. Admission is `studio.create` / `talk_studio_entitled`, not Live `voice.use` or `liveConfig()`. Discussion of images does not propose work. Live image RPCs stay founder/beta.
- **Image attachments** reuse the Studio reference bucket (`aethelios-studio`, owner prefix, PNG/JPEG/WebP, 10 MB). Pixels are sent to the model for analysis only.
- **Use in Architect** persists `talk-architect-handoff/v1` with selected versions, image references and provenance. After an explicit review, Talk creates one private Origin project through the existing `architect_origin_save` contract and records an owner-scoped import receipt. `imported` becomes true only after that destination write is confirmed.
- Text artifacts load from `/api/aurelius/creations` independently of Live. Ordinary chat continues if that table is not yet applied.

## Not changed

Live voice, Live admission, production voice flags, Construct, Connections, Architect builder/workspace, and existing Studio/Live artifact RPCs for the Live path.

## Persistence and recovery (2026-10-13)

- Manual edits inherit the predecessor’s server-validated conversation and source-turn. Orphan or legacy rows without a turn stay on the latest message.
- Selected brief/plan/palette contents are supplied to the model as untrusted reviewed records. The predecessor is bound at request start; a concurrent edit makes the model proposal stale instead of overwriting.
- Save and Architect-prepare requests keep a stable identity. A lost response retries the same payload and returns the existing receipt.
- Image status uses a conversation/owner-scoped watch. Pausing the UI does not mark a job failed.
- Talk image SQL uses `talk_studio_entitled` / `studio.create`. Live RPCs remain founder/beta.
- Attachments resolve before `ai_begin_turn`, so a bad file does not leave a pending reservation.
- Architect packages are labeled **Prepared for Architect** until a receiver acknowledges import.

## Continuity (2026-10-13)

- One intended Architect handoff reuses the same request id, `preparedAt`, selections and contents across retry and reload. A changed selection mints a new identity. Server-side save is atomic: same identity+payload returns the original receipt; reused identity with different inputs is rejected.
- Pending revision/handoff records are owner-scoped. After authenticated owner and conversation identity are established, Talk recovers the original operation. Pending is cleared only after a matching receipt. Conflicts, failed network and other-owner records stay pending or untouched. Ordinary chat remains usable.
- New Conversation, conversation selection, owner change and unmount immediately invalidate the previous generation. A late initial-fetch continuation cannot recover another conversation into a null/new screen. Pending records for A stay owner-scoped so reopening A can recover them. Server-side image jobs stay intact.
- A committed Architect handoff is reconciled from the owner-scoped stored payload before current selections are revalidated. An exact replay returns the original receipt after the source brief is revised. A changed payload on that identity is rejected. Foreign or revoked access cannot recover the package.
- A stale generated proposal is stored as an owner-scoped `candidate` on the existing creation table (`ai_talk_save_candidate`). It is not selected, applied or current. The user can inspect it and explicitly keep it as a new version against the current predecessor. Failed preservation is labeled `stale-lost` and is never claimed saved. Additive migration: `20261013260000_talk_creation_candidates.sql`.

## Origin import (2026-10-14)

- Reviewing a prepared package resolves the owner's stored brief/plan/palette versions and authorized image references on the server. Browser contents are not trusted.
- Explicit confirmation creates one private Origin project with `architect_origin_save`. No model build, Construct run or publication is started.
- Import identity is owner-scoped. A durable `ai_talk_origin_imports` receipt links the package to the project. Lost-response and concurrent retries return that same project.
- `imported` is overlaid from the receipt only after destination persistence is confirmed. Failed or unavailable Origin saves leave the package prepared.
- An existing unsent Origin draft is not opened or overwritten by the import flow. The user can reopen the imported project and the selected source work from Talk.
- Additive migration: `20261014010000_talk_origin_import.sql`. It does not change previously applied Origin or Talk files.

## Remaining dependencies

- Hosted apply of `20261013240000_talk_creation.sql`, `20261013250000_talk_image_entitlement.sql` and `20261013260000_talk_creation_candidates.sql` requires founder authorization. None of these files broaden production access until applied.
- Additive `20261014010000_talk_origin_import.sql` is local/reviewable. Hosted apply of all four Talk files, including this receipt table, requires founder authorization. Do not edit the already-applied Origin migration record.
- Paid image generation still needs Studio entitlement, OpenAI image access and the existing quota/RPC pilot checks.
- Physical Fold/Safari and live-provider acceptance remain separate gates.

## Exact-head checks on this branch

Recorded on the integration pass before push. Browser evidence includes mocked-provider Playwright plus CI Auth/PostgREST on disposable local Supabase. PGlite SQL is disposable persistence, not a real Auth test. Local Docker/Auth was checked at run time; if absent, Quality `database` and Architect Origin `local-auth` run the new smoke and Playwright talk-auth suite.

- lint: pass
- typecheck: pass
- vitest: 930 passed (includes Talk persist/SQL/handoff/candidate/import contracts)
- db ledger: pass (Talk and import SQL remain unapplied on hosted; Origin production record unchanged)
- production build: pass
- Playwright (mocked providers): talk-creation 4/4, talk-creation-recovery 8/8
- Persistence used: PGlite for ownership/idempotent import SQL; mocked `/api` for browser recovery; real Auth acceptance wired to CI disposable Supabase
- Unrun until exact-head CI: Quality application `test:e2e` remainder, physical Fold/Safari, paid OpenAI image calls, hosted migration apply

## Founder test

1. Open Talk with voice unavailable.
2. Send “Help me develop a premium brand and website.”
3. Review the brief; save a new version.
4. Reload while a save is still pending: the original identity recovers or stays pending honestly.
5. Prepare for Architect, lose the response, retry: one package, same receipt.
6. Review the project that will be created. Confirm import. Reopen the saved Origin project. An existing unsent Architect draft stays put.
7. Lose the import acknowledgement and retry: one project and one receipt.
8. Start New conversation during a slow image in A: B stays clean. Reopen A: saved result is still there.
9. If a generation finishes after a newer manual save: current version stays; the proposal is a reviewable candidate, not applied.
