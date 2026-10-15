> Superseded integration checkpoint: see [TALK_STACK_RECONCILIATION.md](TALK_STACK_RECONCILIATION.md). Hosted SQL remains PAUSED after step 6; cancelled verification is not resumed. The old pins and apply sequence below are historical.

# Talk release package — 2026-10-15

Pinned handoff. No new Talk feature. No hosted SQL, credential change, paid call, merge or production deploy is authorized by this document.

**Decision:** Talk review code and exact-head CI are complete. Stop coding. The next required external action is the **verified completion receipt for the original 18 hosted migrations**, owned outside Cursor. Do not treat Vercel previews or green Quality as live-ready.

Background: [TALK_INTEGRATED_RELEASE.md](TALK_INTEGRATED_RELEASE.md). Motion and Ecosystem stay separate.

## 1. Final heads and integration order

| Role | PR | Branch | Verified Quality head | This pin | Proposed order |
|---|---|---|---|---|---|
| Foundation | [#131](https://github.com/neilaureliuscollective/gent-ascend-collective-app/pull/131) | `cursor/talk-creative-conversation-5b08` | `b822c319d5378b8a130bcd3c7960c5acdac125cf` | docs-only commit on that parent | Merge onto `main` first |
| Elevation | [#135](https://github.com/neilaureliuscollective/gent-ascend-collective-app/pull/135) | `cursor/talk-elevation-5b08` | `a859c239d7cc596bf24b58c2cbcd27f0b573796e` | restack onto the #131 pin | Merge onto the #131 result |
| Production today | — | `main` | `804c8770754aced1837e82dffa4a416c24baa595` | unchanged | Do not merge yet |

Quality, Live integration and sibling workflows were proven on `b822c31` / `a859c23`. This file is a docs-only publication of those results. It does not change application code, migrations or the recovery runner. #135 must remain stacked on the published #131 pin.

GitHub Actions for `pull_request` checks out the **merge ref**, not the source head. Receipt `commit` is that merge SHA:

| PR | Source head | Tested checkout (`GITHUB_SHA` / receipt `commit`) | Merge parents |
|---|---|---|---|
| #131 | `b822c31` | `431e9a24571a6a5e1cf43b2a53c825f7466711ea` | `804c877` + `b822c31` |
| #135 | `a859c23` | `1ec886a305d8c53a6496f80ebeb02bcc3b39c62f` | `b822c31` + `a859c23` |

Those receipt SHAs are not the PR heads. Do not treat them as identical.

## 2. Required checks — terminal results

Recorded 2026-10-15 after both Quality runs reached `completed` / `success`. Earlier cancelled jobs on the same heads (`38708206266`, `38708207487`) are superseded.

### #131 `b822c31`

| Check | Result | Link |
|---|---|---|
| Quality gates | **success** | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708216945 |
| Quality / database | success (mandatory recovery step) | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708216945/job/116332927921 |
| Quality / application | success (`check`, Health, Founder Office, Command, Live policy, e2e) | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708216945/job/116332928297 |
| Aethelios Live integration | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708217023 |
| Architect Origin acceptance | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708216983 |
| Studio production-room | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708216981 |
| Lifestyle | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708217054 |
| Intelligence motion | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708217085 |
| Obsidian visual | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708217022 |
| production-entry | skipped (not `main`) | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708217022/job/116335368349 |
| Vercel Preview | success | https://vercel.com/stutes-legacy/gent-ascend-collective-app/Gnu6LcbVhhWstgDeytiKiFcvGsJk |

### #135 `a859c23`

| Check | Result | Link |
|---|---|---|
| Quality gates | **success** | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215206 |
| Quality / database | success (mandatory recovery step) | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215206/job/116332874720 |
| Quality / application | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215206/job/116332874271 |
| Architect Origin | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215461 |
| Studio production-room | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215468 |
| Lifestyle | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215409 |
| Intelligence motion | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215286 |
| Obsidian visual | success | https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215399 |
| production-entry | skipped | expected off `main` |
| Aethelios Live integration | **did not run** | workflow `pull_request.branches: [main]` only; #135 targets #131 |
| Vercel Preview | success | https://vercel.com/stutes-legacy/gent-ascend-collective-app/42dsMgKhiio8LNxxteR765PpKjkG |

Preview and CI success are review facts only.

## 3. Recovery receipts

| PR | Artifact | ID | Receipt `commit` | Maps to source |
|---|---|---|---|---|
| #131 | `talk-import-recovery-receipt` | [11959616609](https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708216945/artifacts/11959616609) | `431e9a24` | `b822c31` |
| #135 | `talk-import-recovery-receipt` | [11960120508](https://github.com/neilaureliuscollective/gent-ascend-collective-app/actions/runs/38708215206/artifacts/11960120508) | `1ec886a3` | `a859c23` |

Both receipts prove, on **local PostgreSQL 17.6** at `127.0.0.1:54322` in disposable `talk_import_recovery`:

- `applicationDatabaseUntouched: true`
- `sudoPeerEscalation: false`
- `variableConflict: "error"`
- historical `save_id=save_id` / `project_id=project_id` ambiguity still present in `20261014040000`
- corrected recovery path; normal import; same-request replay; unique-violation recovery
- foreign owner rejected; failed recovery unchanged; occupied pairing preserved; historical file unchanged

Guards preserved: loopback-only, port `54322`, quoted disposable name, refuse hosted/system/application names, no sudo, no `LOAD plpgsql`, missing listener fails the job. This is not a hosted-schema proof.

## 4. Migrations

### Original 18 — separate owner; do not apply from Cursor

Last confirmed applied: **files 1–4 only**. File 5 is awaiting a tool approval outside this checkpoint. Do not replay 1–4 or rewrite hosted `version` prefixes. Reconcile the forthcoming receipt by ledger **name**.

| # | File | sha256 | git blob |
|---|---|---|---|
| 1 applied | `20261013240000_talk_creation.sql` | `b4f89996fee6cc353ca89e28394c3e321c0de8348942ae36a839af6ce2b7018f` | `aec75d3fab23dc10ecf3557ce531ec9ce998e253` |
| 2 applied | `20261013250000_talk_image_entitlement.sql` | `272e46c2331e59ccfd1586281d7d4f401eb448e0df1e22fc062c314ba79d8552` | `fd80c6d1c274ca3fafb4d86ae1b33b735025fa00` |
| 3 applied | `20261013260000_talk_creation_candidates.sql` | `dba93df8158baf804f9b92addaf38676ae58500b344ea644de37536de90b54f9` | `0b874ac4ba82b465fb0b46fdb42e8061cd863e1d` |
| 4 applied | `20261014010000_talk_origin_import.sql` | `f136fa693594d3fc6fec381f22bba2866c2e390f777a2e2761f4cff7379fda47` | `4cccfff11c2fdedad08168fe52c764e6c2be54f0` |
| 5 waiting | `20261014020000_talk_origin_import_bind.sql` | `b2258b7ad4e129c486b58fcade84d3b90642a31166199f062b75725a71dbc728` | `377c75a906c6c254cd1b4e28e9b112ab4252ab08` |
| 6 | `20261014030000_talk_origin_import_atomic.sql` | `72606379f3602aa43bbaf443d57c690f3dea54ccaa7fb4ca9462bf7adf97b215` | `878ed578b3acf9727e5f6e080ad45426636c6e12` |
| 7 | `20261014040000_talk_origin_import_consistency.sql` | `b480865a6bbcb78a93c366341ba644ca04cf8243b22fe8eb878ab20a322c4f72` | `3e7f5903b2726d6aeca9d9d679d3df95dcbaacb9` |
| 8 | `20261014100000_talk_design_board.sql` | `b296fe76e97285e184781316720800322c62dff2c70d6ed90074328461529e8c` | `84ee2fc0dcd6a40e0f1327c96fe1a3d4df9ed0c2` |
| 9 | `20261014120000_talk_live_bindings.sql` | `adc71eaf761cd1b7ff9807a49bdc009c28628a9e75ba9eac567c661798e1cdc7` | `c2e989035671281622be52c145d6810c9c6352f4` |
| 10 | `20261014130000_talk_direction_transfers.sql` | `f720b2d78d624aa59b3258bd021c8b8cfe3bd833991ea01fc6c1534b6dd355b5` | `a82f3ff513ebbaa64a5c4871b5bf317b3c3a7e61` |
| 11 | `20261014140000_talk_live_bind_authority.sql` | `a4e3e7ade44560e83516809b3a529ab2d2830f38196a9864a474676cb643e46b` | `66f334ba49517cb7248502c015e7e8b69dd945cf` |
| 12 | `20261015080000_architect_apps.sql` | `6c3c1231581b26caa097b7134239f0e9fd311146cb1405382f0b70df405fc7e8` | `085b566596b69533a244413a82cbee23e6ae9358` |
| 13 | `20261015120000_architect_apps_durable.sql` | `7d13742e37b41443059019031196ec8445bbca32f73dd367ae9493e584adcd96` | `19398888bcec2d9e9bc6072a3cb14fef236528a9` |
| 14 | `20261015140000_architect_apps_mutation.sql` | `09e0d706665fd7ff7ea0083e493f3ec8690f44610832740dba400e8c6727fdb0` | `664c8f7e256324a6f3882e3d7468ecd93024feab` |
| 15 | `20261015160000_architect_apps_retain_authority.sql` | `f4c4364cd40209ca3f634349ebceedcbd9531a643f4a1296c6558163d828f868` | `f0ba768ce7ef82dd2c419ed884c9884ccaa468b9` |
| 16 | `20261015170000_architect_apps_retain_provenance.sql` | `a34373ba806ff969c444bdfd990f0878b3be183cfc368e71a366613777c02d2a` | `310d4944189f50036c0c217d9dff925cf2bd0cac` |
| 17 | `20261015180000_talk_live_trusted_observe.sql` | `af86da72fc9da2ee6a42197aac910c1b7068b5660ca1ef5d71d3f56398bc762e` | `8e192936a8d9929ab16d67b5999a111692683c0c` |
| 18 | `20261015190000_talk_live_bind_intended_turn.sql` | `0bcfa846a570721bd0ccdcd03803d154e7359ae7b9bfe1d4dcf5a4eafc5fb7f7` | `97bce318ba5f2fb527c034cc9832716e1c7634e8` |

Already hosted independently (not one of the 18): Architect Origin name `20261012230000_architect_origin` / remapped version `20261014010638`; Health `20261015181000_health_workspace` on main.

### Nineteenth file — outside the original approval; do not apply

`supabase/migrations/20261019120000_talk_origin_import_recovery.sql`

- sha256 `bcbae79ea9351f17428b986af5a4904556092b7a72e662d1dcff33561a6bd352`
- git blob `40c7dd490b31e6c078b1d49a824e6a39c04feb10`
- Identical on #131 and #135.

**Scope:** `CREATE OR REPLACE` of `public.ai_talk_import_origin(uuid,uuid,uuid)` only. Sets `#variable_conflict error`. Unique-violation recovery now qualifies `origin_import.save_id` / `origin_import.project_id` against `intended_save_id` / `intended_project_id`. Owner checks, immutable provenance, idempotent replay and atomic import are unchanged. It does **not** edit `20261014040000_talk_origin_import_consistency.sql`.

**Dependencies (must already be present):** Architect Origin (`architect_origin_save` / `architect_origin_versions`); Talk creations (`20261013240000`); Origin import table (`20261014010000`); `ai_talk_scoped_identity` (`20261014020000`); atomic/mapped import (`20261014030000`); the historical `ai_talk_import_origin` from `20261014040000` that this file replaces.

**Read-only post-application verification** (after a later, separate approval; not run here):

1. Ledger name: `select version, name from supabase_migrations.schema_migrations where name like '%talk_origin_import_recovery%';` — accept a remapped `version`; do not rewrite it.
2. `select pg_get_functiondef('public.ai_talk_import_origin(uuid,uuid,uuid)'::regprocedure);` must contain `intended_save_id`, `intended_project_id`, `origin_import.save_id`, `origin_import.project_id`, and `#variable_conflict error`. It must not recover with unqualified `save_id=save_id` / `project_id=project_id`.
3. Historical file checksum of `20261014040000_talk_origin_import_consistency.sql` remains `b480865a6bbcb78a93c366341ba644ca04cf8243b22fe8eb878ab20a322c4f72`.
4. Optional: [TALK_RELEASE_DIAGNOSTIC.sql](TALK_RELEASE_DIAGNOSTIC.sql) catalog-only. `originImport` may become `equivalent-candidate`. That file never emits `verified equivalent`.
5. Do not insert hosted test imports or read conversation content.

## 5. Production source, deploy, rollback

| Fact | Value |
|---|---|
| Production URL | https://www.gentascend.com |
| Current source | `804c8770754aced1837e82dffa4a416c24baa595` |
| Last verified deployment | `dpl_G85ZzGhokxzRYrXx6tzEz9QT7JXT` |
| Vercel project | `stutes-legacy/gent-ascend-collective-app` (Git-linked Production from `main`) |
| Compatible rollback after a Talk merge | Redeploy / revert to **`804c877`** |
| Do not roll back to | Health-only `544c156` (silently undoes Studio) |
| Do not roll back | Hosted SQL. If an apply stops mid-sequence, leave applied versions in place |

A merge of #131 onto `main` will create a Production deployment of Talk foundation code. That is not a GitHub-only step and is **not** authorized here.

## 6. Separate readiness statuses

| Gate | Status |
|---|---|
| Code readiness | **Complete for review.** Exact-head Quality green on `b822c31` and `a859c23`. Recovery proof is real on CI PostgreSQL 17.6. |
| Schema readiness | **Incomplete.** Original 18: partial (1–4 applied; no completion receipt). Nineteenth recovery: **not hosted**. |
| Deployment | **Not authorized.** Production remains pre-Talk `804c877` / `dpl_G85ZzGhokxzRYrXx6tzEz9QT7JXT`. Previews are not Production. |
| Text acceptance | **Not executed.** No paid chat, no hosted test conversation. |
| Voice acceptance | **Not executed.** Historical production HTTP 400 remains **unconfirmed**. Do not assume it is fixed. |

Ordinary existing chat can survive a missing Talk schema. Talk save/reopen of briefs, boards, Origin import, and voice bind cannot.

## 7. Smallest real-use acceptance — prepared, not run

Run only after: verified 18 receipt, separately approved nineteenth apply, founder-approved merge/deploy, and a separate text (then voice) authorization. Proposed text cap: one chat completion, well under $1. Proposed voice cap: one 30–60s Realtime call; stop if admission is not 2xx.

**Nothing below was executed from this environment.**

### Text — after authorized Production deploy of #131 (or #131+#135)

1. Sign in at `https://www.gentascend.com/enter`. Open Talk at `https://www.gentascend.com/app/aethelios` (`src/app/(workspace)/app/aethelios`).
2. Type one new message. Submit uses `TalkInput` + Send (`src/components/aurelius/workspace.tsx`) → `POST /api/aurelius/chat` (`src/app/api/aurelius/chat/route.ts`). Expect streamed `application/x-ndjson` and status **Reply saved.**
3. Note the conversation id in `?conversation=`. Reload that URL. Same turns must persist; no duplicated user/assistant pair.
4. Send a second message. While streaming, click **Stop reply** (`cancelReply` / `AbortController`). Confirm the stop copy and that reload does not invent a second conversation.
5. On an incomplete/failed turn, **Retry reply** (`revisionKind: 'retry'` in `src/components/aurelius/message.tsx`).
6. On a phone-width viewport, focus the composer. `useTalkViewport` (`src/components/aurelius/conversation-viewport.tsx`) should set `data-keyboard=open` and `--conversation-height` from `visualViewport`. Send/Stop use `retainComposerFocus` so the keyboard stays up.

If Talk SQL is still unverified, stop after step 3. Do not import Origin or save briefs against a partial schema.

### Voice — separately authorized; #135 adds dock / mid-call target

1. Same Talk conversation. **Aethelios Live** → **Start voice** (`LiveVoiceEntry` in `src/components/live/provider.tsx`) → `POST /api/aethelios/live`.
2. **Historical HTTP 400:** record the actual admission status and sanitized `stage` / `category` / `providerStatus` from the failed-admission UI (`readProviderRejection` in `src/domains/live/admission-request.ts`). If not 2xx, stop. Do not retry-spend. Do not assume the 400 is gone.
3. Grant microphone. Confirm capture (`Mute microphone` / `Unmute microphone`) and an audible Aethelios reply.
4. Interrupt with **Stop speaking**. Confirm the model yields.
5. **Fullscreen** then **Minimize**. On #135 the compact chrome portals into `#talk-voice-dock`. The conversation id must stay the same.
6. **End** → `DELETE /api/aethelios/live`. Confirm the microphone releases and text Send works again (`talkComposerSendRoute` returns `text` after cleanup).
7. #135 only, if Talk SQL is present: mid-call field change uses `POST /api/aethelios/live/target`.

A handshake is not a conversation. Keep text usable if voice stays blocked.

## 8. Remaining external actions (in order)

1. **Now:** database owner provides the verified 18-file completion receipt. Cursor does not apply remaining files or rewrite ledger versions.
2. **Then, separately:** founder approval to apply only `20261019120000_talk_origin_import_recovery.sql`, then the read-only checks in §4.
3. **Then, separately:** merge #131 onto `main` (auto-deploys Production). Rollback target `804c877`.
4. **Then, separately:** merge #135.
5. **Then, separately:** authorized text acceptance (§7).
6. **Then, separately:** authorized voice acceptance, including the actual HTTP 400 result.

Do not invent more Talk coding tasks while those gates wait.
