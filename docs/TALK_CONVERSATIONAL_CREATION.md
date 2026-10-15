# Talk conversational creation — 2026-10-13

Development branch only. No production merge, hosted migration, Live flag change, paid provider call or Architect rewrite.

## Implemented

Talk now keeps useful work inside one conversation across text and voice:

- Schema-validated **design boards** with three selectable directions, named color tokens, typography, spacing/shape/material, a trusted hero demonstration, proposed copy and labelled asset provenance. Swatch and direction changes update the sample immediately. “Make this warmer” revises the selected direction only.
- Architect **design-direction** transfer uses the published `talk-architect-direction/v1` contract. Talk produces a mapped receipt from immutable board/version/direction records and registers the authorized source adapter. Architect v1 demo is `tracker|none`; Talk hero-product stays in Talk. v1 text import of brief/plan/palette is unchanged and refuses silent board drops.

- Schema-validated **brief**, **plan** and **palette** artifacts with owner-scoped versions. Edits write a new version against an explicit predecessor; a stale predecessor is rejected.
- Palettes render **actual CSS swatches** and calculated contrast. Image generation is never used to draw color blocks.
- Natural-language **image create/edit** reuses Studio generation (`generateStudio`) through Talk-only `ai_talk_propose_image` / `ai_talk_claim_image`. Admission is `studio.create` / `talk_studio_entitled`, not Live `voice.use` or `liveConfig()`. Discussion of images does not propose work. Live image RPCs stay founder/beta.
- **Image attachments** reuse the Studio reference bucket (`aethelios-studio`, owner prefix, PNG/JPEG/WebP, 10 MB). Pixels are sent to the model for analysis only.
- **Use in Architect** persists `talk-architect-handoff/v1` with selected versions, image references and provenance. After an explicit review, Talk creates one private Origin project through the existing `architect_origin_save` contract and records an owner-scoped import receipt. `imported` becomes true only after that destination write is confirmed.
- Text artifacts load from `/api/aurelius/creations` independently of Live. Ordinary chat continues if that table is not yet applied.

## Not changed

Production voice flags, Construct, Connections, Architect worker/runtime, and existing Studio/Live artifact RPCs for paid image work. Live admission stays on `/v1/realtime/calls` with string FormData fields. Architect Apps durable retain SQL stays on the Architect branch; Talk registers the producer and source adapter against the published receiver.

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
- Explicit confirmation calls one owner-authenticated `ai_talk_import_origin` with only request, handoff and conversation identity. Destination IDs, normalized bounded content, `talk-origin-import/v1` and copied/reference provenance are derived from authorized immutable Talk rows. The function calls existing `architect_origin_save` and records the receipt in the same transaction. No model build, Construct run or publication is started.
- Exact replay of the same identities returns the original committed receipt. Changed identities fail. Expected project/save IDs that already hold different valid content, even with note `Imported from Talk`, are refused without overwrite or a success receipt. Client digests, deterministic UUIDs and note text are not treated as proof.
- Standalone `ai_talk_record_origin_import` overloads are dropped. Authenticated callers cannot execute `ai_talk_scoped_identity` or the internal mapper.
- `imported` is overlaid from the receipt only after the saved Origin content matches the reviewed mapping. Failed or unavailable Origin saves leave the package prepared.
- Copied into Origin as bounded text: brief title/purpose/audience/requirements, plan summary and step text, palette names and hex values. Palette roles, contrast pairs and image pixels are not copied. Selected version and image ids stay referenced on the Talk package/receipt and in the imported project's `blueprint.state`.
- An existing unsent Origin draft is mounted-app memory. Import does not open, overwrite or discard it. Supported Back/Forward retains the draft; accepted explicit leave discards it.
- Additive migrations: `20261014010000_talk_origin_import.sql`, `20261014020000_talk_origin_import_bind.sql`, `20261014030000_talk_origin_import_atomic.sql`, `20261014040000_talk_origin_import_consistency.sql` and forward-only `20261019120000_talk_origin_import_recovery.sql`. They do not change previously applied Origin or Talk files. `19120000` qualifies unique-violation recovery and does not edit `14040000`.
- Review, SQL mapping and receipt verification share one UTF-16 truncation rule that never splits surrogate pairs, one selected creation per kind, and provenance flags taken from the actual bound decision. Ambiguous same-kind packages fail before any Origin write. Bounded text and palette hex remain copied; other palette details and images stay referenced in Talk.

## Remaining dependencies

- `AETHELIOS_TALK_CREATION_FIXTURE=legacy-reserve` is a labelled deterministic model stand-in used by talk-auth. It enables the real Talk composer and persist path without a paid OpenAI key. It is not a production model connection.
- Hosted apply of `20261013240000_talk_creation.sql` through `20261014140000_talk_live_bind_authority.sql`, plus Architect `20261015080000_architect_apps.sql`, `20261015120000_architect_apps_durable.sql` (from `2da0b6d`), `20261015140000_architect_apps_mutation.sql` (unchanged from `fb41859`), additive `20261015160000_architect_apps_retain_authority.sql`, `20261015170000_architect_apps_retain_provenance.sql`, `20261015180000_talk_live_trusted_observe.sql` and `20261015190000_talk_live_bind_intended_turn.sql`, requires founder authorization. Talk does not add a second receiver or store. None of these files broaden production access until applied.
- Additive `20261014010000_talk_origin_import.sql`, `20261014020000_talk_origin_import_bind.sql`, `20261014030000_talk_origin_import_atomic.sql` and `20261014040000_talk_origin_import_consistency.sql` are the import slice of the original 18. Forward `20261019120000_talk_origin_import_recovery.sql` is prepared locally and is not part of that batch. Hosted apply of either group still requires founder authorization. Do not edit the already-applied Origin migration record or `14040000`.
- Paid image generation still needs Studio entitlement, OpenAI image access and the existing quota/RPC pilot checks.
- Physical Fold/Safari and live-provider acceptance remain separate gates.

## Exact-head checks on this branch

Recorded on this creative-conversation branch before push. Browser evidence includes mocked-provider Playwright. PGlite SQL is disposable persistence, not a real Auth test. Local Docker/Auth is unavailable in this checkout; Quality `database` and Architect Origin `local-auth` run the Auth/PostgREST smoke and talk-auth suite on exact head. Viewport captures are simulated Chromium sizes, not physical phone audio.

- lint: pass
- typecheck: pass
- vitest: 994 passed (includes replacement-session fencing, observe-then-bind denials, Architect-ack receipts, typed persist, v1 board-refusal)
- db ledger: pass (Talk, import, design-board, live-binding, direction-transfer and copied Architect Apps SQL remain unapplied on hosted; Origin production record unchanged)
- production build: pass
- Playwright (mocked providers): Live artifact fixtures now use artifact conversation identity; not counted as the saved/refined/imported journey
- Persistence used: PGlite for SQL relationship checks; authenticated talk-auth/talk-receipt smoke wired to CI disposable Supabase without `ARCHITECT_APPS_STORE=memory`
- Unrun in this checkout: talk-auth and receipt smoke (no local Docker Auth), physical Fold/Safari two-way audio, paid OpenAI image/voice calls, hosted migration apply. Production HTTP 400 remains unverified.

## Capability matrix

| Capability | Text | Voice | Notes |
|---|---|---|---|
| One conversation identity | Works | Works | Shared owner + conversation + session |
| Composer send status | Works | Works | 6000 text / 4000 voice; draft kept until accepted |
| Inline design board | Works | Same artifacts | Trusted React; no model HTML/JS |
| Refine selected direction | Works | Same persist | Other directions and prior versions kept |
| Studio images | Entitled only | Same Studio path | Explains unavailability; no automatic paid calls |
| v1 Architect text import | Works | Same package | Atomic/idempotent Origin receipt |
| Rich design-direction transfer | Connected producer + source adapter | Same | Architect v1 demo is tracker/none; Talk hero-product stays referenced |
| Two-way audio | n/a | Founder device only | READY or mocked handshake is not acceptance |

## Founder test

1. Open Talk with voice unavailable.
2. Send “Help me develop a premium brand and website.”
3. Review the brief; save a new version.
4. Reload while a save is still pending: the original identity recovers or stays pending honestly.
5. Prepare for Architect, lose the response, retry: one package, same receipt.
6. Review copied text/hex versus Talk-only version and image references. Confirm import. Reopen the saved Origin project. An existing unsent Architect draft stays put if you return through in-app navigation.
7. Lose the import acknowledgement after Origin has committed and retry: one project, one save, one receipt.
8. Start New conversation during a slow image in A: B stays clean. Reopen A: saved result is still there.
9. If a generation finishes after a newer manual save: current version stays; the proposal is a reviewable candidate, not applied.
