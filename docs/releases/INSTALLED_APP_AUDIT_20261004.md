# Installed app / complete integrated generation audit · 2026-10-04

Founder authorized inspection and correction of missing current installation identity and explicitly forbade publishing an older build.

## Actual production findings

Connected Vercel deployment inspection still maps `www.gentascend.com` to production `24fd50bb78e0fca59eb1c64b55a6b7a0b75d1b36`, deployment `dpl_6SNhERfpZCkYsC6zN9SPMTZ6VpTM`. HTTP 200 production manifest still contains the old `/icon.svg` and September star/laurel `icon-v2` assets. PR47's recovered Command was preview-only, never promoted.

The October 3 full-crest commit `32ffd50` and `docs/FULL_CREST_INTEGRATION.md` explicitly excluded installed icons/manifest. This explains the mismatch independently of device caching. A large standard 512px PNG was also absent: the 512px entry was maskable only and the generic SVG competed for standard icon selection. Exact browser choice on Neil's device is unknown.

## Recovery and reconciliation matrix

| Surface / work | Source check | Integrated disposition |
| --- | --- | --- |
| Command chamber + flowing sphere | Exact local `ea2b29d`, parent of original HEAD `3f2a69e`; clean original checkout/reflog | Retained in PR47; no older presence/star artwork imported into Command |
| Server prepared briefing, confirmed next move, completion | Actual subsequent `3f2a69e`; service/API and owner/day/version/source guards inspected | Retained and reconciled forward; suggestion requires deliberate confirmation, no fabricated facts |
| Newer local work after `3f2a69e` | Original working tree clean, empty stash, reflog ends at `3f2a69e`, prior fsck no later unreachable commit | No unsupported recovery claim; verified original Git bundle already tracked |
| Public and private arrival | Existing main film wiring + current recovered EnergyOrb | Retired film removed; brief private arrival, standalone fast return, replay/Still retained |
| Current full crest | Main `32ffd50`, tracked approved alpha rendition | Preserved; **now extended to actual app/browser/Apple icons** under this founder instruction |
| Daily Command backend/workspace | `feat/ascend-daily-command` compared to main | Domain/workspace paths equal to main; existing RPC/version/request-id flow preserved at `/app/arrival` |
| Grooming Concierge, Scan, My Look | Six branch changes are patch-equivalent to main; component directory identical | Preserve main exactly |
| Performance / Freestyle / Machine Scout | Branch patch-equivalence plus remaining main deltas inspected | Preserve main fixes: accessible quick-add, Image lint fix, initial view and direction editing contract |
| Commerce, photography, public world, Supabase migrations | Integration diff contains no changes in their domain/schema paths | Preserve main; no migration, reset, grant or account-claim activation |
| Superseded arrival/interaction/public world branches | Refreshed origin refs; 0 ahead of main | No merges |
| Historical divergent founder/AI branches | Listed during broad branch audit, old base | No blanket integration or auth expansion |
| Separate Aethelios application checkouts | Different application tree (`app/`, separate source snapshots) | Not Gent source; no cross-project overwrite |
| Separate Gent promotional film exports | Creative plan explicitly labels concept film/interface and references earlier repo source | Marketing deliverables; not a recovered private arrival implementation; do not substitute a 60/90-second campaign for app return |

## Implemented installation correction

`scripts/current-app-icons.mjs` deterministically resizes and pads the existing approved full crest. No image generation, redraw, crop, recoloring or source-master mutation. Opaque obsidian backgrounds; standard 192/512px PNGs at versioned October 4 URLs, separate maskable 512px PNG with entire crest inside the central 80% safe circle, matching Apple 180px and browser 64px icons. Removed old SVG metadata file and SVG manifest candidate. Stable manifest ID `/`, scope `/` and start `/app` preserve the application's identity and Command entry.

Static fallback worker advances from v3 to v4 after all required files cache successfully, calls `skipWaiting` and claims clients. Only old Gent fallback caches are removed; unrelated caches and IndexedDB/offline training drafts are untouched. Runtime registration uses `updateViaCache: none` and bounded update checks on visibility/online return. No automatic page reload or private HTML/API caching. An open page keeps its state; a subsequent online launch fetches the current app.

Install guidance explains the browser's app identity review and reinstall option, with a reminder to sync device-only training drafts first. Saved server account records survive removal/reinstallation.

## Current official research

- Chrome's January 21, 2026 update guidance: icon URLs/metadata must change for Chrome144+ to detect identity changes; the user may review app-name/icon updates separately. https://developer.chrome.com/blog/improvements-to-web-app-updates
- Worker lifecycle reviewed: static-cache install/activation, updateViaCache, skipWaiting and scoped cleanup. https://web.dev/articles/service-worker-lifecycle
- Web manifest standard: distinct icon purposes and stable ID. https://www.w3.org/TR/appmanifest/
- Installed Next16.3.5 documentation: metadata image files emit size/type and generated icon URLs; the manifest is a cached metadata route. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/{app-icons,manifest}.md`.

A correct fresh-install manifest/asset response is verifiable here. Physical Samsung launcher replacement timing and a real WebAPK installation cannot be claimed from browser emulation.

## Validation and release

Lint, strict typecheck, 251 unit/SQL tests and production build pass for the icon/runtime changes. Initial 45-case affected browser run: 44 passed; one new maskable safe-area assertion found a single faint edge pixel outside the safe circle. Padding was corrected without weakening the test. Final installation/standalone/offline re-run: 7/7 passed, including that corrected assertion, cache cleanup without page reload, Android and Apple standalone fast return with replay, offline Performance and personal-cache exclusion. Thus all 47 distinct affected scenarios have passing evidence across these runs; this is not a second full-repository green run. Earlier full-suite baseline failures remain documented in COMMAND_RECOVERY_20261004.md. Physical launcher installation is unrun. No database changes required; existing migration ledger and hosted read-only RLS/RPC verification from COMMAND_RECOVERY_20261004.md remain applicable.

Production authorization is already granted. The original mandatory founder-authenticated save/reload gate remains unverified after the secure sign-in request was declined. No session fabrication, admin-as-user test, retry of refused authentication, or partial production push is authorized by this audit. Complete that real flow before promoting the whole integrated generation. This is a validation/access requirement, not a request for another deployment approval.
