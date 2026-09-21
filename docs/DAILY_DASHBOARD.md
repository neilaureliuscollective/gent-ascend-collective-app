# Daily dashboard — research and build plan

2026-09-21. Founder authorizes the daily dashboard before service activation and explicitly defers every human/body model. Retain approved purple/gold identity; no placeholder body or invented biometrics.

## Product decision

The dashboard becomes the daily working home, replacing the large introductory hero. Its loop is arrive → choose → act → reflect. Aurelius remains a system-level companion with explicit conversation entry points. A hand-authored daily orientation is never labeled an AI-generated assessment.

Build now: today's intention; optional self-reported energy and sleep duration; up to five deliberate actions with reversible completion; seven/30-day observation history with missing-data gaps; an evening reflection; active goal and recent conversation entry points. Morning/evening lenses change emphasis without locking tasks to a time. The sample day uses only explicit synthetic records and in-memory edits, with no authentication bypass, API writes or browser persistence. Personal mode uses real session ownership when configured.

Do not add health/readiness/life scores, goals inferred from body ideals, unread-notification pressure, feeds, calendars without integrations, wearable claims or AI-generated advice without a model call. No punitive streaks or comparisons between users. No body renderer, scan vendor or new 3D asset dependency.

## Research → decisions

- Self-Determination Theory emphasizes autonomy, competence and relatedness. Apply it through user-chosen actions, visible follow-through, and supportive language. This is a design interpretation, not a claim of proven Aurelius retention. https://selfdeterminationtheory.org/theory/
- Harkin et al., progress-monitoring meta-analysis: monitoring interventions improved goal attainment on average; this does not establish outcomes for our app. Show honest records and completed actions, without requiring public sharing. Author-uploaded paper/abstract reviewed: https://www.researchgate.net/publication/291335719_Does_Monitoring_Goal_Progress_Promote_Goal_Attainment_A_Meta-Analysis_of_the_Experimental_Evidence
- Android tile guidance supports focused, glanceable information and a clear next action. Adapt that principle to the dashboard, not the watch layout itself. https://developer.android.com/design/ui/wear/guides/surfaces/tiles
- W3C complex-image guidance: provide a textual equivalent for chart information. Energy is an ordinal user report, never a medical score; expose exact dated values and gaps. https://www.w3.org/WAI/tutorials/images/complex/
- W3C target-size guidance: 24 CSS pixels is the AA minimum with exceptions; use 44px primary controls here. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- web.dev rendering and Web Vitals: avoid per-frame React state, unnecessary animation and expensive new dependencies; measure local payload, keep field thresholds distinct from measured results. https://web.dev/articles/rendering-performance and https://web.dev/articles/vitals
- Next Route Handlers and Supabase RLS: server validation, private no-store reads, owner-scoped queries, explicit grants/policies, transactionally consistent writes. https://nextjs.org/docs/app/api-reference/file-conventions/route and https://supabase.com/docs/guides/database/postgres/row-level-security

Apple HIG pages required JavaScript and were not treated as substantive evidence. Existing aesthetic research remains in AESTHETIC_ELEVATION_PROPOSAL.md.

## Visual hierarchy

Compact date/greeting and Today/Evening lenses. One large aubergine orientation card with the existing celestial Aurelius motif; adjacent personal check-in. A deliberate action list has more space than supporting goal/history cards. A gold/purple observation chart is balanced by a quiet evening reflection. Bottom contextual links lead deeper rather than exposing 25 navigation tabs. Keep full seal in branding, reserve most space for the person's actual day. No new animated backgrounds or body canvas.

Phone stacks by task priority; unfolded and desktop use asymmetric columns. Preserve keyboard focus, dialog closure/return, large text and reduced motion. No essential information depends on hover, animation or color.

## Implementation sequence and boundaries

1. Typed daily domain: one entry per owner/local calendar day plus normalized action rows. Source is explicitly user-reported. Persist timezone and optimistic version. A bounded snapshot RPC atomically saves entry and actions; rejects stale versions and the wrong local day. Other people's records cannot be referenced or read.
2. GET/PUT daily adapter and server-rendered initial projection. Existing goals/conversations are read, not duplicated. No model call during dashboard render. No billing gate for basic personal daily records.
3. Client dashboard with shared panels and bounded forms. Explicit sample mode changes local in-memory state only. No personal health/reflection text in localStorage, URLs or console logs.
4. Observation history, editable current-day check-in/reflection/action list, morning/evening lens, and allowlisted conversation starters. A starter prefills a draft; never sends automatically. New daily records are not silently added to AI memory or model context.
5. SQL/RLS and stale-version tests, request origin/anonymous denial, preview no-write tests, responsive browser flows, visual review and payload check. Run real Supabase tests later when Docker/services exist; do not confuse PGlite with actual Auth validation.

## Extension design

Future readings have explicit owner, observation time, ingestion time, unit, source/method and freshness. Daily self-reports stay separate from wearable/imported measurements. This slice deliberately does not create generalized metric or provider tables. Later a read projection can combine them without changing the layout. A real body twin can be a separate focus view once requirements and measurements exist. Do not reserve a giant empty human-shaped dashboard panel.

Later options to validate: user-selected module arrangement; weekly AI review grounded in records; pinned decisions and follow-ups; routines linked to goals; opt-in reminders timed to the user's schedule; contextual community encouragement. These are not shipped promises or a reason to delay this useful slice.

## Implemented and verified — Aurelius 1D

The sequence above is implemented in the canonical modular monolith, without new packages. Daily validation is loaded only when interacting; the public initial render carries no authenticated records. Reads use an embedded action relationship in one Postgres statement; writes use the owner-derived RPC. The test-only component fixture adapts Next Link to an anchor; actual Next navigation is exercised separately.

| Gate                                     | Observed result                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, strict typecheck, production build | Passed                                                                                                                                                   |
| Unit / SQL / mock SDK                    | 59 passed, including all four migrations and daily grants/ownership/atomic rollback/version bounds                                                       |
| Browser interactions                     | 39 passed, including 360/768/1440 sample flows, 360×640 editor, enlarged text, focus return, save conflict/reload, generic starter and history deep link |
| Sample isolation                         | Check-in/action/reflection interactions produce no API writes; exit restores empty preview                                                               |
| Security                                 | Anonymous daily API denied; hostile origin denied; direct SQL writes denied; two-user SQL reads isolated; production harness remains unavailable         |
| Visual inspection                        | Empty and sample states at phone/unfolded/desktop; no tested horizontal overflow or page errors                                                          |
| Local payload                            | Approximately 153.2 KB encoded home JavaScript, about 6 KB above 1C Still; no new home canvas payload                                                    |
| Existing optional scene                  | Aurelius welcome context-loss/restore simulation and three motion cleanup cycles pass                                                                    |
| Actual Supabase / founder persistence    | Unrun: Docker/local service unavailable; integration/founder scripts extended for daily RPC and embedded readback                                        |
| Live model / physical foldable           | Unrun; no credentials or physical device; no quality/battery claim                                                                                       |

`npm run check` and `npm run test:e2e` reproduce the primary checks. `node scripts/dashboard-audit.mjs` captures the current empty/sample screens and resource evidence after a production build; `node scripts/visual-audit.mjs` checks shared appearance and the optional Aurelius welcome renderer. Resource Timing is a headless local lab observation with no throttling; it is not field LCP/INP, a cellular benchmark or battery evidence. Screenshots use fictional records. Root-font enlargement is tested, not every native browser zoom/assistive technology combination.

Verification found and resolved initial validation bundle cost, an inherited-property starter lookup, a fixture-only Next Link mismatch and ambiguous duplicate navigation selectors. Action completion deliberately waits for a save acknowledgment; tests assert the eventual saved state instead of treating a click as an immediate persisted result.

## Operational handoff and limits

Apply the fourth migration before connected personal use. The seed adds a repeatable synthetic past-week pattern for the local founder and leaves today empty. Preserve existing local data with migration up; reset only deliberately for synthetic tests. Normal auth/RLS still applies; no Stripe or SMTP is needed for the local founder harness. GitHub reconnection and hosted deployment remain deferred.

The history chart shows energy and dated energy/sleep values for the last 30 days. Today can be edited; stored older intentions/reflections/action details have no browsing interface yet. The current display window is not a retention policy. Export/deletion/retention remain pre-beta work. No body assets, wearables, provider connections, generated health score, AI daily briefing or automatic memory ingestion were introduced.

Next: founder device review, real service activation, and the existing Aurelius evaluation loop. After those checks, add a daily briefing grounded in explicitly selected records, with sources and user control over what enters model context. Do not expand unrelated modules before the actual daily experience is evaluated.
