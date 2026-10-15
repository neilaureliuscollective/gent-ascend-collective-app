# Talk integrated release

Development publication only. No main merge, hosted migration, production deploy, credential creation or paid provider call without founder approval.

## Combined release tree

| Workstream | PR | Branch | Role |
|---|---|---|---|
| Foundation | #131 | `cursor/talk-creative-conversation-5b08` | Talk + current main (`b4d9f04`), official icon `c1c7fe4`, member Lifestyle |
| Elevation | #135 | `cursor/talk-elevation-5b08` | Stacks on #131. Dock, documents, selected-work, mid-call spoken target |
| Current main | — | `main` `b4d9f0496eee09ce92dfbf1c842205604c51efd0` | Already contains icon + Lifestyle |
| Health | #136 | do not absorb | Must renumber `20261015180000_health_workspace.sql` before its own merge |

Integration order: merge #131 onto current main, apply missing hosted SQL, deploy that SHA, prove one live text send, then merge #135. Do not force-push.

Conflicts against main were resolved on #131 (`quality.yml` keeps both member-lifestyle and Talk-auth steps; DECISIONS/STATUS keep icon, Lifestyle and Talk notes).

## Hosted ledger (read-only snapshot — not a live query)

`scripts/check-migration-ledger.mjs` last records Gent-owned hosted files through `20261012095801_studio_footage.sql` (Live through `20261012041646`, Studio narration/footage on 2026-10-12). This environment could not open hosted `schema_migrations` on `volpzkfsnmtztrovexcw`.

First hosted action, before any apply: in the Supabase SQL editor for **Gent Ascend App** (`volpzkfsnmtztrovexcw`), run a read-only:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Apply only versions that are absent. Never rename a row that is already present.

### Already on current main, missing from the 2026-10-12 snapshot

These may already be applied by later production work. Confirm against `schema_migrations` before re-applying:

1. `20261002141618_ascend_daily_command.sql`
2. `20261002165518_account_claim.sql`
3. `20261004180000_member_product_cabinet.sql`
4. `20261004222000_grooming_daily_intelligence.sql`
5. `20261005122500_proactive_signal_receipts.sql`
6. `20261006034533_company_workspaces.sql`
7. `20261006042134_connected_company_work.sql`
8. `20261006103930_public_intelligence_missions.sql`
9. `20261012065807_health_foundation.sql`
10. `20261012230000_architect_origin.sql`
11. `20261013160000_architect_construct.sql`
12. `20261013180000_architect_construct_worker_plane.sql`
13. `20261013183000_service_connections.sql`
14. `20261013193000_architect_construct_isolation.sql`
15. `20261013194500_connection_trusted_writes.sql`
16. `20261013203000_connection_broker_role.sql`
17. `20261013220000_architect_construct_lease_freshness.sql`
18. `20261013230000_architect_construct_finish_event.sql`

### Talk/Architect predecessors not on main (required for this release)

Apply in this exact order after the confirmed main/hosted baseline. Do not stop at `15180000`/`15190000`.

1. `20261013240000_talk_creation.sql`
2. `20261013250000_talk_image_entitlement.sql`
3. `20261013260000_talk_creation_candidates.sql`
4. `20261014010000_talk_origin_import.sql`
5. `20261014020000_talk_origin_import_bind.sql`
6. `20261014030000_talk_origin_import_atomic.sql`
7. `20261014040000_talk_origin_import_consistency.sql`
8. `20261014100000_talk_design_board.sql`
9. `20261014120000_talk_live_bindings.sql`
10. `20261014130000_talk_direction_transfers.sql`
11. `20261014140000_talk_live_bind_authority.sql`
12. `20261015080000_architect_apps.sql`
13. `20261015120000_architect_apps_durable.sql`
14. `20261015140000_architect_apps_mutation.sql`
15. `20261015160000_architect_apps_retain_authority.sql`
16. `20261015170000_architect_apps_retain_provenance.sql`
17. `20261015180000_talk_live_trusted_observe.sql`
18. `20261015190000_talk_live_bind_intended_turn.sql`

Do not rename these files. They are published on #131. Isolated local `db:ledger` still matches the 2026-10-12 snapshot hashes; it does not prove hosted apply.

Health #136’s `20261015180000_health_workspace.sql` is not on this tree. If hosted ever applied a different `20261015180000`, stop and reconcile by applied history. Talk does not absorb Health.

## Environment (names only)

Hosted fixtures must stay unset: `AETHELIOS_TALK_CREATION_FIXTURE`.

Text (independently releasable):

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

## Production target and rollback

- Merge target: GitHub `main` → existing Vercel production for `gent-ascend-collective-app`.
- Rollback: revert the Talk merge commit(s) on `main` and redeploy the previous production SHA (`b4d9f04` before #131). Do not roll back hosted SQL; new Talk tables/RPCs are additive. If a Talk apply must be stopped mid-sequence, leave applied versions in place and resume from the next missing version.

## Bounded live verification (after deploy, authorized separately)

Text-first (proposed cap: one chat completion, well under $1):

1. Sign in as the founder on `www.gentascend.com/app/aethelios`.
2. Send one new message. Confirm a streamed reply, saved turn, and the same turn after reload.
3. Open a brief, change Purpose, send, save, reopen. Unrelated fields stay unchanged.

Voice (proposed cap: one 30–60s Realtime call, stop if admission is not 2xx):

1. Same conversation, start Live.
2. If admission is not 2xx, record sanitized stage/category/providerStatus and stop. Do not retry-spend.
3. If admitted: speak a Purpose edit, switch field to Audience while the call is up, speak a second edit, return to text, save and reopen. Only intended fields change.

## Smallest next authorization

Approve merge of #131 onto current `main` `b4d9f04`. That is the only action requested now. Hosted SQL, production deploy and paid calls stay unauthorized until that merge SHA exists.
