# Aethelios Live — Phase 3B evidence and scenarios

Research and implementation receipt · October 11–12, 2026 · protected-preview implementation, not deployed.

## Delivered

The shared Live/Talk creation workspace now accepts **source-linked research comparisons and bar charts**, alongside Phase 3A conceptual diagrams/comparisons and Phase 2 Studio images. Voice proposes them through the existing reviewed visual tool; text uses the same artifact API. Paid approval names the public research task and explains the extra research/formatting stages. Existing grants, ownership, feature defaults and production rejection remain unchanged.

Charts display a common measure, literal unit and reporting period, source-linked values, unavailable values, signed bars with a zero baseline, an accessible data table and clickable citations/excerpts. Research comparisons distinguish source-linked extraction, AI inference and unavailable evidence in each cell. Provider-returned source links, retrieval date and limitations remain visible. Research excerpts are explicitly from the returned AI research response, not quotations verified against original pages.

A person can apply a bounded integer **−50% to +50% hypothetical change**. The sole formula is `reported value × (1 + percentage / 100)`. There is no generated executable formula, forecasting model or arbitrary code. Original values and evidence remain unchanged; missing values remain unavailable. Filled and dashed bars, separate table columns and explicit labels distinguish extraction from assumptions. JSON export separates the source board from hypothetical values.

Scenario percentage is an owned selection field. It persists with the selected point across views, refresh, minimize and voice End; selecting another artifact resets it. Existing Live selection polling supplies the current scenario to voice, and the explicit Explain control uses returned state directly. Subsequent personal Talk receives the same bounded selected context. Company/personal isolation is unchanged.

## Research and chosen architecture

Inspected the installed AI SDK/OpenAI provider source before changes. Its existing `source` stream events expose provider URL metadata; its Responses adapter requests web-search source metadata. Added an optional source callback to the existing research lane, leaving normal text streams and source footers compatible. The same server-only OpenAI key and configured reasoning model are retained; no AI Gateway, new subscription, provider or agent framework was added.

Current official OpenAI web-search docs describe provider URL annotations and require visible clickable citations. Structured Outputs constrain shape but do not establish factual accuracy. W3C recommends associating complex charts with detailed descriptions/data tables. These support a small trusted chart renderer and explicit evidence review, rather than unrestricted generated HTML/JavaScript.

Sources inspected:

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [W3C complex-image accessibility](https://www.w3.org/WAI/tutorials/images/complex/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Installed Next 16.3.5 `after()` documentation and current installed AI SDK provider source.

The Supabase changelog Markdown fetch failed; packages and Supabase API integrations were not upgraded. Existing OpenAI Realtime remains active behind the pilot gates. GPT-Live remains an evaluation adapter; this phase does not prove or promote it.

## Evidence contract

1. The existing read-only research lane receives only the approved standalone task, with no automatic profile, memory, account records or unrelated transcript retrieval. Existing research policy applies. The review tells the person to remove private details.
2. A source catalog is built from provider metadata, with bounded IDs, titles and public HTTP(S) links. Credentials, non-default ports, IP literals and obvious localhost/internal hostnames and executable schemes are rejected. The app does not fetch arbitrary model-generated URLs.
3. Complete research with at least one usable source is required before formatting. A bounded second Responses call has no tools and returns a strict data schema. Source URLs and retrieval timestamp are attached by the server, not supplied by the formatting model.
4. Citation IDs must resolve to that catalog; excerpts must match returned research text after whitespace normalization. Reported comparison values must occur in their excerpt. Inference and unknown evidence remain labeled distinctly.
5. Chart numbers must occur literally in their excerpt with the same literal unit and reporting period. Units/periods must match across points. No automatic scaling, conversion, extrapolation or missing-to-zero substitution is permitted. Unknown numeric values are null; purely inferred values are not charted as reported facts.

These checks establish pipeline provenance and structural/numeric consistency. **They do not prove that an original page supports every claim, that citation association is correct, or that research is current and exhaustive.** Source association and research synthesis can still be wrong. The UI says source-linked AI extraction and requests source review; it never promotes output to verified fact or persistent memory.

## Ownership, metering and recovery

Additive migration `20261011234637_live_evidence_charts.sql` extends the existing artifact operations and selection fields, preserves image constraints, and adds generation-stage/token-completeness metadata. Owner-bound RPCs enforce completed-chart selection, percentage bounds, duplicate-completion protection and immutable original data. No new artifact/history silo was introduced. Full migration-chain tests preserve earlier Studio/visual behavior.

One approved artifact reserves one existing reasoning **operation** in `ai_usage`; it does not create a pending Talk turn or reserve twice. Existing 120/24-hour and 10/minute operation limits, one recent running visual per person and proposal limits remain. Research has a 45-second deadline and a 24,000-character result bound; extraction has its own 45-second deadline, 2,400 output-token cap and 1 MiB response bound. The existing research agent retains its two-step/output/tool bounds. Two pipeline stages are not necessarily exactly two HTTP/model/tool calls.

Provider-reported token counts from both stages are aggregated, including known counts on failure. `usage_complete=false` marks totals that are only known lower bounds after an unreported stage; unknown usage is not represented as a zero-cost result. Stage counts describe attempted pipeline stages, not settled invoices. Web-search charges and final billed usage still require actual provider reconciliation. No fixed per-chart price is invented.

The separate `after()` worker remains bounded, independent of the voice session and best effort under process failure. Stale jobs become uncertain after two minutes; late completion can reconcile once. Failed or uncertain paid work is never automatically replayed. This is not a crash-safe queue. Production hosting, independent expiry and recovery remain launch gates.

## Validation and unresolved gates

Lint and strict typecheck pass. Full unit/SQL suite: **69 files / 461 tests pass**. New cases cover invented citations/excerpts/numbers, incompatible units/periods, unknown data, unsafe links, signed geometry, scenario formula/bounds, inference separation, captured source metadata, no formatting without cited research, duplicate writes, cross-account denial, immutable source values, selection continuity and known/partial token reporting. Browser scenarios are written for 390px and 1440px citation/table/scenario continuity, but unrun.

Historical migration ledger: 28 files verified; the new additive migration is unapplied to hosted Supabase. PGlite loads the migration chain and tests owner rules, but is not real Supabase Auth/Storage/advisor verification.

Fresh production build fails at the existing pinned MediaPipe download with DNS `EAI_AGAIN`; fresh loopback verification returns `EPERM`. No checks were disabled. Environment readiness still reports no configured provider credentials. Actual research/extraction success, speech continuity, latency, billing, screenshots/accessibility and physical Galaxy/iPhone/DeX behavior remain unverified. Cinematic assets, voiceovers and separate repositories were untouched. No production merge or deployment occurred.

## Acceptance and next phase

Ask for a public-company metric comparison for one explicit unit/year → review and approve → continue talking → inspect citations and unavailable categories → select a point → apply +10% → hear an explanation that distinguishes original evidence from hypothetical values → minimize/return → End voice → continue in Talk with the same selection. Repeat with a sourced comparison, rejected sources, incompatible periods, missing data, duplicate approval and disconnect. Verify actual provider results and hosted ownership before acceptance.

Next priority is real-provider/build/browser/hosting acceptance of the completed vertical slices, rather than adding more unverified renderer types. The next product phase is scoped coworker collaboration and reviewed actions using existing Council/domain permissions. GPT-Live comparison, crash-safe execution/expiry and device testing remain prerequisites for launch.
