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

## Remaining dependencies

- Hosted apply of `20261013240000_talk_creation.sql` and `20261013250000_talk_image_entitlement.sql` requires founder authorization. Neither file broadens production access until applied.
- Architect receiving `ConversationDraft.take('architect')` is a follow-up after PR #120. Until then the package is saved and staged, not imported.
- Paid image generation still needs Studio entitlement, OpenAI image access and the existing quota/RPC pilot checks.
- Physical Fold/Safari and live-provider acceptance remain separate gates.

## Exact-head checks on this branch

Recorded on the recovery pass before push. Browser evidence is mocked-provider Playwright, not a paid image receipt. PGlite SQL is not a real Supabase Auth test. Local founder harness was absent.

- lint: pass
- typecheck: pass
- vitest: 790 passed
- db ledger: pass (Talk SQL remains unapplied on hosted)
- production build: pass
- Playwright (mocked providers): talk-creation 3/3, talk-layout 6/6, talk-recovery 10/10, talk-interaction-recovery 4/4, aurelius 18/18, bplus-talk 13/13, fluid-conversation 16/16, live-artifacts 2/2
- Unrun: remaining Quality `test:e2e` files, founder Auth smoke, physical Fold/Safari, paid OpenAI image calls, hosted migration apply, Architect import acknowledgement

## Founder test

1. Open Talk with voice unavailable.
2. Send “Help me develop a premium brand and website.”
3. Review the brief and palette in the thread; refine and save a new version.
4. Reload: selected versions remain.
5. If funded, explicitly ask for an image, approve cost, then request an edit of the selected version.
6. Use in Architect: confirm the package is saved and that Architect does not claim import.
