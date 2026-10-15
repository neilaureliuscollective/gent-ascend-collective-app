# Talk integrated release

Development publication only. No main merge, hosted migration, production deploy, credential creation or paid provider call without founder approval.

Merging #131 is the **next GitHub action**. It is not everything needed for working live Talk.

## Combined release tree

| Workstream | PR | Branch | Current head role |
|---|---|---|---|
| Foundation | #131 | `cursor/talk-creative-conversation-5b08` | Talk + current main `544c156` (icon, Lifestyle, Health `20261015181000`) |
| Elevation | #135 | `cursor/talk-elevation-5b08` | Stacks on #131. Dock, documents, selected-work, mid-call spoken target |
| Current main | — | `main` `544c15603e0c14069c7ebd469a294f0f4406b335` | Already contains icon, Lifestyle, Health #136 |
| Health | #136 | merged on main | Published as `20261015181000_health_workspace.sql`. Do not absorb or rewrite |

Integration order: merge #131 onto current main, then #135 onto that SHA. Do not force-push.

An intermediate #131 production deploy ships Talk foundation **code** on the already-released Health/Lifestyle/icon main. It does **not** ship elevation, document editing, or the shared dock. It is schema-compatible with current main **filenames** (Talk `15180000` / `15190000` sit beside Health `15181000`). It is **not** compatible with a hosted database that still lacks the Talk objects those routes call. Ordinary existing chat can survive that gap; Talk save/reopen of briefs, boards, Origin import, and voice bind cannot.

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

Timestamp-only comparison is unsafe. A missing source timestamp does not prove the objects are absent. A matching name under a different hosted version is an equivalent **ledger** row, not a statement/hash proof.

### Verified equivalent (ledger)

| Repository file | Hosted evidence | Required objects (not re-queried this turn) |
|---|---|---|
| `20261012230000_architect_origin.sql` | version `20261014010638`, name `20261012230000_architect_origin` | `architect_origin_projects`, `architect_origin_versions`, `architect_origin_save(uuid,uuid,integer,jsonb,text)`, `architect_origin_valid(jsonb)` |

Origin **objects** remain unverified this turn because the cancelled physical query would have covered them.

### Ledger-absent by name — objects unverified

None of these 18 names (or the unused TALK_121 alternate versions `20261014042300`–`06`) appeared on the current hosted name read. **Not** classified genuinely missing.

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

Do not blindly reapply all 18. Do not mark them applied. Do not rename hosted history.

### Conflicting

**Repository:** none. Health is `20261015181000`; Talk keeps `20261015180000` / `20261015190000`.

**Hosted:** unverified. If hosted version `20261015180000` exists under a Health name, stop. Talk must not overwrite that row. Coordinate by applied history; keep Talk’s published files.

### Main files after the 2026-10-12 snapshot

Command, Health foundation, Construct, Connections, and Health `20261015181000` may already be applied under remapped hosted versions. They are **not** the 18 Talk files. Confirm by name before any apply. Health `15181000` is already on main independently of this Talk merge.

## Permissioned check still required

The cancelled physical-schema query is still necessary before any hosted apply. Requested read-only SQL for **Gent Ascend App** (`volpzkfsnmtztrovexcw`) only:

```sql
-- 1. Ledger names (already read once; repeat only if the founder wants a fresh copy)
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

-- 2. Physical objects (CANCELLED once — do not run without explicit founder permission)
select jsonb_build_object(
  'tables', jsonb_build_object(
    'ai_talk_creations', to_regclass('public.ai_talk_creations') is not null,
    'ai_talk_selection', to_regclass('public.ai_talk_selection') is not null,
    'ai_talk_origin_imports', to_regclass('public.ai_talk_origin_imports') is not null,
    'ai_talk_direction_transfers', to_regclass('public.ai_talk_direction_transfers') is not null,
    'ai_live_observed_items', to_regclass('public.ai_live_observed_items') is not null,
    'ai_live_turn_bindings', to_regclass('public.ai_live_turn_bindings') is not null,
    'architect_origin_projects', to_regclass('public.architect_origin_projects') is not null,
    'health_workspaces', to_regclass('health_private.workspaces') is not null
  ),
  'finalFunctions', jsonb_build_object(
    'saveCreation', to_regprocedure('public.ai_talk_save_creation(uuid,uuid,uuid,text,uuid,jsonb)') is not null,
    'importOrigin', to_regprocedure('public.ai_talk_import_origin(uuid,uuid,uuid)') is not null,
    'observeTrusted5', to_regprocedure('public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)') is not null,
    'observeTrusted4', to_regprocedure('public.ai_live_observe_trusted_item(uuid,uuid,text,text)') is not null,
    'bindFinished', to_regprocedure('public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)') is not null,
    'retainDesign', to_regprocedure('public.architect_apps_retain_design(uuid,uuid,text,jsonb,text,boolean)') is not null,
    'originSave', to_regprocedure('public.architect_origin_save(uuid,uuid,integer,jsonb,text)') is not null
  ),
  'grants', jsonb_build_object(
    'observeServiceOnly', has_function_privilege('service_role','public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)','execute')
      and not has_function_privilege('authenticated','public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)','execute'),
    'bindAuthenticated', has_function_privilege('authenticated','public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)','execute'),
    'importAuthenticated', has_function_privilege('authenticated','public.ai_talk_import_origin(uuid,uuid,uuid)','execute'),
    'obsoleteAckGone', to_regprocedure('public.ai_talk_record_origin_import(uuid,uuid,uuid,uuid,text)') is null
  ),
  'intendedTurnColumn', exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ai_live_observed_items' and column_name='intended_turn_id'
  )
);
```

Until query 2 is authorized and returned, Talk SQL is **unverified**, not missing and not applied.

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

- Merge target: GitHub `main` → existing Vercel production for `gent-ascend-collective-app`.
- Compatibility sequence: #131 (code + 18 SQL still unapplied) → optional text prove → #135 (no new SQL). Do not treat a #131 deploy as elevation-live.
- Rollback: revert the Talk merge commit(s) on `main` and redeploy the previous production SHA (`544c156` before #131). Do not roll back hosted SQL; new Talk tables/RPCs are additive. If a Talk apply must be stopped mid-sequence, leave applied versions in place and resume from the next **name-absent and object-absent** file. Never rename an existing hosted row.

## Bounded live verification (after deploy, authorized separately)

Text-first (proposed cap: one chat completion, well under $1):

1. Sign in as the founder on `www.gentascend.com/app/aethelios`.
2. Send one new message. Confirm a streamed reply, saved turn, and the same turn after reload.
3. If Talk SQL is verified present: open a brief, change Purpose, send, save, reopen. Unrelated fields stay unchanged. If Talk SQL is still unverified, stop after step 2.

Voice (proposed cap: one 30–60s Realtime call, stop if admission is not 2xx):

1. Same conversation, start Live.
2. If admission is not 2xx, record sanitized stage/category/providerStatus and stop. Do not retry-spend.
3. If admitted and #135 is deployed: speak a Purpose edit, switch field to Audience while the call is up, speak a second edit, return to text, save and reopen. Only intended fields change.

## Smallest next authorization

1. **GitHub:** merge #131 onto current `main` `544c156` after required checks are green on the published head. This is the only merge requested now.
2. **Database (separate):** permission to run the physical-schema query above on `volpzkfsnmtztrovexcw`, then apply only files that are both ledger-absent by name and object-absent.
3. **Deploy / paid calls (separate):** production promote and the bounded text (then optional voice) plan.

Do not treat step 1 as completing steps 2–3.
