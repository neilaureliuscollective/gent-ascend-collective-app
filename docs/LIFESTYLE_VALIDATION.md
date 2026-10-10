# Phase One validation — 2026-10-10

## Observed results

Public member app:

- Lint passed after implementing Lifestyle.
- Typecheck passed (Next route generation and strict tsc).
- Full Vitest suite: **58 files / 421 tests passed**, including Lifestyle assortment isolation, supplier identity, inactive member offers, cart-secret projection, HTTPS checkout-host validation, origin/input protection, Shopify cart add/update/remove, error redaction and explicit stale-cart replacement. Existing Shopify product/cart, pagination, editorial and customer-account contract tests remain passing.
- Migration ledger: **28 application-owned migration files verified**. No migration or database mutation added.
- Production compilation: **passed** with Next 16.3.5 webpack, TypeScript compiler API mode, page generation and build traces. New Lifestyle, Legacy Reserve, product/cart and restored API routes are present. This used a temporary `experimental.useTypeScriptCli: false` validation setting; original next.config.ts was restored. No permanent framework/build configuration or dependency change.
- Standard npm build command: prebuild was blocked while downloading the pre-existing MediaPipe Mirror model from storage.googleapis.com. The normal CLI TypeScript build path also failed parsing its spawned --showConfig output in this runner. These are separate runner/build-harness limitations; do not label the standard npm command green from the alternative compilation.
- Browser fixture bundle: built successfully using existing Vite tooling. It is not a production bundle and does not authenticate a member or connect Shopify.

Corporate website:

- Lint, typecheck and destination tests passed.
- Production compilation/page generation passed with the same temporary TypeScript API + webpack validation method; original config restored.
- Dependencies for these checks were shared from the member app's installed same-version framework/compiler. An independent corporate npm ci could not complete offline because its lockfile selected an uncached transitive package. Exact-lockfile CI remains a release gate.

## Browser, screenshots and accessibility limits

Added `playwright.lifestyle.config.ts` and responsive fixture tests covering 390/768/1440 widths, Lifestyle home, brand destination, listing, PDP, cart, quantity/remove, search/empty/error, variant/quantity/add failure, reduced motion and keyboard product chapters. Fixtures are visibly synthetic and exist only in test files.

The sandbox denied localhost server binding (`listen EPERM`). A static-file attempt also failed launching Chromium because its IPC socket setup was denied (`setsockopt: Operation not permitted`). Additional-permission commands were not completed. **Responsive browser execution, screenshot capture and measured accessibility/visual acceptance remain unverified. No screenshots are claimed or fabricated.** A static fixture build alone is not browser acceptance. No actual member/guest hosted journey or physical-device check was performed.

On a normal runner, build/start the app and run:

```
npm run lint
npm run typecheck
npm test
npm run build
npm run db:ledger
npx playwright test --config playwright.lifestyle.config.ts
```

The focused fixture suite writes five view types at three widths to `docs/evidence/lifestyle/fixture-*.png`. Run the application journey as guest and authenticated member against authorized Shopify data as a separate acceptance step. Inspect mobile dock/sticky purchase placement, keyboard/focus, contrast, image loading, missing images/ingredients, empty catalog, provider failure, cart expiry and checkout destination. Existing historical browser tests that expected the retired public preview shop need updated expectations for redirects into the restored live-only member collection.

## Merchant integration and checkout

Founder-provided shop: `1yjonr-ym.myshopify.com`. No Storefront credential is bound to the execution environment; the runtime's store/network configuration was not changed. Actual Headless collection publication, product inventory/pricing, cart mutations and Shopify checkout contents have **not** been verified.

No charges, orders, customer export, inventory modifications, live discount creation, Stripe subscription changes, production deployment or merge occurred. Standard-command CI, screenshots, merchant acceptance and founder approval remain required before commercial release.

## Upstream reconciliation

Main advanced to 2307e1e81a242c78737ff5b7780234544075e737 during review preparation. A review-branch merge preserves its complete tree (including the approved crest and Imperial Obsidian member environment), keeps Ecosystem alongside Lifestyle, and appends both status entries. Only navigation and STATUS overlapped. The 421-test and production build results precede this upstream reconciliation; integrated-branch CI and browser acceptance remain required.
