# Founder release acceptance reconciliation — 2026-10-12

Latest source 67036c6 passed the complete database job, including all 12 real authenticated founder journeys. Obsidian visual verification and Lifestyle acceptance passed. The broad application job still fails; no production release is accepted.

Research: [Playwright best practices](https://playwright.dev/docs/best-practices), reviewed today, recommends user-visible contracts and isolated tests. Inspected current root routing, Command at /app/ongoing, shared navigation and brand metadata before updating expectations. Tests which exercise Command must visit its actual route; /app intentionally resolves to Talk or the verified Founder Office.

Corrected Command/daily/appearance route targets, the corresponding connection-field path, and current Aethelios home/title expectations in identity tests. Assertions, interactions, ownership boundaries and sample isolation checks are preserved. Added an explicit connected-runner Command/identity step before the broad suite so those results are visible independently. No test is skipped or marked expected-to-fail.

This phase changes acceptance tests and CI only; it does not restore obsolete homepage scenes or alter public product behavior to satisfy historical selectors. Remaining estate/commerce/home-fixture failures require their own source-contract inspection and reconciliation, not blind assertion replacement. Real production-founder/model/device testing and accepted compatible-reader rollback readiness remain separate gates.

Local lint/strict-type receipts: /workspace/acceptance-{lint,types}.log. Browser execution occurs on the connected GitHub runner; it is not claimed from source inspection. No production merge/promotion, schema or hosted grant changes.

## Focused interaction reconciliation

The new focused run passed 40/55 checks; the full authenticated database job remained green. Inspected each remaining error against current source. Updated tools-drawer access before Context/Memory, current Work navigation, canonical manifest values, and named saved-context/deeper-system disclosures rather than ambiguous shared CSS summaries. Retained draft, session-loss, sample-isolation, focus, reduced-motion and source-boundary assertions. Added native noscript account/home guidance to the shared shell: this repairs an actual missing fallback rather than changing working navigation for an old test.

Research: MDN noscript element reference and official Playwright locator guidance, reviewed 2026-10-12. The native fallback is hidden by the browser when scripting is enabled and offers ordinary existing sign-in/home links when disabled. It adds no auth capability or private data. Exact browser results remain the connected runner's acceptance gate.
