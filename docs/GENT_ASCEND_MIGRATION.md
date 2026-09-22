# Gent Ascend Collective — brand migration

2026-09-22. Founder-authorized migration of the existing canonical Aurelius Collective app, preserving its history and product architecture.

## Inspected foundation

Next.js 16.3.5 / React 19.3 / TypeScript; App Router with Command, My world, Progress, You, goals and the full Aurelius workspace. The account route owns the current sign-in presentation; no separate landing/onboarding/splash flow exists. Global Aurelius panel, AI SDK streaming, memory/context/history, daily observations/actions, profile/goals, session-bound Supabase services, four SQL migrations, local-only development harness, metadata/manifest/icons, Three orb and appearance controls were retained.

No database migration, dependency version change, route rename, Auth cookie change, storage-key change or environment-variable rename was required. Existing `aurelius-*` technical identifiers are intentional compatibility contracts.

## Delivered

- Public identity and metadata: Gent Ascend Collective / Gent Ascend. Aurelius remains the AI. Aethelos is the standing gentleman archetype in the official crest. Legacy Reserve remains the product brand.
- Exact founder logo master preserved; complete lockup, crest, padded app/Apple icons and a celestial-star small favicon. Archived previous artwork outside public assets.
- Central palette with exact #0B3B32 green, #C4912F gold, #050706 obsidian and supplied supporting tones. Removed violet materials from active CSS and both orb renderers.
- Refined shell, dashboard hierarchy, sharper surfaces, green intention plane, selective serif, account arrival with the official full logo, identity profile, world modules, loading/error screens and mobile dock.
- Existing daily actions, charts, forms, goal handling, sign-in/out and AI workflows preserved. Planned modules remain explicitly planned; no invented health metrics, fake community or checkout.
- Orb: dark green/obsidian internal depth, warm gold orbital geometry and green edge illumination; existing preview states, actual request/save priority, static fallback, adaptive resolution and lifecycle controls preserved.
- Versioned AI prompt changes only the public brand architecture; context, memory, tool and safety boundaries remain intact.
- Responsive states: <=600px cover/phone, 601–1100px unfolded/tablet, >1100px desktop. Dedicated <360px adjustments. Reduced motion, solid surfaces, keyboard behavior and zoom retained.

## Verification and limits

Final observed results are recorded in STATUS.md. The first parallel browser run exceeded short hydration timeouts in the software-rendered execution environment. Sequential verification uses 15-second assertion and 90-second scenario budgets, without weakening assertions. PGlite initialization has a 60-second hook allowance; test bodies retain their previous limit.

Tests with intercepted conversation responses and SQL emulation do not prove live Supabase Auth/PostgREST, a paid AI request, physical Fold GPU performance or PWA installation on a device. Those require the existing service/device activation gates. No production deployment was performed for this migration.

## Review and continuation

Run `npm ci`, `npm run check`, then `npm run test:e2e -- --workers=1` with Playwright Chromium installed. `scripts/brand-audit.mjs` starts a local production server and captures six routes at 320/344/768/1440px plus the enhanced orb. `scripts/brand-assets.mjs` reproducibly derives the deployment assets from the untouched master.

Use this existing repository, not a new project. Follow VERCEL_SETUP.md for a fresh Vercel import and the separate live-service acceptance steps. Keep the existing technical repository/package name; customer-facing identity is Gent Ascend.

Final checks: `npm run check` passed (61 tests). Full browser run 48/49; after fixing large-text header overflow and desktop launcher placement, all 15 affected regression scenarios passed. All 49 distinct scenarios have passing evidence across those runs. Final screenshots are included in the handoff.
