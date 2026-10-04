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

Real Supabase Auth/PostgREST and founder-authenticated evaluation remain distinct from PGlite SQL tests and browser fixtures. This workspace has no Docker daemon/CLI and no founder browser session; those gates cannot be claimed from emulation. Production merge must wait until mandatory live-account validation is complete. The secure browser sign-in request was declined; no credentials were obtained and no authentication workaround was attempted.

## Original history preserved

`docs/releases/recovered-command-source.bundle` contains the original three commits and their original Git object identities, including `ea2b29dd69a960d815fea75b598f00ac65d4303c` and `3f2a69e673cba73eb9a8e3bd6d5a0a24fc4e445c`. `git bundle verify` passed. Its prerequisite `e9691e48c0ae2b2dd45c9983abea24056eddb7f7` is already in main history. Future inspection can fetch the bundle into a separate archive ref; do not reset main to it. This preserves exact unpushed history durably even though the connector-created integration commit has a different identity.

## Final regression comparison

The full integrated browser run executed 246 cases: 238 passed and 8 failed. Re-runs of the two Daily Command failures passed (2/2) in fresh browser workers; their first failures were `browserContext.newPage` lifecycle crashes in the single-process restricted runner before an app page opened. The 1440px photography case passed on unchanged main and is included again in final integrated checks.

Unchanged `24fd50b` main reproduced the two Vitalis 3D failures, commerce no-JavaScript discovery failure, and the two Fold-width ritual image-count assertions (344/768). None of their production source files are changed by this phase. The baseline run also exposed a commerce alternative-availability failure that the integrated full run passed; no unrelated test or product behavior was weakened to silence it. These are documented baseline failures, not grounds to claim a fully green whole-repository browser suite.

Current production remains `24fd50bb78e0fca59eb1c64b55a6b7a0b75d1b36`; no merge or production deploy performed. Draft PR47 contains the complete forward integration, and preview deployment `dpl_FyehQHYv3LUZYyhSQZsGjHihWbLP` is READY for integration SHA `63430a34cfcd5384bec3f294fec6db89df9d15a6`. Its Git tree was verified byte-for-byte against the local integration. Deployed `/app` was inspected in the browser and renders the recovered Command with current energy, saved-source hierarchy and direct domain doors. Signed-out preview is not founder-authenticated proof.

Additional primary research: Microsoft HAX guidelines (https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) support explicit capabilities, uncertainty, correction and user control; recovered sourced receipts and confirmation guards already implement the relevant boundaries. Mercedes-Benz zero-layer HMI (https://group.mercedes-benz.com/technology/digitalisation/connectivity/mbux-hyperscreen.html) informs immediate contextual primary action with supporting services beneath it. This is an interface hierarchy reference, not an assertion of learned preferences or sensor integration.

## Final acceptance before handoff

Final lint, strict typecheck, production build and all 251 unit/SQL tests passed after integration. The 56-case targeted run passed 55 cases; the new no-JavaScript case found the workspace's streaming loading boundary. Fixed the actual fallback rather than claiming hidden streamed data was visible. The loading boundary now provides a conditional JavaScript/reload explanation and real public/member exits. Final re-run of that fallback plus Fold resize and owner/session clearing passed 3/3. The 31-case Command/shell run passed all other 30 cases, and its remaining no-JavaScript case passed after the fallback correction. Arrival/intro, Daily Command, domain navigation, photography, reduced motion, graphics loss, enlarged text, stale-source/owner/day/version, uncertainty and confirmation checks passed in the recorded targeted runs.

Final seven-viewport audit: zero page errors, zero document overflow at 344×740, 390×844, 360×640 (200% text), 768×900, 820×1180, 1440×900 and Ambient 390×844. One bounded optional canvas in Ambient; none after Still. Phone header was tightened with a 44px replay target; primary move top 544px at 344×740 and 636px at 390×844. Large text retains natural vertical scrolling. Updated evidence in docs/validation/command-recovery/.

Release remains blocked on mandatory real founder-authenticated validation. Physical-device evaluation is unrun and remains a post-release founder check; browser Fold widths and continuity have been verified. Authenticated save/reload cannot be substituted with fixture assertions, admin SQL or a forged account/session. Sign-in was declined; no production release occurred. Resume with secure founder sign-in on the current PR preview, validate actual saved arrival/readback, Command, Performance, Grooming and intended intro, then use the existing release authorization to merge the exact validated head and verify its production alias/SHA.
