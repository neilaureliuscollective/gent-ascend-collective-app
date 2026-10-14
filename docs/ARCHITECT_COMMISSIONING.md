# Architect commissioning — usable saved projects

Date: 2026-10-14. Branch `cursor/architect-creation-journey-165a`. Reviewed head before this correction: `ef5f93d128720737b72a150366c9510acd6975cc`. No production merge, hosted migration, credential write, OAuth grant, paid model call, or infrastructure purchase.

## Incorporated heads

| Workstream | PR | Exact head | In #120 |
| --- | --- | --- | --- |
| Architect Construct | #116 | `ef3741e81fe7ef931cdc1054f7ffc49d86c6dfca` | yes |
| Connections | #117 | `c5581234b6badf2d8dcf0b9ed21fb91256897b5f` | yes |
| Architect immersive UI | #119 | `7e0cf2c4534a3f8d88e337b22af8f127c0301a5b` | yes |
| main | #118 | `9dda52549dac548b59b3e3175f2ee832cb4ed471` | yes |
| Talk conversational creation | #121 | `75605834df83bc907e3bed29bd5ebf5f07071798` | **no — keep on Talk** |

Talk overlap remains `docs/STATUS.md`, `docs/DECISIONS.md`, and additive `src/platform/supabase/database.ts` types. This branch does not acknowledge `talk-architect-handoff/v1`.

## Three different products

Do not treat these as one switch.

| Capability | What the founder can do | Required |
| --- | --- | --- |
| Entrance only | Open `/app/architect`, read the starters, see “Project persistence is not active.” `Create & save` stays **disabled**. | Merge/deploy of this UI with `ARCHITECT_ORIGIN_ENABLED` false. **This is not a working studio.** |
| Saved-project use | Create, save, reopen, switch, and edit person-owned Origin projects and revisions. | `20261012230000_architect_origin.sql` applied on the target database **and** `ARCHITECT_ORIGIN_ENABLED=true`. Signed-in session. Existing publishable Supabase URL/key for that environment. |
| Isolated execution | Queue a Construct run, worker claim, Docker sandbox, cancel with confirmed teardown. | Origin saved-project setup **plus** Construct migrations, `ARCHITECT_CONSTRUCT_ENABLED=true`, matching DB URL/key, server-only `SUPABASE_SERVICE_ROLE_KEY`, `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32), supervised worker **off Vercel**, Docker. |
| Model-generated test | Propose a bounded patch with the live OpenAI adapter, then execute it in isolation. | Non-production only. All execution requirements **plus** `ARCHITECT_CONSTRUCT_AI_ENABLED=true`, server-only `OPENAI_API_KEY`, explicit funded-test authorization. Credit alone is not enough. |
| Publishing | Push, merge, or Vercel deploy from Architect. | **Not implemented.** Connections are read-only. Connecting an account ≠ executing a build ≠ publishing. |

`ARCHITECT_ORIGIN_AI_ENABLED` is a separate Origin proposal flag. It is not required to save projects.

## Hosted inspection (read-only, 2026-10-14)

| Check | Result |
| --- | --- |
| Production `/app/architect` | Entrance is live. Copy: “Project persistence awaits activation.” Starters render. Saving is not active. |
| Hosted migration ledger snapshot (`scripts/check-migration-ledger.mjs`) | Ends at `20261012095801_studio_footage.sql`. **`20261012230000_architect_origin.sql` and all Construct/Connections migrations are absent.** |
| Vercel project `gent-ascend-collective-app` env names | **Unverified.** No Vercel CLI credentials in this runtime. Presence of `ARCHITECT_ORIGIN_ENABLED` or `SUPABASE_SERVICE_ROLE_KEY` was not read. |
| This runtime `.env*` | Only `.env.example`. All secret values unverified. |
| Docker / local Supabase | Unavailable here. |
| Durable worker on production | **Not assumed.** `constructWorkerAuthorized` refuses `APP_ENV=production` and any `VERCEL` / `VERCEL_ENV`. A passing CI smoke does not prove production is configured. |
| Worker disguise | Forbidden. Setting `APP_ENV=local` on Vercel is rejected by `parseEnvironment`. Do not run a production worker as development. |

## Worker names (from code)

`createWorkerConstructStore` requires `supabaseConnection(env)` **and** `SUPABASE_SERVICE_ROLE_KEY`. In non-production, the connection is `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the **same** database the app uses. The worker also requires `ARCHITECT_ORIGIN_ENABLED=true`, `ARCHITECT_CONSTRUCT_ENABLED=true`, `ARCHITECT_CONSTRUCT_WORKER_TOKEN` (≥32), `APP_ENV` not `production`, and no `VERCEL`/`VERCEL_ENV`.

Startup command: `npm run architect:worker:supervised` (or `ARCHITECT_CONSTRUCT_WORKER_MODE=supervised npm run architect:worker`).

Those names must never appear with values in logs, docs, chat, client bundles, or generated-code containers. `sanitize.ts` redacts `SUPABASE_SERVICE_ROLE_KEY` and `ARCHITECT_CONSTRUCT_WORKER_TOKEN`. Docker args reject those names.

## Release recommendation for usable saved projects

**Do not ship an all-flags-off merge and call it a working Architect studio.** That only republishes the entrance already visible on https://www.gentascend.com/app/architect.

The smallest safe sequence that lets the founder **save and use projects** on the canonical app / Vercel project `gent-ascend-collective-app`:

1. Founder-approved apply of **only** `20261012230000_architect_origin.sql` on the canonical Gent database already bound to that Vercel project.
2. Set `ARCHITECT_ORIGIN_ENABLED=true` in Vercel for the intended environment (Production if that is the chosen save target; Preview if the first save target is the READY preview).
3. Leave `ARCHITECT_CONSTRUCT_ENABLED`, `ARCHITECT_CONSTRUCT_AI_ENABLED`, `ARCHITECT_CONSTRUCT_AI_MOCK`, and `ARCHITECT_ORIGIN_AI_ENABLED` **false**. Do not add a production worker.

Rollback: set `ARCHITECT_ORIGIN_ENABLED=false`. The Origin migration is additive; do not drop it without a separate recovery plan.

This still is **not** isolated execution, a model-generated build, or publishing.

### Later isolated model-generated test (non-production only)

On a founder-chosen **non-production** database and a Docker host that is **not** Vercel:

1. Apply Construct migrations after Origin: `20261013160000`, `20261013180000`, `20261013193000`, `20261013220000`, `20261013230000`.
2. Set `ARCHITECT_CONSTRUCT_ENABLED=true` on that non-production app env only.
3. On the worker host, set matching `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `ARCHITECT_CONSTRUCT_WORKER_TOKEN`, `ARCHITECT_CONSTRUCT_WORKER_MODE=supervised`.
4. Run `npm run architect:worker:supervised`. Success: `construct-worker: supervised start` and a queued fixture is claimed. Failure names are printed; values are not.
5. After isolated fixture execution is proven, founder-authorize a funded test, then set `ARCHITECT_CONSTRUCT_AI_ENABLED=true` on that same non-production env. Reuse existing `OPENAI_API_KEY` / `AURELIUS_AI_MODEL`. Credit alone is not sufficient.

A later **production** enablement of Construct would require a separate founder decision, a production-legal worker host that is still not Vercel, and a change to the current production worker ban. That change is **not** authorized here and must not be done by setting `APP_ENV=local` on the production project.

## First founder action

**Approve and apply `20261012230000_architect_origin.sql` on the canonical Gent Supabase project used by Vercel `gent-ascend-collective-app`.**

- Service/page: Supabase dashboard for that existing project → SQL editor, or `npx supabase db push` against that linked project only after you confirm the project ref.
- Setting/file name: `20261012230000_architect_origin.sql` (creates `architect_origin_projects`, `architect_origin_versions`, `architect_origin_runs`, and `architect_origin_save`).
- This is a **hosted migration approval**. This agent will not apply it.
- Verify: `npx supabase migration list` (or the dashboard migration history) shows `20261012230000`. The tables exist. Saving still stays off until the next step.
- Enables: the schema required for Create & save. Does **not** enable Construct, models, or publishing.

## Ordered checklist after that approval

Enter secrets only in the named service. Do not paste them into chat.

1. **Vercel → Project `gent-ascend-collective-app` → Settings → Environment Variables.** Set `ARCHITECT_ORIGIN_ENABLED` to `true` for the environment that should persist projects (Production and/or Preview). Redeploy that environment. Verify: signed-in `/app/architect` no longer says persistence is off; `Create & save` enables after a 3+ character idea; a saved revision reopens after reload. Enables: saved-project use.
2. **Optional, later, non-production only — Construct queue.** Apply the Construct migrations listed above on a non-production database. Set `ARCHITECT_CONSTRUCT_ENABLED=true` there. Verify: Construct no longer says execution persistence is off; enqueue returns `queued`. Enables: a durable queue that stays queued until a worker exists.
3. **Optional, later, non-production worker host (not Vercel).** Settings: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same database), `SUPABASE_SERVICE_ROLE_KEY`, `ARCHITECT_CONSTRUCT_WORKER_TOKEN`, `ARCHITECT_CONSTRUCT_WORKER_MODE=supervised`. Command: `npm run architect:worker:supervised`. Verify: supervised start; fixture claimed; cancel receipt `proof: confirmed` only if Docker observed the container RUNNING. Enables: isolated execution. Docker image `node:24-alpine`, `--network none`, nobody 65534.
4. **Optional Connections** remain read-only (`CONNECTIONS_CREDENTIAL_KEY`, `GITHUB_APP_*`, `VERCEL_INTEGRATION_*`, `NEXT_PUBLIC_APP_URL`). Connecting does not grant push or deploy.
5. **Optional funded non-production proposal** only after step 3 is proven: `ARCHITECT_CONSTRUCT_AI_ENABLED=true` plus existing `OPENAI_API_KEY`. Enables: labelled live proposals that still need explicit approval. Not a self-build claim.

## Evidence already retained

- Quality artifact `architect-construct-host-receipts`: host cancel `proof: confirmed` on CI Docker (MemoryConstructStore, not the durable SQL smoke).
- Origin local-auth durable smoke: enqueue, lost-response one-run retry, worker, isolated Docker, reload, owner isolation.
- Local/this runtime cancel receipt remains `proof: unavailable` (no Docker). That is not proof.

Preview for reviewed `ef5f93d`: https://gent-ascend-collective-7xqa0t66g-stutes-legacy.vercel.app — entrance/review only unless Origin is enabled on that preview.
