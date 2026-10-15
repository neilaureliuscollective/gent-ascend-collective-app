# Synthetic Studio label acceptance

These artifacts use the real DesignWorkspace/Fabric editor and real Node PDF renderer with an **isolated loopback API fixture**. Save/reopen exercises the editor's request/acknowledgement/revision path against an in-memory API adapter. It does **not** establish Supabase Auth, PostgREST, Storage, hosted worker or real model acceptance. The database trigger is separately tested with PGlite. The geometric logo is an original test fixture, not the approved Aethelios master. No actual SKU template was available.

- [Desktop setup](desktop-setup.png), [desktop editor](desktop-editor.png), [protected copy](desktop-protected.png)
- [Fold setup, 344px](fold-setup.png), [Fold editor](fold-editor.png), [Fold protected copy](fold-protected.png)
- [Desktop complete walkthrough, 28.4 seconds](desktop-full-flow.webm)
- [Fold complete walkthrough, 25.8 seconds](fold-full-flow.webm)
- [Downloaded desktop PDF](desktop-download.pdf), [downloaded Fold PDF](fold-download.pdf), [raster proof of the downloaded PDF](desktop-pdf-proof.png)
- [Independent PDF inspection](pdf-inspection.json), [editable synthetic document](synthetic-design.json)

Both walkthroughs show template/profile and facts import, logo and Talk brief import, creation, type/color editing, undo/redo, save, reload/reopen, preflight, actual PDF download and protected-copy inspection. No paid or simulated model answer is presented as a live model result. They are recorded interactions, not a decorative animation.

The fixture is exactly 120×60 mm trim, with 2 mm bleed on each edge: 124×64 mm media. All three PDFs independently pass box checks, <10 MB, RGB drawing operators, outlined glyphs, vector-logo path presence and absence of raster Image/Font objects. These fixture dimensions must never be used for a real SKU.

## Reproduce

```
npm ci
npx playwright install --with-deps chromium
npx vitest run tests/studio-label.test.ts tests/studio-label-service.test.ts tests/studio-label-database.test.ts
STUDIO_LABEL_DEMO=1 npx playwright test --config playwright.studio-label.config.ts
node scripts/inspect-studio-labels.mjs
```

Local runner used system Chromium through `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium` and system FFmpeg exposed in `/tmp/studio-playwright/ffmpeg-1011/ffmpeg-linux` because Playwright's FFmpeg download was denied. This does not change application runtime or tests. Physical Fold touch/keyboard and print color proofs remain unverified.
