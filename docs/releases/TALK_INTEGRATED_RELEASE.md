# Talk integrated release

Development publication only. No main merge, hosted migration, production deploy, credential creation or paid provider call without founder approval.

The next action is **permission for the read-only schema diagnostic**, not a merge. Merging #131 onto `main` is expected to create a Vercel **Production** deployment (production branch is `main`). That is not a no-effect GitHub-only step.

## Combined release tree

| Workstream | PR | Branch | Current head role |
|---|---|---|---|
| Foundation | #131 | `cursor/talk-creative-conversation-5b08` | Talk + live main `804c877` (Studio #132, icon, Lifestyle, Health `20261015181000`) |
| Elevation | #135 | `cursor/talk-elevation-5b08` | Stacks on #131. Dock, documents, selected-work, mid-call spoken target |
| Current main / production | — | `main` `804c8770754aced1837e82dffa4a416c24baa595` | Studio production `dpl_8YH8qk6gcsga7HFBhdYwaYzWFrTo` on https://www.gentascend.com |
| Health | #136 | merged on main | Published as `20261015181000_health_workspace.sql`. Do not absorb or rewrite |
| Studio | #132 | merged on main | FFmpeg Quality setup, Fabric/package changes, Design/Film types. Keep on rollback. |

Integration order: merge #131 onto current main, then #135 onto that SHA. Do not force-push.

An intermediate #131 production deploy ships Talk foundation **code** on the already-released Studio/Health/Lifestyle/icon main. It does **not** ship elevation, document editing, or the shared dock. It is schema-compatible with current main **filenames** (Talk `15180000` / `15190000` sit beside Health `15181000`). It is **not** compatible with a hosted database that still lacks the Talk objects those routes call. Ordinary existing chat can survive that gap; Talk save/reopen of briefs, boards, Origin import, and voice bind cannot. Released Studio must remain on any rollback.

## What each PR releases

### #131 alone

Creative conversation: briefs/plans/palettes/handoffs, Origin import, design boards, direction transfers, trusted voice observation, intended-turn bind, Architect Apps retain-provenance, labelled `legacy-reserve` composer fixture, and the 18 Talk/Architect-apps migrations.

Does **not** include: voice dock in Talk, Edit/Preview/Split documents, the shared selected-work resolver, mid-call `POST /api/aethelios/live/target`, or `talkComposerSendRoute` (text during voice cleanup).

### #135 only (still exclusive after #131)

`src/domains/work-items/*`, `src/domains/live/spoken-target.ts`, `src/app/api/aethelios/live/target/route.ts`, Talk dock/document chrome, selected-work lifecycle, mid-call spoken-field replace, text independence from voice cleanup. No additional migrations.

## Hosted ledger classification — Gent Ascend App `volpzkfsnmtztrovexcw`

Source of classification:

- Current hosted `schema_migrations` **name/version** read: the 18 Talk/Architect-apps files were **not listed**.
- Known remapping pattern: Architect Origin is hosted version `20261014010638` with name `20261012230000_architect_origin`.
- Local snapshot `scripts/check-migration-ledger.mjs` still ends at `20261012095801_studio_footage.sql`. That snapshot is not today’s live ledger.
- `docs/releases/TALK_121_HOSTED_APPLY.sql` was prepared and **not executed**. Planned hosted versions `20261014042300`–`20261014042306` are therefore not proof of apply.
- Physical-schema query was **cancelled**. It is not retried here.

Timestamp-only comparison is unsafe. A missing source timestamp does not prove the objects are absent. A matching name under a different hosted version is a **ledger** fact, not a definition/ACL proof. **Object existence is not equivalence:** several Talk files replace functions in place (intended-turn bind, retain-provenance, atomic import). A present table or same-named RPC can still be older, partial or conflicting.

Classification states used after the diagnostic:

| State | Meaning | Action |
|---|---|---|
| equivalent-candidate | SQL ceiling: listed signatures, definition markers, ACLs, owner SELECT policies and named constraints match. Not a hosted proof by itself | Founder reviews the catalog JSON before promoting to verified equivalent |
| verified equivalent | Founder judgment after reviewing the diagnostic JSON. The SQL file never emits this label | Do not replay |
| missing | Final and older signatures/tables absent | Candidate to apply, in order, after review |
| older | Obsolete signature or definition present; final contract absent | Stop for review; apply only the replacing file if safe |
| partial | Some objects exist; final definition/ACL/column set incomplete | Stop for explicit review |
| conflict | Impossible or unsafe combination (wrong grants, both observe overloads, Health name on Talk version) | Stop. Do not skip or replay |
| unverified | Not inspected | Do not infer |

### Ledger facts already inspected

- **18 Talk/Architect-apps names were absent** from the hosted ledger read on `volpzkfsnmtztrovexcw`. That is a name fact, not object absence.
- **Architect Origin** appears as hosted version `20261014010638` with name `20261012230000_architect_origin`. Ledger name-equivalent only. Objects, function definitions and ACLs remain **unverified**.
- Unused TALK_121 alternate versions `20261014042300`–`06` were not listed either. That apply was never executed.

### Physical objects — unverified (cancelled query, not retried)

None of the 18 files is classified missing, older, partial, equivalent or conflict at the object layer. Existence of a table after a later inspection would still require definition/ACL comparison before calling it satisfied.

### Final contracts the diagnostic compares

Object presence alone cannot satisfy these. The diagnostic now also lists ownership/RLS policies and constraints. It reports `equivalent-candidate` only when the listed signatures, definition markers, ACLs, owner SELECT policies and named constraints match. Founder review of that JSON is what can promote a row to verified equivalent. The SQL never emits `verified equivalent`.

| File | Final contract this release requires |
|---|---|
| `20261013240000_talk_creation.sql` | tables `ai_talk_creations`, `ai_talk_selection`; `talk_creation_valid(text,jsonb)`; `ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb)`; `ai_talk_select_creation(uuid,uuid)`; owner SELECT RLS; authenticated execute; anon denied |
| `20261013250000_talk_image_entitlement.sql` | `talk_studio_entitled(uuid)`; `ai_talk_propose_image(uuid,uuid,text,text,uuid)`; `ai_talk_claim_image(uuid,boolean)` |
| `20261013260000_talk_creation_candidates.sql` | `ai_talk_creations.candidate`; `ai_talk_save_candidate(uuid,uuid,uuid,text,uuid,jsonb)`; save/select refuse candidates as current |
| `20261014010000_talk_origin_import.sql` | `ai_talk_origin_imports` (later columns supersede the first receipt function) |
| `20261014020000_talk_origin_import_bind.sql` | `save_id`, `provenance`; `ai_talk_scoped_identity(text)` (not granted to authenticated after later files) |
| `20261014030000_talk_origin_import_atomic.sql` | `mapping_version='talk-origin-import/v1'`; `ai_talk_import_origin(uuid,uuid,uuid)` authenticated; obsolete `ai_talk_record_origin_import` overloads dropped |
| `20261014040000_talk_origin_import_consistency.sql` | `talk_utf16_length(text)`, `talk_bound_text(text,integer)` internal; one-per-kind import; derived `copied[].truncated` |
| `20261014100000_talk_design_board.sql` | design-board tables/RPCs used by inline boards |
| `20261014120000_talk_live_bindings.sql` | `ai_live_observed_items`, `ai_live_turn_bindings`; later files revoke the first observe/bind overloads |
| `20261014130000_talk_direction_transfers.sql` | `ai_talk_direction_transfers`; `ai_talk_record_direction_transfer(...)` authenticated |
| `20261014140000_talk_live_bind_authority.sql` | `ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)` authenticated; first observe/bind revoked |
| `20261015080000_architect_apps.sql` | Architect Apps / design-direction tables, owner SELECT |
| `20261015120000_architect_apps_durable.sql` | person-scoped policies; owner/worker RPCs; service-role worker functions |
| `20261015140000_architect_apps_mutation.sql` | `architect_apps_write_record(..., integer)` |
| `20261015160000_architect_apps_retain_authority.sql` | retain-design authority rewrite |
| `20261015170000_architect_apps_retain_provenance.sql` | `architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean)` derives verified from selected direction identity + digest |
| `20261015180000_talk_live_trusted_observe.sql` | 4-arg `ai_live_observe_trusted_item` service-role only (replaced next) |
| `20261015190000_talk_live_bind_intended_turn.sql` | `ai_live_observed_items.intended_turn_id`; **final** `ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)` service-role only; bind cannot attach a different completed turn or mismatched response |

Do not blindly reapply all 18. Do not mark them applied because a table exists. Do not rename hosted history. Stop older, partial and conflict rows for review.

### Conflicting

**Repository:** none. Health is `20261015181000`; Talk keeps `20261015180000` / `20261015190000`.

**Hosted:** unverified. If hosted version `20261015180000` exists under a Health name, stop. Talk must not overwrite that row. Coordinate by applied history; keep Talk’s published files.

### Main files after the 2026-10-12 snapshot

Command, Health foundation, Construct, Connections, and Health `20261015181000` may already be applied under remapped hosted versions. They are **not** the 18 Talk files. Confirm by name before any apply. Health `15181000` is already on main independently of this Talk merge.

## Permissioned check still required

The cancelled physical-schema query is **not retried** here. The previous draft called `has_function_privilege` with textual signatures, which **aborts when a function is missing**. The replacement resolves `to_regprocedure` / `to_regclass` OIDs first and reports `null` / `missing` instead.

Run this file only after explicit founder permission, in the SQL editor for **Gent Ascend App** (`volpzkfsnmtztrovexcw`):

`docs/releases/TALK_RELEASE_DIAGNOSTIC.sql`

It inspects catalog metadata only: function definitions, privileges, ownership/RLS policies, constraints and required columns. It does **not** read conversations, turns, creations or other user content. It does not write. Highest contract label is `equivalent-candidate`.

Optional ledger refresh (names only; already read once):

```sql
select version, name
from supabase_migrations.schema_migrations
where version in (
  '20261012230000','20261014010638',
  '20261013240000','20261013250000','20261013260000',
  '20261014010000','20261014020000','20261014030000','20261014040000',
  '20261014042300','20261014042301','20261014042302','20261014042303',
  '20261014042304','20261014042305','20261014042306',
  '20261014100000','20261014120000','20261014130000','20261014140000',
  '20261015080000','20261015120000','20261015140000',
  '20261015160000','20261015170000','20261015180000','20261015181000',
  '20261015190000'
) or name in (
  '20261012230000_architect_origin','20261012230000_architect_origin.sql',
  '20261013240000_talk_creation','20261013250000_talk_image_entitlement',
  '20261013260000_talk_creation_candidates','20261014010000_talk_origin_import',
  '20261014020000_talk_origin_import_bind','20261014030000_talk_origin_import_atomic',
  '20261014040000_talk_origin_import_consistency','20261014100000_talk_design_board',
  '20261014120000_talk_live_bindings','20261014130000_talk_direction_transfers',
  '20261014140000_talk_live_bind_authority','20261015080000_architect_apps',
  '20261015120000_architect_apps_durable','20261015140000_architect_apps_mutation',
  '20261015160000_architect_apps_retain_authority','20261015170000_architect_apps_retain_provenance',
  '20261015180000_talk_live_trusted_observe','20261015181000_health_workspace',
  '20261015190000_talk_live_bind_intended_turn'
)
order by version;
```

Until the diagnostic is authorized and returned, Talk SQL is **unverified**, not missing and not applied. After it returns, classify each contract from `contracts.*` plus function definition markers. Stop `older`, `partial` and `conflict`. Apply only `missing` files, in repository order.

## Isolated validation (this environment)

- `npm run db:ledger`: 37 recorded snapshot files unchanged; source versions unique (`15180000` Talk, `15181000` Health, `15190000` Talk).
- PGlite `tests/health-database.test.ts` applies every `supabase/migrations/*.sql` in filename order, including Talk observe → Health workspace → intended-turn bind, then asserts both Health `workspaces` and the 5-arg observe/`intended_turn_id` exist.
- PGlite `tests/talk-creation-database.test.ts` and `tests/talk-origin-import-database.test.ts` still pass (not Supabase Auth).
- Isolated `supabase db reset` unrun: Docker/Podman are not available here.
- `tests/talk-release-diagnostic.test.ts`: missing schema reports `missing` without aborting (text-signature `has_function_privilege` still throws); 4-arg observe / pre-intended-turn bind is `older`; final 5-arg observe + `intended_turn_id` + owner SELECT policies is `equivalent-candidate`; dropping the observe owner policy downgrades that contract to `partial`.

## Environment (names only)

Hosted fixtures must stay unset: `AETHELIOS_TALK_CREATION_FIXTURE`.

Text (independently releasable from voice):

- Deployed Vercel project `gent-ascend-collective-app` / production `www.gentascend.com`
- `OPENAI_API_KEY` on that project, belonging to the funded OpenAI project with chat model access
- Optional `AURELIUS_AI_MODEL` (code default if unset)
- Auth against the same Supabase project as RLS (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` matching `volpzkfsnmtztrovexcw`)

Voice (independent blocker):

- `AETHELIOS_LIVE_ENABLED=true` only after founder authorization
- `AETHELIOS_LIVE_FOUNDER_PILOT` / `AETHELIOS_LIVE_CANONICAL_PILOT` as already used for the founder pilot
- Server-only `SUPABASE_SERVICE_ROLE_KEY` for `ai_live_observe_trusted_item`
- Realtime model/project access on the same OpenAI project
- Browser secure context + microphone

Key presence or personal OpenAI usage does not prove the deployed key, project or model. Production HTTP 400 remains unconfirmed until one authorized admission on the deployed configuration.

Enter any missing values in Vercel Project Settings → Environment Variables (Production) and Supabase Project Settings → API. Do not paste values into chat.

## Text vs voice readiness

| Check | Text | Voice |
|---|---|---|
| Authentication / access | Code-ready; live founder session **unknown** until signed-in production check | Same |
| Provider / model configuration | `OPENAI_API_KEY` presence on the deployed project is **unknown** from this environment; fixture ≠ live | Same key, plus Realtime model admission **unknown**; historical HTTP 400 unconfirmed |
| Schema | Existing chat tables are on the 2026-10-12 hosted snapshot. Talk creation/import/board tables: **ledger-absent / objects unverified** | Bindings + 5-arg observe + `intended_turn_id`: **ledger-absent / objects unverified** |
| Normal reply streaming | Implemented; live stream **unknown** until one authorized chat completion | Not a text prerequisite |
| Saved / reopened conversation | Existing chat path implemented; Talk artifact save/reopen needs unverified Talk SQL | Durable transcript association needs unverified bind SQL |
| Provider admission | n/a | **Unknown** (do not spend to discover) |
| Microphone / playback | n/a | **Unknown** (device/secure-context) |
| Trusted observe / intended-turn bind | n/a | Implemented in #131; hosted objects **unverified** |
| Mid-call spoken target | n/a | Implemented only in #135 |

Ordinary text must stay usable if voice remains blocked.

## Production target and rollback

- Vercel project: `stutes-legacy/gent-ascend-collective-app` (`docs/VERCEL_SETUP.md`, Studio release evidence). Production URL https://www.gentascend.com.
- Current production: main `804c8770754aced1837e82dffa4a416c24baa595` / deployment `dpl_8YH8qk6gcsga7HFBhdYwaYzWFrTo` (Studio #132). Git-linked Production deploys from `main`. `vercel.json` does not disable Git deployments.
- A merge of #131 onto `main` is therefore expected to **auto-create a Production deployment** of foundation Talk code on top of released Studio (not #135). This is not a GitHub-only step.
- #135 stays stacked and does not deploy until it is merged to `main` after #131.
- Compatibility: #131 code on current main is filename-compatible with Health `15181000` and includes Studio FFmpeg/package/database types. It is not schema-compatible if Talk objects are missing or older. Ordinary existing chat can survive; Talk save/import/bind cannot.
- Rollback: revert the Talk merge commit(s) on `main` (Vercel will rebuild Production from **`804c877`**) or redeploy that SHA. Do **not** roll back to Health-only `544c156` — that silently undoes Studio. Do not roll back hosted SQL. If an apply stops mid-sequence, leave applied versions in place and resume only after re-running the diagnostic. Never rename an existing hosted row.

## Ordered integration and activation

Keep these separately identified. None of 2–5 is authorized by a green Quality run.

1. **Source release (Git):** exact-head Quality green on reconciled #131, then #135 stacked on that SHA. Merge #131 to `main` (auto Production), then #135.
2. **Database readiness:** founder-authorized read-only diagnostic on `volpzkfsnmtztrovexcw`. Classify `contracts.*` plus `requiredPolicies` / `requiredConstraints`. Apply only `missing` files in repository order. Stop `older` / `partial` / `conflict`. No apply plan is generated from unknown schema.
3. **Provider configuration (names only):** Production `OPENAI_API_KEY` on the Vercel project; Auth public URL/key matching Gent; hosted `AETHELIOS_TALK_CREATION_FIXTURE` unset. Voice additionally needs `AETHELIOS_LIVE_ENABLED`, founder-pilot flags, service-role observe, Realtime model access. Do not paste values.
4. **Text functional acceptance (after 1–3, separately authorized):** one authenticated production message, streamed reply, saved conversation, reopen the same conversation. Proposed cap: one chat completion, well under $1.
5. **Voice functional acceptance (independent, separately authorized):** microphone permission, connection, audible two-way conversation, interruption, minimize/restore, return to the same conversation. A handshake is not a conversation. Proposed cap: one 30–60s Realtime call; stop if admission is not 2xx. Keep text usable if voice is unavailable.

## Bounded live verification (after deploy, authorized separately)

Text-first (proposed cap: one chat completion, well under $1):

1. Sign in as the founder on `www.gentascend.com/app/aethelios`.
2. Send one new message. Confirm a streamed reply, a saved turn, and the same turn after reload. That is the text acceptance bar. A composer handshake is not enough.
3. If Talk SQL is verified present: open a brief, change Purpose, send, save, reopen. Unrelated fields stay unchanged. If Talk SQL is still unverified, stop after step 2.

Voice (proposed cap: one 30–60s Realtime call, stop if admission is not 2xx):

1. Same conversation, grant microphone permission, start Live.
2. If admission is not 2xx, record sanitized stage/category/providerStatus and stop. Do not retry-spend.
3. If admitted: confirm audible two-way speech, interrupt once, minimize and restore the dock, and return to the same conversation. If #135 is deployed, speak a Purpose edit, switch field to Audience while the call is up, speak a second edit, return to text, save and reopen. Only intended fields change.

## Smallest next authorization

1. **Now (unblocked by this pass):** permission to run `docs/releases/TALK_RELEASE_DIAGNOSTIC.sql` (read-only catalog metadata) on `volpzkfsnmtztrovexcw`. No user-content read. Not a merge, apply, deploy or paid call.
2. **After that report (still blocked):** exact apply/skip list from missing vs older/partial/conflict vs equivalent-candidate. No apply is authorized yet.
3. **Then, separately (blocked until 1–2 and exact-head Quality):** merge #131 onto `main`. That **will production-deploy** Talk foundation onto released Studio. Rollback target is `804c877`.
4. **Then, separately:** merge #135. Then bounded text (under $1). Voice only after a second explicit approval (30–60s cap).

Do not merge first to “get it on main” while schema is unverified. Approval for step 1 is the only source-complete next action. Merge/deploy/apply/paid calls remain blocked.
