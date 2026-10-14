# Aethelios Command — immersive home and work continuity

Implemented 2026-10-14 on `cursor/aethelios-command-home-6146` from released main `f583d57`. Draft only. No production merge, hosted migration, credentials, Connections setup, voice, health or commerce work.

## Routing change

`/app` is no longer a founder/Talk redirect. It is the shared authenticated Command home.

| Actor | Previous `/app` | Current `/app` | Sign-in destination |
| --- | --- | --- | --- |
| Anonymous | Redirect to `/app/aethelios` | Command shell with sign-in. Private API remains 401. | `/enter` |
| Ordinary signed-in user | Redirect to `/app/aethelios` | Command home from owner-scoped reads | `/app` (unchanged) |
| Founder | Redirect to `/app/founder` | Same Command home. Founder Office stays at `/app/founder`. | `/app/founder` (unchanged) |

Local harness `enterFounder` follows `/app` so the founder also opens the shared home. Public authenticated `/`, `/experience` and `/enter` already rewrite to `/app` and now stay there. Founder Office remains linked from Command and from the existing `/app/founder` destination after `/enter` password sign-in.

Deep links to Talk, Architect, Studio, company jobs and Founder Office are unchanged. The wordmark and manifest `start_url` already pointed at `/app` and now open Command. Main navigation adds **Home** → `/app`. The working heading is **Command**. Talk Tools already linked Home to `/app`.

`/app` matching for `aria-current` is exact so Home is not current on every `/app/*` route.

## What is real

Owner-scoped read adapter `readCommandHome`:

- Architect Origin library and selected project documents/blueprint excerpts when `ARCHITECT_ORIGIN_ENABLED=true`.
- Company rooms and latest saved work versions, including documented gaps and unreviewed revisions.
- Studio projects and latest versions when the account has `aurelius.context`. Complete images use the existing authorized `/api/studio/image` route.
- Recent personal Talk titles.

Needs you only lists those recorded items. A review suggestion is labelled separately from a running Architect generation. Ordinary users never call `founderSession`, founder approvals or Connections APIs.

Continue/Review uses existing routes:

- Architect: `/app/architect?project=` and, for a draft document, `&document=&view=document`.
- Company work: `/app/companies/{company}/work/{job}`.
- Studio: `/app/studio?project=` and optional `&version=`.
- Talk: `/app/aethelios?conversation=`.

Limitation: Architect restores the saved project, not canvas scroll or unsaved Origin draft panels. Home does not reconstruct a Talk thread.

## Conversation

Command does not embed Talk’s state machine. The composer stages the existing memory-only draft handoff once, with optional `commandFocus` payload and conversation id. Thinking aloud does not send, enqueue a build or start paid work. Fresh conversation is explicit. A thin Talk wrapper shows the named focus without taking the draft.

Unsent Command text is React state (resize and panel close). Transfer to Talk uses the existing in-memory handoff, not URL or browser storage.

## Coordination

- Talk PR #121 remains the import/recovery owner. This branch does not edit `workspace.tsx`, draft-handoff, intelligence, artifacts or Talk migrations.
- Architect PR #122 remains the source-review owner. This branch does not edit architect-construct or architect-origin workbench files. It imports released `isolateStaticHtml` / `PREVIEW_SANDBOX` for on-demand saved HTML only.
- Connections database setup is untouched.

## Visual

Command uses smoked graphite `#111111` / `#1A1A1A` / `#242424`, localized emerald, and Reserve Gold `#C4912F`. No WebGL, autoplay, metric boxes or running preview iframes on open. One isolated static preview iframe starts only on demand.

## Remaining gates

Harness `enterFounder` and authenticated public `/` `/experience` `/enter` now land on Command `/app`. Founder Office stays at `/app/founder` after `/enter` password sign-in and from the Command founder operations link. Sidebar footer is in-flow so the seventh Home destination does not cover the Aethelios trigger.

Exact-head `9e4bc3949b59a4aba63d35d18c0edf5b2e6a7e82`: Quality application and database, Obsidian visual, Live build-and-interactions, Live local-auth, Lifestyle, Studio and Vercel passed. Production-entry stays main-only. Real disposable Auth with two owners, expired Studio image after a revoked session, and physical Fold remain unrun. Fixture evidence is labelled and separate from persistence.
