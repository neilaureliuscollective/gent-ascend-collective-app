# Talk conversational creation — 2026-10-13

Development branch only. No production merge, hosted migration, Live flag change, paid provider call or Architect rewrite.

## Implemented

Talk now keeps useful work inside the conversation:

- Schema-validated **brief**, **plan** and **palette** artifacts with owner-scoped versions. Edits write a new version against an explicit predecessor; a stale predecessor is rejected.
- Palettes render **actual CSS swatches** and calculated contrast. Image generation is never used to draw color blocks.
- Natural-language **image create/edit** reuses Studio generation (`generateStudio`) through Talk-only `ai_talk_propose_image` / `ai_talk_claim_image`. Admission is `studio.create` / `talk_studio_entitled`, not Live `voice.use` or `liveConfig()`. Discussion of images does not propose work. Live image RPCs stay founder/beta.
- **Image attachments** reuse the Studio reference bucket (`aethelios-studio`, owner prefix, PNG/JPEG/WebP, 10 MB). Pixels are sent to the model for analysis only.
- **Use in Architect** persists `talk-architect-handoff/v1` with selected versions, image references and provenance. `imported` stays `false` until Architect acknowledges a package. Architect workspace files were not edited (PRs #119/#120 own that surface).
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

## Remaining dependencies

- Hosted apply of `20261013240000_talk_creation.sql`, `20261013250000_talk_image_entitlement.sql` and `20261013260000_talk_creation_candidates.sql` requires founder authorization. None of these files broaden production access until applied.
- Architect receiving `ConversationDraft.take('architect')` is a follow-up after PR #120. Until then the package is saved and staged, not imported.
- Paid image generation still needs Studio entitlement, OpenAI image access and the existing quota/RPC pilot checks.
- Physical Fold/Safari and live-provider acceptance remain separate gates.

## Exact-head checks on this branch

Recorded on the continuity pass before push. Browser evidence is mocked-provider Playwright, not a paid image receipt. PGlite SQL is disposable persistence, not a real Supabase Auth test. Local founder Auth/PostgREST was absent; CI `database` applies the additive Talk migrations on disposable local Auth.

- lint: pass
- typecheck: pass
- vitest: 804 passed (includes Talk persist/SQL/handoff/candidate contracts and recover-first handoff)
- db ledger: pass (Talk SQL remains unapplied on hosted)
- production build: pass
- Playwright (mocked providers): talk-creation 3/3, talk-creation-recovery 8/8, talk-layout 6/6, talk-recovery 10/10, talk-interaction-recovery 4/4
- Persistence used: PGlite for ownership/idempotent handoff/candidate SQL; mocked `/api` for browser recovery; no local Auth/PostgREST
- Unrun: remaining Quality `test:e2e` files, founder Auth smoke, physical Fold/Safari, paid OpenAI image calls, hosted migration apply, Architect import acknowledgement

## Founder test

1. Open Talk with voice unavailable.
2. Send “Help me develop a premium brand and website.”
3. Review the brief; save a new version.
4. Reload while a save is still pending: the original identity recovers or stays pending honestly.
5. Prepare for Architect, lose the response, retry: one package, same receipt, `imported: false`.
6. Start New conversation during a slow image in A: B stays clean. Reopen A: saved result is still there.
7. If a generation finishes after a newer manual save: current version stays; the proposal is a reviewable candidate, not applied.
