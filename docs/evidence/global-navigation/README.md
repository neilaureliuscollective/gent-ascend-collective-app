# Local navigation evidence

All screenshots are **local synthetic fixtures**, not authenticated sessions. They share the same fixture adapter. Before is main `bbda46f5159efd0bfe725874b230b506e52b971c`; after is the navigation repair. Phone/Fold/desktop are browser viewport emulation, not physical devices. Talk renders its real workspace with intercepted synthetic reads; the other bodies are labeled stand-ins to inspect shared chrome.

| View | Before | After |
| --- | --- | --- |
| Phone Talk, 390px | [before](before-aethelios-390.png) | [after](after-closed-aethelios-390.png) |
| Fold Talk, 720px | [before](before-aethelios-720.png) | [after](after-closed-aethelios-720.png) |
| Desktop Talk, 1440px | [before](before-aethelios-1440.png) | [after](after-closed-aethelios-1440.png) |
| Phone shared shell | [before](before-app-390.png) | [after](after-closed-app-390.png) |
| Fold shared shell | [before](before-app-720.png) | [after](after-closed-app-720.png) |
| Desktop shared shell | [before](before-app-1440.png) | [after](after-closed-app-1440.png) |
| Phone Architect frame | [before](before-architect-390.png) | [after](after-closed-architect-390.png) |
| Fold Architect frame | [before](before-architect-720.png) | [after](after-closed-architect-720.png) |
| Desktop Architect frame | [before](before-architect-1440.png) | [after](after-closed-architect-1440.png) |

Open-sheet captures include [320px Talk](after-aethelios-320.png), [390px Architect](after-architect-390.png) and [1440px shared shell](after-app-1440.png). They are captured after keyboard cycling to the final control, so the body has scrolled; the heading stays visible. The corresponding tests exercise the first links before cycling focus.

[Actual anonymous built-route receipt](anonymous-built-routes.json) separately records 11 real route responses and menu links against a local production build. No configured backend, member/founder session, live provider or microphone is claimed.

Reproduce after screenshots with `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npx playwright test --config playwright.navigation.config.ts`. For before captures, serve the same fixture adapter from an isolated main checkout at port 3103, then run `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium node scripts/capture-global-navigation.mjs`.

Recorded checks: [optimized build](build.txt), [lint](lint.txt), [registry tests](registry-tests.txt), [7 navigation browser tests](navigation-browser.txt), [37 browser regressions](browser-regression.txt), [migration ledger](migration-ledger.txt). Separate failures: [standard prebuild asset download](standard-prebuild-failure.txt), [broad pre-reconciliation unit run](broad-unit-before-main-reconciliation.txt). These logs do not claim full post-reconciliation unit, real authenticated or active-voice acceptance.
