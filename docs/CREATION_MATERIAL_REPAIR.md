# Talk, Studio and Architect material/cascade repair

2026-10-15. Focused repair from released main `58a59df9cb1d56694f13c71c8f36d85d7b321daf`, then fast-forwarded to released voice main `f3703dcbbc2cb91b28aefc60feb6aee4697fce58` before validation. No voice logic, server logic, credentials or hosted configuration changes.

## Verified diagnosis

Actual served Talk and Architect HTML/styles were fetched successfully through the connected Vercel reader for deployment `dpl_2iuuEAW1FgidRuiMc2UXCiP4Wffz`, alias www.gentascend.com. Stylesheet order and SHA-256 hashes are in [the audit](evidence/creation-materials/served-css-audit.json). Nine of ten Talk stylesheets are byte-identical to the preceding `06dfb332` deployment; the root stylesheet differs only in generated utility rules. This does not support blaming the PR #130 release, stale cache or failed CSS delivery for Talk's material flattening.

The scoped smoked-glass mapping introduced in `f3a510068b22a88710c0ea63de34184a40afd6b0` was already present before PR #130. It maps Talk's raised/composer/optical faces to neutral grey (#1a1a1a/#242424/#383b38). Talk creation cards separately bypass shared material/elevation roles. Architect has another grey override, including an ancestor variable referring to a variable defined only on a descendant, which resolves to the grey fallback. These explain the reproduced flat grey surfaces.

Architect's workbench also combines three named grid areas with a more specific legacy two-column rule. At 1440px the real document canvas measured only 278px while the implicit third column occupied 887px. Fixing the selector restores the intended three columns; focus mode explicitly collapses both named side tracks and panels. Responsive stacking remains intact.

White boxes in normal dark mode have not been independently reproduced. Missing palette fallbacks, native dark controls and forced-colors behavior are covered, without overriding the user's system contrast palette. Neil's later Fold-wide screenshot (`libfile_15aa81964ff88191b24f95421a20f738`, 2642.jpg, 18:22 UTC) was requested through Library. The signed transfer was blocked by this executor's proxy (403); Library read returned metadata/OCR rather than viewable pixels. Its nested voice admission/end-session behavior remains separately owned; no claim of pixel inspection of that screenshot is made.

## Repair

One scoped creation-material contract now supplies emerald glass, obsidian reading planes, restrained gold selection and shared elevation to full Talk, Studio and Architect. Existing B+ optical geometry uses the existing emerald palette again. Creation cards/actions adopt the same roles. Home and Lifestyle retain their existing material mapping. Studio keeps its existing ten-room layout and uses the same emerald materials, with raised room cards; its room console no longer adopts the conflicting historical steel-control class. Native controls have a safe dark color scheme and missing-palette fallbacks. Solid materials, reduced transparency, reduced motion and forced colors remain explicit preferences.

The four approved photographic entrance cards, official emblems and all assets are unchanged. No retired product imagery was added. Voice provider/service and separate Knowledge/Motion implementations are untouched.

## Evidence and limits

[Before manifest](evidence/creation-materials/before-manifest.json) pins 20 PNGs to actual served production CSS and original stylesheet order, replayed on real application DOM with labelled disposable API fixtures. These show Talk, its opened document, Architect Blueprint and its saved document at 390×844, 690×884, 884×690, 1440×900 and 390×520. Before and after use the same fixture, content and document view. The separate Studio before manifest adds five full-page captures using the original room-console class and actual served Studio CSS; its style fingerprint is unchanged between the inspected production versions.

`playwright.materials.config.ts` serves a production Next build with Architect enabled and GET-only labelled API fixtures. Six tests inspect actual rendered pixels, optical geometry, canvas width, focus, draft continuity, overflow, focus-canvas transitions and accessibility preferences. They also cover Studio room switching, retained Direction drafts and honest model unavailability. Playwright finalizes videos when each test context closes. The visual workflow uploads before/after PNGs and per-viewport hash manifests in `obsidian-rendered-evidence`, under `creation-materials`. This is production-build visual-fixture proof, not authenticated hosted production or live voice/model proof. No Vite screenshot is used for this evidence.

Activation requires review of the draft PR and its rendered evidence, followed by founder-authorized merge/deployment. CI alone does not establish launch readiness.

## Studio warning and saved title

The heading renders `project.title` from the owner-scoped workspace response; it is saved user content, not a fixed Legacy Reserve product label. Titles are not rewritten. Studio capabilities become unavailable only after production-table/schema absence codes (42P01, 42703, PGRST205 or PGRST204); partial failures throw a history-loading error. Client fetches use `no-store`. The former setup copy exposed a migration filename and assignment language. The UI now states that Design/Film need workspace setup and names the rooms still available, retaining the exact server-derived capability gate. Server/schema behavior and all generation/export functionality remain unchanged. The hosted database has not been independently queried, so a current hosted schema diagnosis remains unverified; no migration was run.

The second reference `libfile_857d326e0dc081918d279392393910e8` (2644.jpg) encountered the same blocked Library transfer. Both signed transfers were retried through the current supported Library helper and failed; no pixel-inspection claim is made for either reference.

## Local terminal validation before CI

- Lint and TypeScript pass after correcting two strict fixture types.
- Full unit run: 1,315 passed, one opt-in PostgreSQL test skipped by its existing condition, five runner failures: packaged-worker image unavailable; host-isolation container cannot read /opt/construct-runner.mjs; three Studio exports target the unwritable default /opt/cursor directory. Retrying Studio with a temporary evidence directory passes one export, but two mixed-film exports fail in the installed FFmpeg xfade filter (frame rate 1/0), with Fontconfig cache errors. These are recorded rather than changing sandbox controls or renderer logic.
- Direct production Next build and migration-ledger verification pass. `npm run check` remains locally non-green because of the unit environment failures above; its build phase is verified separately.
- Six initial responsive material checks pass before the subsequent Studio expansion and focus-mode coverage; final production-build verification is recorded in the PR/CI artifacts.
