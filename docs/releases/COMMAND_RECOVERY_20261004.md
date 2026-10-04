# Command recovery and forward integration · 2026-10-04

## Source recovery

Recovered the real checkout at `/workspace/scratch/f76a7f737c6e/gent-ascend-collective-app`, branch `feat/immersive-command`. Clean tree, empty stash, reflog confirms the full sequence. No later unreachable commit found by fsck. HEAD is `3f2a69e673cba73eb9a8e3bd6d5a0a24fc4e445c`; the missing `ea2b29dd69a960d815fea75b598f00ac65d4303c` is its parent. Recovery uses actual code, not a reconstructed concept.

Integration starts at current production main `24fd50bb78e0fca59eb1c64b55a6b7a0b75d1b36` in a fresh worktree, branch `release/recovered-command-oct4`. No reset, force push or superseded branch merge.

| Source | Disposition | Result |
| --- | --- | --- |
| `1b94b33148b8a50a034181c2ffe88fb8ad325ba4` | Recover + reconcile | Sourced briefing, spatial Command, lazy deeper workspace, source inspection and versioned daily model/service. Resolve main route conflict without deleting Daily Command. |
| `ea2b29dd69a960d815fea75b598f00ac65d4303c` | Recover exactly | Current flowing EnergyOrb, chamber, source connections, shared Aethelios shortcut, renderer caps/fallback. |
| `3f2a69e673cba73eb9a8e3bd6d5a0a24fc4e445c` | Recover + reconcile | Request-time briefings, confirmed carry-forward, completion, changed-source checks, same-owner/day/version guards, mounted change detection, draft isolation and uncertain-write locks. |
| Current main PR46 | Preserve | Latest Performance, Grooming, Machine Scout, Daily Command backend/migration and real save/reload workspace. |
| Old arrival video wiring | Replace cleanly | Recovered commits did **not** contain a newer intro film. Public replay explicitly loaded `collective-journey-v1.mp4`; remove that retired film from the sequence and use the existing current crest and EnergyOrb. |
| Historical divergent/superseded branches | Do not merge | No unique behavior needed from these branches. |

## Integrated product

`/app` always renders recovered Command, including authenticated users. The production route previously selected the basic Daily Command workspace instead, hiding the cinematic generation. Independent server reads load sourced Command and real Daily Command in parallel. Arrival context connects as a labeled operating-state summary, with unknown/unavailable values kept explicit. Readiness is product guidance, never a physiological reading. Context refresh revalidates owner/day, clears on session loss, and degrades independently.

`/app/arrival` preserves the full Daily Command arrival, review and outcome workflow with unchanged API/RPC ownership, optimistic version and idempotency contracts. Existing `/app/daily` remains the general daily-record workspace. Command offers direct Aethelios, Performance and Grooming doors; no commerce-led member hierarchy.

Private arrival: nonblocking 1.8-second presentation only, once per session; installed/standalone skips automatic playback, explicit replay remains available. No data remount or model call. Still/reduced motion bypass. Public arrival: crest to current energy, bounded 6.5 seconds, immediate skip, no old video, no-JS link to world, remembered repeat entry. Public current cinematic world and commerce remain intact.

## Research and implementation decisions

Reviewed official sources on 2026-10-04:

- Apple spatial layout: https://developer.apple.com/design/human-interface-guidelines/spatial-layout/ — center the decisive content, modest depth, restrained peripheral motion. Applied existing recovered field, not a new renderer.
- Samsung foldable design: https://developer.samsung.com/one-ui/largescreen-and-foldable/designing_for_foldable.html — cover/inner display hierarchy and continuity. Existing component identity is retained through viewport resize; supporting doors wrap instead of shrinking desktop panels.
- Samsung continuity: https://developer.samsung.com/sdp/blog/en/2021/09/14/adapt-your-app-to-foldable-devices-for-an-optimal-user-experience — do not lose current state on unfolding.
- Installed Next16.3.5 fetching-data/data-security guides — parallel independent server-domain reads, session-bound authorization, no private shared cache or internal HTTP from server components.
- Existing scoped agent/workflow research in COMMAND_ORCHESTRATION.md remains applicable. No model orchestration/provider/library expansion needed for this release.

No dependency or schema change, no free-account activation, no new access grant. Supabase production ledger independently checked through the connector: `ascend_daily_command` is applied (hosted version `20261004081328`). Daily entries/actions/reviews/command records/revisions have RLS enabled; existing daily_save, daily_complete_action and daily_command_save RPCs exist. No production data mutation performed.

## Release gates

Results will be appended after the complete browser regression/baseline comparison. Real Supabase Auth/PostgREST and founder-authenticated evaluation remain distinct from PGlite SQL tests and browser fixtures. This workspace has no Docker daemon/CLI and no founder browser session; those gates cannot be claimed from emulation. Production merge must wait until mandatory live-account validation is complete.
