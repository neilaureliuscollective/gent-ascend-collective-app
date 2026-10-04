# Public launch Phase 4 — release controls

October 4, 2026. Built on recovered Phase2 and Phase3 source in `feat/public-launch-release-readiness`. This is the final consolidated launch build package in the approved public-launch blueprint. Code implementation does not constitute public-launch acceptance or permission to deploy.

## Research and plan

Inspection found working account entry, daily continuity, member research wiring, billing controls, product/cart/order paths and installation guidance. Release status remained spread across documents; there was no central founder ledger, clear public support/account-controls page or field performance sink. Whole-account self-service export/deletion and legal publication were not implemented and must not be presented as complete.

Official research reviewed October 4:

- https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals and installed Next16.3.5 analytics/useReportWebVitals guides: small client boundary and stable report callback.
- https://web.dev/articles/vitals-field-measurement-best-practices and https://web.dev/articles/vitals: real-user measurement and aggregation; laboratory/source checks do not establish field compliance.
- Installed Next data-security guidance: server-only authenticated domain service, minimal DTOs and fresh authorization.

Build one founder ledger, connect member support to existing controls, add disabled-by-default anonymous scalar reporting, verify access/privacy boundaries and preserve exact release/rollback evidence. Apply the React checklist: parallel existing identity reads, small serialization, stable callback, no private cross-request cache, semantic headings/links and readable narrow-screen content.

## Implemented

- `/app/founder/launch` shows environment configuration and unknown external acceptance gates. It is linked from the existing verified founder section in You. The domain service independently checks person-bound founder authority. Anonymous/member views disclose no environment report. It shows a validated deployment SHA when available, not a claim that the SHA was tested.
- Each row distinguishes configured, blocked and unknown. Hosted account isolation, device acceptance, whole-account data request handling, published legal terms, actual provider journeys and final public release stay unknown. Paid preorders stay blocked. Billing inspection links to the existing explicit Phase3 report. No score, automatic approval, flag edit, provider call during rendering or personal-record mutation is added.
- `/support` supplies account/browser/install guidance, membership management, separate Shopify order history, and links to existing profile, conversation and confirmed-memory controls. Public footer, You and error recovery screens link to it. It explains that chat deletion and separately saved memory/action records are different operations.
- A validated `GENT_SUPPORT_EMAIL`, falling back to the existing membership support email, supplies an actual mailto link only when configured. Missing contact is disclosed. Whole-account export/deletion is not a self-service feature; support may receive requests, but inbox handling, owner verification and retention need real operational acceptance. The page is support guidance, not an invented privacy policy or a promise of legal compliance.
- Optional `GENT_PERFORMANCE_ENABLED=true` mounts the Next Web Vitals hook and opens `/api/monitoring/performance`. Default is off. LCP, INP and CLS reports contain only rounded scalar values, an allowlisted initial-document surface and coarse viewport category. A validated deployment SHA is added server-side. No account/conversation IDs, raw URL/query, DOM attribution, entered text, cookies or private health content is sent by the component. Browser Do Not Track and Global Privacy Control suppress reports; server privacy headers also suppress logging.
- The endpoint requires same origin, JSON and a streamed512-byte maximum; strict validation rejects extra fields and invalid values. Disabled collection returns404. Reports have private/no-store responses and use a structured log sink. Client reports are untrusted diagnostics, not billing/access or reliable activation evidence. Infrastructure request logs are separate. This sink is not durable analytics, a retention dashboard, an error-tracker or a measured field-performance pass. Confirm retention, traffic controls and aggregation before enabling broadly.
- The existing training `/api/performance` contract is unchanged; measurements use a separate monitoring path. No dependency, migration, commercial offer, provider credential, AI entitlement or launch activation changed.

## Verification receipt

| Gate                                                           | Result                                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Lint                                                           | Pass                                                                                                                              |
| Strict Next/TypeScript                                         | Pass                                                                                                                              |
| Unit/SQL/provider-contract tests                               | All322 pass                                                                                                                       |
| Recorded migration ledger                                      | All28 owned migration files match; no new migration                                                                               |
| Production webpack build                                       | Pass, including page-data collection and route generation                                                                         |
| Production-runtime signed-out HTTP                             | Support, founder-denied view and You return200; `/dev` and disabled monitoring return404; anonymous billing inspection returns403 |
| Browser interaction cases                                      | Added360/768/1440 support and founder-denial cases; unrun locally                                                                 |
| Actual Supabase/Stripe/Shopify/model sessions                  | Unrun for this phase                                                                                                              |
| Clean installation / normal Turbopack / complete browser suite | Pending release CI                                                                                                                |
| Physical phone, Facebook browser, DeX and installed-app        | Pending actual devices                                                                                                            |

Build tooling limitation: shared workspace disk filled during validation. The final webpack build used the same lockfile-matched linked dependency tree and a temporary in-memory output directory with explicit Node module resolution. The first alternate-directory attempt compiled but could not resolve Next's runtime from that directory; correcting module resolution produced the passing final build. Production-runtime HTTP checks used that final artifact in the same process/network context. These checks do not prove hydrated interactions or authenticated persistence. No assertion was removed to obtain a pass.

New tests verify denied founder reads, non-promotion of configuration into readiness, support address validation, redacted DTOs, metric scalar projection, extra-field rejection, origin rejection, privacy signals, streamed limits and default-off behavior. No private member record or payment was written.

## Release sequence and rollback

1. Obtain the outstanding explicit authorization to publish source to the existing public canonical GitHub repository. The prior automatic-review rejection remains; this phase does not bypass it. Save stacked review branches for Phase2, Phase3 and Phase4 and let clean CI run on their exact combined head.
2. Record additive Phase1 account-claim migration activation and hosted signup/provider configuration separately. Existing28-file recorded ledger validation is not proof the pending claim migration is active.
3. Complete two hosted account journeys and the member/model research paths, then independent Stripe lifecycle and Shopify ready-product acceptance. Keep preorders closed until their separate merchant-backed flow is implemented and verified.
4. Configure and prove the support inbox/owner-verification process, account-data requests and published terms/privacy. Whole-account self-service export/deletion remains absent.
5. Test physical Fold outer/inner, DeX, iPhone, Facebook entry, keyboard room, Still/reduced-motion, installation and offline return. Measure ordinary versus research reply timing and collect representative field performance before declaring performance thresholds met.
6. Approve and release the exact tested commit/tree, verify domain/deployment identity and signed-out plus authenticated critical paths, and attach receipts to this ledger. Local implementation completion does not make the app launch-ready.

Roll back to the last approved production deployment, preserving member records and the additive migration. Turn performance reporting off independently with `GENT_PERFORMANCE_ENABLED=false`; use existing account/billing/provider switches to close enrollment without removing independently verified founder/beta access or cancellation controls. No rollback step resets or seeds hosted data. Preserve current installed-app identity and Shopify authority.

All four blueprint build packages have local implementation. Open items are integration, operational configuration and release acceptance; no fifth speculative feature package is required before closing these gates. Public GitHub publication remains pending the existing explicit-permission request; production is unchanged.
