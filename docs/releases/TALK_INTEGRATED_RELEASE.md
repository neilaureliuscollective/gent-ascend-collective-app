# Talk integrated release

Development publication only. No main merge, hosted migration, production deploy, credential creation or paid provider call without founder approval.

## Published heads

| Workstream | PR | Branch | SHA |
|---|---|---|---|
| Foundation | #131 | `cursor/talk-creative-conversation-5b08` | `ddfd4978a3ccd0930123c2cd561eb70bc6f74505` |
| Elevation + selection fix | #135 | `cursor/talk-elevation-5b08` | (this branch head) |
| Current main | — | `main` | inspect `origin/main` before merge |
| Health (collision only) | #136 | `cursor/health-transformation-36d4` | do not absorb |

Dependency: #135 stacks on #131. Merge #131 to current main first, then #135. Do not force-push either history.

## Migrations (Talk)

Apply only after founder authorization, in this order, on an isolated then hosted database:

1. Existing Talk/Architect stack already on #131 through `20261015170000_architect_apps_retain_provenance.sql`
2. `20261015180000_talk_live_trusted_observe.sql`
3. `20261015190000_talk_live_bind_intended_turn.sql`

Do not rename these Talk files. They are published on #131 and may already be applied locally.

### Known collision (unmerged Health)

Health #136 also uses `20261015180000_health_workspace.sql`. That file is **not** on main and is **not** applied by this Talk stack. Health must choose a later unused version before it merges. Talk does not absorb that branch.

## Environment (names only)

Hosted fixtures must stay unset: `AETHELIOS_TALK_CREATION_FIXTURE`.

Text:

- `OPENAI_API_KEY` present on the deployed project that should serve Talk
- `AURELIUS_AI_MODEL` (defaults in code if unset)
- Auth/session against the same Supabase project as RLS

Voice, independently:

- `AETHELIOS_LIVE_ENABLED=true` only when the founder authorizes Live
- `SUPABASE_SERVICE_ROLE_KEY` server-only for trusted observe
- Realtime project/model access on the same OpenAI project as the key
- Browser secure context + microphone permission

Key presence does not prove the funded project or model access. Production HTTP 400 and paid audio remain unconfirmed until a founder-authorized live call.

## Smallest production step

1. Founder approves merge of #131 onto current `main` (resolve the official app icon / Lifestyle commits; do not drop `c1c7fe4` icon work).
2. Apply Talk migrations `15180000` then `15190000` on hosted Supabase.
3. Deploy that main SHA.
4. Send one authenticated text message, reload, confirm the saved turn.
5. Merge #135 after #131 is on main.
6. Voice stays unavailable in UI until Live env + observe RPC + a confirmed non-400 admission.

## Conclusions

- **Text:** code-ready once the deployed key, Auth and route are the funded project. Fixture answers are not live-model proof.
- **Voice:** not release-ready. Admission HTTP 400, paid audio, physical-device capture and trusted-observe hosted apply remain unrun.
- **Database:** Talk sequence is unique on this stack. Health must renumber `20261015180000` before its merge.
- **Approval needed:** main merge, hosted SQL apply, production deploy, any paid provider call.
