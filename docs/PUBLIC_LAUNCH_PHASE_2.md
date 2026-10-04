# Public launch Phase 2 — connected daily experience

October 4, 2026. Recovered Phase 1 from PR #52, exact head ebd224a302492330876518a5c3d5819f32e863b5, based on production main 6abfd6d. The Phase 1 build was intact and had passed its clean CI; hosted signup activation remains pending. This work is stacked on that branch. It does not deploy or activate signup.

## Inspection and build plan

Current Command already resolves saved action order and explicitly confirms completion/adoption. Grooming already saves active rituals and dated practice; Performance already resumes active sessions and retains complete session records. Council conversations use the same full-screen history/turn ledger. Reuse those flows rather than building duplicate editors or a second team. The missing connections were an accessible return path from Command, one dated cross-domain weekly projection, a reviewed coaching entry, and actual provider research tools across member text conversations.

1. Preserve Phase 1 and current production domains.
2. Read session-bound Daily, training and grooming records in parallel; project a seven-day member-calendar window with honest missing/unavailable states.
3. Connect Command to saved sessions, rituals and conversations; surface recorded activity in Progress and open an editable weekly-review prompt.
4. Share the same read-only OpenAI web search tool between Aethelios, each selected specialist and Table synthesis. Preserve provider sources in assistant text so streaming and saved history use the same citations.
5. Check domain boundaries, dates, read caps, source sanitization, compilation and interaction acceptance. Run full application and real local Supabase jobs through existing CI.

## Delivered behavior

- Command retains its current immersive identity and primary next move. A progressively loaded continuity section below it links the actual active training session, grooming rituals and latest saved conversation. No additional blocking Command-opening provider request.
- Progress presents actual seven-day action completion, completed training, days with grooming practice and confirmed daily reviews. Calendar dates use the verified member timezone; a late-night UTC completion belongs to the correct local day. Future and invalid records are excluded.
- Each ritual/day uses the latest check-in, so repeat logging does not inflate practice and a later explicit non-completion supersedes an earlier completion. No-record daily days are distinguished from zero completed actions. Failed or capped training/practice reads stay unavailable instead of looking like zero.
- Every domain query is filtered to the verified person and retains session RLS. A reused daily snapshot from another owner, timezone or day is rejected before further private reads. No personal browser persistence or shared server cache is added.
- Weekly review opens the existing full-screen Aethelios composer with an editable prompt. Sending and personal-context sharing remain explicit. Relevant consented requests receive bounded weekly counts, the current action/session and unavailable-source labels. Context contains no source row identifiers or private photos. Proposed adjustments still use the existing reviewed priority/action/routine flows; no automatic changes, new weekly-review ledger or AI memory.
- Aethelios, direct specialists, each selected Table perspective and synthesis have the same web_search provider tool. Tool policy prefers primary sources, requires returned evidence, treats retrieved instructions as untrusted, and directs generic queries without private member details. This is a model instruction, not proof that every possible query is private. Tools remain read-only, provider storage is disabled and each call is bounded to two hosted tool calls. No SDK, model, entitlement or price upgrade.
- Returned HTTP(S) sources are deduplicated, limited, Markdown-escaped and appended before completion/persistence. Source failures follow the existing incomplete-reply lifecycle. Sources are consulted evidence, not a guarantee that every generated statement is supported. Auxiliary title, summary and structured action/proposal generation do not browse; research belongs to member conversation paths.
- Composer disclosure describes relevant weekly context and public research. Existing Council cast/history and attribution stay intact.

## Research basis

Checked the pinned @ai-sdk/openai 4.0.72 / AI SDK 7.0.107 declarations and current official provider documentation: https://ai-sdk.dev/providers/ai-sdk-providers/openai#web-search-tool (webSearch, sources, maxToolCalls). Used installed Next16.3.5 data-security, server/client boundary and use-client guidance: authenticated domain layer, minimal DTOs and no model execution from rendering. Progressive disclosure reference: https://www.nngroup.com/articles/progressive-disclosure/. This informs hierarchy, not a measured retention claim. Applied the React checklist to parallel reads, server-only ownership, small serialized output, stable links, keyboard details/table semantics and responsive layouts.

## Acceptance and limits

Local lint, strict typecheck, all 311 unit/SQL/provider tests and migration-ledger validation pass. Production webpack build passes using an exactly lockfile-matched dependency tree linked from another checkout; clean standalone install/Turbopack build remains a CI gate. No new migrations or dependencies.

Added tests cover local-date boundaries including UTC-next-day training, actual source counts, latest ritual/day observation, owner/day snapshot rejection, per-query ownership, unavailable/capped reads, HTTP(S) source sanitization, provider source streaming and shared tool configuration. Added four browser cases at 360/768/1440 and reduced motion for saved-session/conversation links, weekly records, unknown states and review drafts. Extended the existing real Supabase first-session journey to render the connected Progress view without source failures.

The browser archive download returned truncated data in this runner. New interaction tests, actual Supabase/PostgREST and the full regression suite require the existing CI jobs. No local browser pass, hosted member session, real model/web-search execution, physical Fold/iPhone test or production release is claimed. Live research acceptance must check the configured provider/model on Aethelios, each specialist and Table with a current factual request, then reload citations from saved history. Provider search may add latency/cost within current call limits; observe real usage before tuning.

Phase 1's hosted email/OAuth/configuration/migration gates remain. Phase 2 implementation is reviewable; launch acceptance remains open until CI, actual model and physical-device checks pass. Revert these UI/research changes to roll back; member domain records and Phase 1 account receipts remain intact. No subscription or commerce flags change.

## Next

Two consolidated build phases follow: Phase 3 subscription/product revenue verification; Phase 4 release, device/performance acceptance, monitoring and support. Carry the live intelligence and hosted signup checks into the release ledger; phase count does not imply those checks passed.

## Publication blocker

Local implementation commit: 127f4b446b4f82b09becc5bab11855b2f0883db7. Automatic approval review rejected git push to the canonical repository because it did not recognize explicit authorization for exporting repository contents to that destination. No alternate publication route was attempted. Consequently the Phase 2 PR, clean CI installation/build, full browser and actual Supabase jobs have not been started. Local source and completed checks remain available for review; explicit destination authorization is the next required step. No production promotion was requested or performed.
