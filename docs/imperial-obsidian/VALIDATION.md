# Validation — 2026-10-10

- Member lint: passed; strict typecheck passed.
- Member unit tests: 56 files, 410 tests passed after correcting luminous indicator contrast.
- Migration ledger: passed, 28 owned migrations verified against existing snapshot. No migrations changed; this is not a real Supabase Auth test.
- Member optimized build: webpack compiled, checked TypeScript and generated 72 static pages successfully. Existing `npm run build` prebuild is blocked by offline face-landmark model download (storage.googleapis.com DNS EAI_AGAIN). Direct Next build used a temporary documented `experimental.useTypeScriptCli: false` because Next's default subprocess returned empty `--showConfig` output in this sandbox. Original config restored afterward; no typechecking disabled.
- Corporate lint, typecheck, destination unit test passed. Optimized webpack build passed with the same temporary TypeScript API selection, then original config restored. Dependencies were reused from the member workspace; clean npm install was not exercised.
- Chromium launch: blocked, sandbox `setsockopt: Operation not permitted`, SIGTRAP. Local Next server launch: blocked, listen EPERM at 127.0.0.1:3100. No browser acceptance, screenshots, physical-device review or whole-page accessibility/performance measurement is claimed.
- Existing Talk/Studio browser assertions updated for the approved materials; behavioral checks retained. New Ecosystem checks cover truthful offers, links, no fabricated checkout, selected navigation, overflow and forced colors. These are unrun until browser permissions are available; synthetic API responses never count as live provider verification.

## Capture and acceptance matrix

In an environment that can launch Chromium and loopback servers, run the existing `test:e2e` suite with `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium`. Browser material tests save screenshots under `test-results/imperial-obsidian-*`. Capture the original base commit in a separate worktree and the review branch at identical viewports, state, font readiness and motion preference. Compare Talk, Work, Studio, Ecosystem and corporate home/divisions. Ecosystem has no prior route; baseline comparison is to the previous navigation/product architecture.

Viewports: folded 320/360, iPhone 390, Android 412, unfolded 768, tablet 1024, desktop/DeX 1440, large 1920; also landscape and height 420. Verify visible focus, >=44px controls, no horizontal overflow, dialogs, keyboard-open composer and transcript scroll, saved history, attachment controls, error/status readability, reduced motion and solid/forced colors.

No founder reference images were supplied; there can be no side-by-side mockup comparison or pixel-match claim. No before/after screenshots were fabricated. No live provider/Auth/Stripe calls were performed.
