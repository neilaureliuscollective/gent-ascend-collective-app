# Founder release acceptance reconciliation — 2026-10-12

Latest source 67036c6 passed the complete database job, including all 12 real authenticated founder journeys. Obsidian visual verification and Lifestyle acceptance passed. The broad application job still fails; no production release is accepted.

Research: [Playwright best practices](https://playwright.dev/docs/best-practices), reviewed today, recommends user-visible contracts and isolated tests. Inspected current root routing, Command at /app/ongoing, shared navigation and brand metadata before updating expectations. Tests which exercise Command must visit its actual route; /app intentionally resolves to Talk or the verified Founder Office.

Corrected Command/daily/appearance route targets, the corresponding connection-field path, and current Aethelios home/title expectations in identity tests. Assertions, interactions, ownership boundaries and sample isolation checks are preserved. Added an explicit connected-runner Command/identity step before the broad suite so those results are visible independently. No test is skipped or marked expected-to-fail.

This phase changes acceptance tests and CI only; it does not restore obsolete homepage scenes or alter public product behavior to satisfy historical selectors. Remaining estate/commerce/home-fixture failures require their own source-contract inspection and reconciliation, not blind assertion replacement. Real production-founder/model/device testing and accepted compatible-reader rollback readiness remain separate gates.

Local lint/strict-type receipts: /workspace/acceptance-{lint,types}.log. Browser execution occurs on the connected GitHub runner; it is not claimed from source inspection. No production merge/promotion, schema or hosted grant changes.

## Focused interaction reconciliation

The new focused run passed 40/55 checks; the full authenticated database job remained green. Inspected each remaining error against current source. Updated tools-drawer access before Context/Memory, current Work navigation, canonical manifest values, and named saved-context/deeper-system disclosures rather than ambiguous shared CSS summaries. Retained draft, session-loss, sample-isolation, focus, reduced-motion and source-boundary assertions. Added native noscript account/home guidance to the shared shell: this repairs an actual missing fallback rather than changing working navigation for an old test.

Research: MDN noscript element reference and official Playwright locator guidance, reviewed 2026-10-12. The native fallback is hidden by the browser when scripting is enabled and offers ordinary existing sign-in/home links when disabled. It adds no auth capability or private data. Exact browser results remain the connected runner's acceptance gate.


## Opening fallback and current public route reconciliation — 2026-10-12

At activation head `50a1892`, real authenticated database/Founder Office checks passed again. The focused browser suite passed 50 checks and failed five: three outdated Talk eyebrow expectations, a motion assertion expecting a paused animation where elevation deliberately removes it, and a no-JavaScript opening screen missing an explanation. The opening loading boundary now includes the native explanation; navigation remains available in its existing disclosure. This fixes the streamed loading state rather than relying on a Shell that may require JavaScript to finish replacing the fallback.

Public/company checks now verify the approved five workspace destinations, the current company-building homepage, real Lifestyle routes, unconnected catalog/product states, unavailable cart response (503/private no-store), and the current v7 offline cache. These are unconfigured local acceptance contracts, not evidence of live Shopify orders.

Retained estate choreography checks now run in the existing browser-only component fixture with an explicit historical label. Its composition is copied from repository commit `30cc2cf`, with redirect/runtime deployment logic removed. There is no application route, identity adapter, database connection or commerce executor. Scroll, Fold widths, reduced motion, native chapter navigation and image/rendering assertions remain. The archived product exit is verified as an href; real product availability is checked separately against the current app. Historical component results must not be counted as current homepage or production acceptance.

All broad browser gates remain enabled. Exact-head connected browser results are required before release; no hosted work-contract flag is enabled by these changes.


The broad-run Lifestyle fixture suite now explicitly selects port 3102; its dedicated configuration already used that port, but the broad configuration used the production server on 3100. Assertions and simulated cart behavior are preserved. Talk identity/no-audio checks use the current presence drawer because Imperial Obsidian intentionally hides the legacy motion-preview button in Talk. Listening/speaking/insight/milestone preview states remain independently covered in a labeled synthetic component fixture, with microphone requests rejected and API writes checked absent. This is visual regression coverage, not voice acceptance. Welcome assertions use the current Aethelios identity.


Direct-home handoff assertions now select the labeled primary composer rather than both it and the mounted expanded-message textarea. Original private draft, account-switch clearing, session-expiry clearing and no-persistence assertions are preserved. Context exits use the current primary/deeper navigation disclosures. CI reported the next action below fixed navigation on a 344×740 cover viewport; existing compact Command rules now cover heights up to 800px, preserving larger-screen layout. Browser verification of that adjustment remains required. Local fixture bundle compilation also passes; compilation is not browser acceptance.
