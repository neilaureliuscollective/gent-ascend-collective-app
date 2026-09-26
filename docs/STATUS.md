# Cinematic Estate homepage — 2026-09-26

Implemented founder-approved directed public homepage: original emerald/Louisiana arrival, native-scroll threshold, original Vitalis campaign environments (desktop and portrait), five supplied product references with accessible selector, near-viewport Three.js intelligence sculpture, labeled Reserve architectural study, legacy close and invitation. Future films plug into estate-media config. Existing authenticated OS/domain services remain unchanged. Details/storyboard/asset provenance: CINEMATIC_ESTATE.md.

Verification: lint, strict typecheck, 84 unit tests, production build and all 12 targeted public/cinematic browser tests pass. Browser widths 344/768/1440, product selection, reduced motion, 3D fallback/context loss, native chapter navigation, Reserve return navigation, legacy redirects, private route cache headers and offline fallback checked. Recorded ledger verifies ten existing migration files; no new migration or hosted DB operation. Viewport screenshots inspected. An intermediate test run was invalidated by rebuilding its serving artifact; final run used a stable production build. A native hash/back-navigation failure was reproduced and fixed using Next Link for chapter navigation.

Preview review only. Physical phone GPU/touch/keyboard and field Core Web Vitals remain unverified. Generated campaign assets need final label-artwork review; true textured 3D merchandise remains pending flat labels/dimensions. No production promotion, commerce activation, scanner, billing or booking activation in this milestone.

---

# Public material alignment — 2026-09-26

Founder dashboard screenshots now govern the public material language: exact deep emerald/obsidian gradients, metallic gold buttons, inset highlights, rounded borders and shared orbital geometry. Replaced the brighter flat-green treatment in the Cinematic Emerald preview. Added bounded fine-pointer card tilt/light, preserving touch and Still mode. Phone viewport captures inspected. 12 targeted browser checks, lint, strict types, 84 unit tests and production build pass. This is a revision to PR #11; production remains unchanged.

---

# Cinematic Emerald — 2026-09-26

Implemented the next public visual milestone on `cinematic-emerald`: visibly emerald surfaces, shared native-scroll choreography, dimensional world portals, spatial intelligence scene, Reserve architectural reveal, chapter navigation and a Vitalis product atelier. The atelier offers a labeled procedural 3D packaging study, pointer/keyboard rotation, warm/emerald lighting, reset, and a still fallback. No new dependencies, account privileges, AI endpoints, commerce operations or database changes.

Verification: lint, strict typecheck, all 84 unit tests and production build pass after rebuilding a corrupted Turbopack cache. All 11 targeted public/cinematic browser tests pass at phone, tablet/Fold-like and desktop widths, including reduced motion, WebGL failure, context loss, product interaction, redirects, install guide and offline privacy boundaries. Full-page captures in this restricted browser showed compositor stitching artifacts; separate viewport captures and DOM checks confirmed one hero and a correct footer. Product, phone footer and Reserve renders were inspected. The full member browser suite was not repeated because its code is unchanged. Physical Fold/iPhone frame pacing and touch feel remain unverified.

See [scope, research and next phases](CINEMATIC_EMERALD.md). Next useful interactive build: Grooming Discovery, followed by a bounded public Aethelios introduction. Real product geometry and film are replaceable later; the current study is not final packaging. Production promotion of this new milestone has not been performed.

The prior Arrival + Command milestone was merged through PR #10 and deployed successfully to production at commit `8cb2e2b` on September 26. Its live routes, redirects, manifest and private cache headers were checked; no runtime errors were reported during that verification.

---

# Arrival + Command — 2026-09-26

Implemented on `arrival-command`: cinematic public world, public product previews and Reserve gateway, existing OS moved under `/app`, invite/installation guidance, privacy-safe offline fallback, Ascend gateway, and mobile Aethelios conversation/keyboard/history refinements. See [implementation and release gates](ARRIVAL_COMMAND.md) and [cinematic media plan](CINEMATIC_MEDIA_PLAN.md). Existing APIs, RLS and database migrations remain intact. No products, billing, appointments, public waitlist or new invitations were activated.

Verification:
- `npm run check`: lint, strict typecheck, 84 unit/SQL tests and production build pass.
- Browser suite: initial 63/65 passed. Fixed large-text header overflow and replaced the stop-response test's timing delay with an explicit held response. Targeted rerun: all 8 affected/public/install/offline tests passed. All 65 scenarios therefore have passing evidence across these runs, not a subsequent single full-suite run.
- Rendered and inspected public homepage at desktop and phone sizes. Browser checks cover 344/360/390, 768 and 1440 widths, reduced motion, keyboard, streaming fixtures, redirects and cache boundaries.
- `npm run db:ledger`: 10 migration files match the recorded hosted ledger snapshot. This is not a live database test.
- Restricted runner used Playwright Headless Shell with an opt-in isolated context fixture; normal CI browser behavior is unchanged. The agent-browser daemon could not start in this runner.

Release remains open: real hosted invite/login and two-account isolation, live Aethelios reply, existing founder bridge at migrated paths, physical iPhone/Android/Samsung Fold install/reopen/keyboard checks, approved film/product content and Reserve destination. Browser AI tests use intercepted fixtures. No production promotion or hosted database changes were performed. Shopify Cart/checkout is the next commercial milestone, not claimed as implemented here.

---

# Aethelios mobile conversation space — 2026-09-25

The dedicated `/aethelios` route now uses the available phone/tablet viewport for the conversation, above the app's bottom navigation. It has a compact return header and a collapsible founder connection explanation. The same workspace powers the global dialog; both surfaces use a compact, growing composer and an optional privacy explanation. The message list remains independently scrollable, while Memory and Context remain accessible from the tabs. Existing API, prompt, memory and founder bridge behavior are unchanged.

Lint, typecheck, 84 unit tests, production build and migration ledger check pass. Playwright browser checks could not start because Chromium is absent and its download returned an invalid archive. Physical Fold/keyboard review remains necessary before claiming the layout is fully accepted. See [cross-app contract](AETHELIOS_INTEROP.md) for the boundary between private teaching and the consumer prompt.

---

# Founding Members pilot V1 — 2026-09-25

Private invitation reservation, verified Auth email claim, first-session guide, password setup and voluntary feedback are implemented. Founder view shows invitation status and feedback only. The additive migration and operating steps are in [Founding Members pilot](FOUNDING_MEMBERS_PILOT.md). No invites were sent. Shopify and affiliates are later decisions informed by first-cohort usage.

`npm run check` passes (84 tests at the implementation checkpoint), and the immutable hosted migration ledger check passes. The new migration, real Auth invite/template and phone flow still need live integration and release checks; local Docker/Podman is unavailable here. Publication status is recorded below after release work.

---

# Founder Daily Driver V1 — 2026-09-25

Command now offers one next move from saved founder state; Ascend Profile allows a direct direction save without an AI proposal. All ten existing migration source filenames now match the hosted versions, with SQL bytes verified against the read-only hosted ledger and guarded by `npm run db:ledger`. This is a no-DDL source reconciliation; see [Founder Daily Driver](FOUNDER_DAILY_DRIVER.md). The physical-device founder journey and seven-day use remain acceptance gates. Earlier migration instructions below are historical and use superseded filenames.

---

# Founder activation foundation — 2026-09-24

Recovered the exact hosted grooming and founder-access SQL migrations into
source and added person-bound founder authority to the consumer app. A trusted
founder grant unlocks implemented nonclinical capabilities without a paid tier;
the account page displays verification. Clinical care and cross-person data
remain inaccessible. See [founder activation](FOUNDER_ACTIVATION.md).

The Gent Ascend hosted database had no Auth users at inspection. The Auth
Admin account creation, trusted founder grant, real hosted login and paid
model reply remain pending. No production DDL is needed by this code release.
Older migration history versions differ between GitHub and hosted ledger;
do not run `db push` until reconciled in a separate maintenance change.

---

# Cross-app publication foundation — 2026-09-24

Added a reviewed public brand-knowledge snapshot with a schema and edition in
`src/domains/intelligence/published-knowledge.ts`. Member Aethelios receives
these facts as data regardless of the separate personal-context preference;
the prompt version records the change. See [cross-app contract](AETHELIOS_INTEROP.md).
This is a manually curated snapshot, not a live connection to the private
Aethelios workspace or an export of founder memory. No new routes, secrets,
database permissions, repository access or coding tools were added. Live
deployment and provider acceptance are pending.

CI integration follow-up: the first PR quality run passed the application job
but failed local Auth because disabling `auth.email.enable_signup` also disabled
password login for seeded synthetic users. Local email is now enabled while
project-wide signup stays disabled. The next database job passed Auth and
integration, then found a founder Playwright selector that matched both the
profile conflict alert and Next.js's route announcer. It now scopes the
assertion to the Personal profile form. Re-run both jobs before merge.

---

# Direct OpenAI deployment preparation — 2026-09-22

Current official repository: https://github.com/neilaureliuscollective/gent-ascend-collective-app

The existing app now calls OpenAI directly with server-only `OPENAI_API_KEY`, using the existing model as `gpt-6-astra`. Gateway routing and credits are no longer required. OpenAI response storage is disabled; Supabase conversations, explicit memory confirmation, ownership checks, quotas and error redaction are preserved. The broader Gent Ascend Collective product transformation remains unimplemented pending founder approval.

Fresh checks: `npm run check` passed (lint, typecheck, 65 unit/SQL/mock-provider tests, Next.js production build). The direct-provider regression test intercepts fetch and verifies the OpenAI endpoint, authorization, streamed output and `store: false`; it is not a live paid-model test. `git diff --check` passed. No UI changes were made. Production-server HTTP smoke checks passed: home and Aethelios return 200, `/dev` returns 404, missing-origin chat requests return 403 and valid same-origin anonymous requests return 401.

Fresh browser regression is unrun: Playwright Chromium download repeatedly returned an invalid archive. Real Supabase Auth/PostgREST, hosted migrations, founder access and paid OpenAI account/model access remain unverified. No production deployment or database mutation was performed.

Terminal Git push authentication is unavailable. Publication uses the connected GitHub integration and the complete current source snapshot. All 15 original commits and exact objects remain recoverable in `docs/history/pre-openai-history.bundle`; see its README. The source/history scan found no candidate private API keys. No live credentials are committed.

Follow [Vercel setup](VERCEL_SETUP.md) for the required Supabase variables, OpenAI key, migrations and hosted founder beta grant. Earlier status records below are historical and their Gateway/repository instructions are superseded here.

---

# Execution status — 2026-09-22 / Aethelios

**Latest milestone: Aethelios is the Digital Co-Founder of Gent Ascend Collective.** The former public AI name is retired. Conversation screens, dashboard links, global panel, accessible labels, loading/error/memory copy and the versioned model instructions use Aethelios. An optional portrait introduction explains the human founder relationship and daily guidance. Legacy Reserve and the official company crest remain unchanged. [Identity and implementation](AETHELIOS_IDENTITY.md).

## Current verification

- Final `npm run check`: lint and strict typecheck pass; **63 unit/SQL/mock-provider tests** pass, including identity boundaries and finite insight/milestone responses.
- Production build passes with canonical `/aethelios` and `/aethelios/meet` routes and a query-preserving redirect from the legacy route.
- Full browser regression: **53/53 passed**. After the final orb composition and same-page panel navigation refinements, **10/10 focused browser checks passed**: introduction/portrait and whole-orb visibility at 344/768/1440px, same-page introduction navigation, short screens, 200% text and responsive orb controls. The complete 53-test suite was not repeated after those focused refinements; all changed behavior has fresh targeted coverage.
- Portrait introduction reviewed at 344/768/1440px. The cover layout stacks portrait and story; unfolded and desktop use deliberate two-column compositions. The optional portrait is a 76KB WebP; it adds no image payload to the daily command or conversation routes.
- The orb keeps its static fallback, reduced-motion/Still controls and optional bounded 3D scene. Voice states remain clearly labeled previews with no microphone or audio. Insight/milestone use finite two/three-second energy responses.
- Auth services, Supabase adapters, SQL migrations, membership/authorization contracts, dependencies and Vercel configuration are unchanged. Saved historical conversation text is preserved. The new public route is included in session-refresh middleware.

**Still unverified:** real Supabase Auth/PostgREST and hosted persistence, live paid AI responses, physical Fold GPU/keyboard behavior and device PWA installation. Browser intercepts and SQL fixtures do not establish live-service acceptance. No GitHub push or deployment was performed.

The identity correction supersedes prior AI naming directions, including historical documents below. Existing internal API/environment/storage identifiers are intentionally retained for compatibility.

---

## Previous migration record (historical identity; superseded above)

# Execution status — 2026-09-22

**Latest milestone: Gent Ascend Collective migration complete in the existing codebase.** Exact founder logo master preserved; derived crest/wordmark/app icons, centralized obsidian/green/gold tokens, refined dashboard and account identity, shared shell and forms, clear Legacy Reserve relationship, updated public metadata and the green/gold Aurelius orb. Aurelius remains the AI; Aethelos is the crest archetype. [Migration details](GENT_ASCEND_MIGRATION.md), [identity](BRAND_IDENTITY.md), [design system](DESIGN_SYSTEM.md).

## Current verification

- Final `npm run check`: lint, strict typecheck, **61 unit/SQL/mock-provider tests**, and production build all pass.
- Full sequential browser run: **48/49 passed**, identifying 200% text overflow in the longer brand header. Corrected with header reflow. Visual inspection also caught the desktop launcher overlapping navigation; moved it into normal sidebar flow.
- Final focused regression run: **15/15 passed**, covering the corrected 200% text/short-screen editor, brand/assets/manifest at 344/768/1440, desktop navigation/launcher separation, shell/dialog keyboard behavior, global conversation panel, motion/material preferences, unsupported WebGL and hosted harness denial. Across the full run and final targeted rerun, all 49 distinct browser scenarios have passing results; there was no second full-suite run after the layout-only fixes.
- Final dashboard and account screenshots at 344/768/1440 reviewed. No page overflow in asserted layouts; logo/manifest/icon routes valid. Orb lifecycle/voice-preview isolation/context-loss/adaptive fallback passed in the full run. No remaining violet hex colors in active CSS; original master SHA-256 matches the uploaded source.
- Test runtime allowances: database initialization 60 seconds; browser assertions 15 seconds/scenarios 90 seconds. No assertions skipped or weakened. Initial short-budget parallel browser attempt was interrupted after timing failures; sequential runs above are the acceptance evidence.
- Auth, API routes, Supabase adapters, all four migrations, package/lockfile and Vercel configuration unchanged. AI prompt receives only a versioned brand-architecture correction.

**Still unverified:** actual Supabase Auth/PostgREST and hosted persistence; live paid AI requests; physical Fold GPU/keyboard behavior and device PWA installation. No services or credentials were fabricated. No GitHub push or Vercel deployment was performed during this migration. Existing technical names intentionally remain stable.

The current source and all prior history are preserved in the migration handoff. The execution checkout is `/workspace/scratch/2f4521030116/gent-ascend`, restored from the original history bundle; it is not the founder's mounted Desktop. Follow VERCEL_SETUP.md and reconcile any unpushed workstation changes before repository synchronization.

---

## Historical milestone log (superseded by the current identity and verification above)

# Execution status — 2026-09-21

**Latest release preparation:** restored the exact `cf141f8` application and all 12 original commits from the saved Git bundle after the transient execution checkout was lost. Clean npm install and production/Vercel-flagged lint, strict typing, 61 unit/SQL/mock SDK tests and build passed using synthetic build-only Supabase values. No real service connection is claimed. The connected GitHub account is now the correct owner with admin/write permission, but terminal Git lacks authentication; the dry-run push was rejected for missing credentials. Remote main is still unpublished. [Release readiness](RELEASE_READINESS.md) and [fresh Vercel setup](VERCEL_SETUP.md) explain the remaining steps. No application behavior or dependencies changed in this release review.

**Latest milestone: Aurelius 1F Orb implemented and locally verified.** Founder-approved focus on Aurelius’s visual presence: dark crystalline core, reflective gold orbit bands, a beveled compass star, internal light, matching SVG fallback and labeled voice-motion previews. `/aurelius` → **Explore the Orb** works without credentials; microphone and audio remain off. Real request/stop states take precedence. Adaptive detail and sustained-frame-budget fallback preserve usability. No new dependency, service, schema, model or authorization behavior. Scope/research: [AURELIUS_1F.md](AURELIUS_1F.md). Lint/typecheck/production build, 61 unit/SQL/mock SDK tests and 46 browser tests pass. Physical-device, live Auth/model and voice acceptance remain separate and open. Nothing pushed or deployed. Initial home JS 154,433 encoded bytes (+545 vs 1E), CSS 16,626 (+761); the full conversation including deferred graphics is 331,345 JS bytes. Final software-WebGL desktop RAF p95 was 83.3ms and triggered detail reduction; sustained physical-device smoothness is not established. Phone/unfolded lab p95 values were 16.8/16.7ms. Screenshots and evidence are recorded in the 1F handoff.

**Previous milestone: Aurelius 1E materials and connected light implemented and locally verified.** Founder-approved correction replaces the pervasive purple wash with neutral obsidian/charcoal, richer metallic gold controls and localized purple. Decorative orbital paths respond to navigation; a finite arrival sweep and interaction highlights preserve Still/reduced-motion/solid modes. No new dependencies, initial canvas, schema, auth or model changes. Scope/research: [AURELIUS_1E.md](AURELIUS_1E.md). Lint/typecheck/build, 59 unit/SQL/mock SDK tests and 40 browser tests pass. Initial home JS 153,888 encoded bytes (+749 vs 1D), CSS 15,865 (+684). Screenshots at 390/768/1440 reviewed, no overflow/page errors. Local 120-frame samples: p95 16.7ms phone viewport, 16.8ms desktop; not physical-device or battery evidence.

**Previous milestone: Aurelius 1D daily dashboard implemented; verification results below.** The founder explicitly authorized the daily dashboard while postponing backend/GitHub activation and all human/body modeling. See [research, scope and evidence](DAILY_DASHBOARD.md). Command now supports a daily intention, optional self-reported energy/sleep, five bounded actions, 7/30-day observations, evening reflection, active goal and Aurelius conversation entry points. Public sample mode is clearly fictional, in-memory only and performs no API writes. Personal mode uses an additive migration and real owner-scoped save/read contracts. No new packages or model behavior.

**Previous milestone: Aurelius 1C visual elevation implemented and locally verified.** The founder supplied the official logo and authorized building. Its sampled aubergine palette now anchors the shell, Command and Aurelius. Original artwork is preserved; transparent seal, compact app icons, self-hosted typography, controlled glass/motion and a deferred 3D brand globe are implemented. See [AURELIUS_1C.md](AURELIUS_1C.md) and [BRAND_IDENTITY.md](BRAND_IDENTITY.md). Lint/typecheck/build, 53 unit/SQL/SDK tests and 30 browser tests pass. Physical-device and live-service gates remain open.

**Previous milestone: Aurelius 1B workspace refinement implemented and locally verified.** The founder explicitly deferred GitHub reconnection and live-service testing, and authorized continuing the premium structure and experience. See [Aurelius 1B](AURELIUS_1B.md). Saved-conversation search/navigation, personal-context cards, refined memory presentation and an honest signed-out preview are now available. No provider, auth, billing or database permissions changed. The remaining real-service gates below still apply.

Canonical repository update: founder created https://github.com/neilaureliuscollective/aurelius-collective-app. Verified it exists and is empty; changed this checkout's origin and project rules to the new destination while retaining the existing folder and complete history. At that earlier point the connected GitHub identity lacked write access; the latest release review above supersedes that account status. Pending: reconnect the new account, verify authorization, push main, then import this new repo into Vercel. This execution checkout is not the founder's mounted Desktop.

Deployment preparation: added explicit Vercel framework/install/build settings and [fresh deployment instructions](VERCEL_SETUP.md). Git push was attempted with founder authorization but failed for missing terminal credentials; the connected GitHub account also reports read-only repository access. Remote remains empty. No deployment was performed. Hosted founder access uses the existing real Auth + server-stored beta grant, not the local harness. Current AI adapter requires a Gateway key; an OpenAI key alone is not read.

Re-ran lint, typecheck, all 53 unit/SQL/SDK tests and production build with `APP_ENV=production`, Vercel production flags, harness disabled and explicitly synthetic Supabase build values: all passed. These values were command-scoped, never committed, and do not represent a connected backend. That production-environment configuration check preceded Aurelius 1B. The current UI milestone also passes a fresh normal production build and 25 browser checks.

**Aurelius 1A implemented in code; real-service acceptance remains open.** The founder explicitly prioritized usable Aurelius before metrics/routines. Stage 0 complete; prior Stage 1/2A real-Supabase gates also remain open. Nothing deployed or pushed remotely.

## Current working scope

The existing strict Next/React/Tailwind foundation, profile/goals and protected real-identity founder harness remain intact. Added:

- Shared Aurelius conversation interface in the global panel and full workspace; responsive composer, safe Markdown, streaming, stop, saved conversation selection and deletion.
- AI SDK 7.0.107 ToolLoopAgent through Gateway; verified/configurable initial model openai/gpt-6-astra; versioned instructions distilled from both approved doctrine documents, mirrored in docs/doctrine.
- Session-bound owner context from profile, active goal and confirmed memory; visible Context tab and per-message opt-out.
- Explicit memory create/correct/forget with provenance and stale-version checks. No automatic inference promoted to fact.
- Reply feedback and local founder-console review of “Needs work” replies.
- Atomic turn reservation, idempotency, rolling usage limits, pending lease recovery, partial/failed/cancelled states and persistence-before-saved acknowledgment.
- Private conversation/turn/memory/usage tables with RLS, owner-scoped RPCs and deletion behavior. No service-role application client.
- Operator activation guide, evaluation rubric, updated roadmap and a separate live-provider smoke command.

## Observed checks

| Gate                                 | Result                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| ESLint                               | Passed, zero warnings                                                                                  |
| Strict typecheck                     | Passed                                                                                                 |
| Unit + SQL + SDK mock-provider tests | 61 passed                                                                                              |
| Production build                     | Passed                                                                                                 |
| Browser interactions                 | 46 passed; Orb lifecycle/preview/adaptive fallback plus conversation, daily, editor and security flows |
| Migration chain                      | Four migrations executed in PGlite; explicit minimal Auth adapter                                      |
| UI inspection                        | Phone/desktop conversation screenshots reviewed; composer and empty heading visible in viewport        |
| Actual Supabase reset/Auth/PostgREST | Unrun: Docker/Podman unavailable                                                                       |
| Real founder browser journey         | Extended for daily persistence; unrun without local Supabase                                           |
| Paid live-model smoke                | Unrun: no AI_GATEWAY_API_KEY configured                                                                |
| Intelligence-quality evaluation      | Unrun; requires real founder conversations                                                             |
| GitHub CI / remote push              | Not performed; last verified connector access is read-only                                             |
| Hosted preview / production          | None                                                                                                   |

Aurelius browser tests intercept API traffic with synthetic records; they do not prove live persistence or model quality. SDK adapter tests use the actual AI SDK with a mock provider. SQL tests validate Postgres logic via PGlite, not GoTrue/PostgREST. Fixture screenshots explicitly label synthetic records; disconnected preview screenshots show empty presentation data and the preview notice. Never equate these with the outstanding real-service checks.

Browser checks use temporary Chromium 153 outside the app, system fonts and two workers. Tests caught and resolved valid-origin comparison against Next's internal host and initial transcript scrolling. The 1B checks also caught and fixed a squeezed welcome heading at 768px; search, history selection and preview no-write behavior are covered. Model middleware tests verify provider-error redaction before SDK default logging.

## Limits and remaining work

- This Work checkout is /root/Desktop/aurelius-og with the official remote. The founder's computer Desktop is not mounted; unpushed workstation files remain unknown. Preserve them before importing this work.
- Commits are local. The official GitHub remote was empty at inspection and write access was unavailable. Updated handoff retains source/history/screenshots; do not replace the official folder blindly.
- No API key or real Supabase session was fabricated. Actual founder use requires those connections. No phone-installable hosted build is available yet.
- Database types are a hand-maintained SQL contract pending actual CLI generation/reconciliation.
- Current limits: 100 conversations, 200 turns/conversation, 24 confirmed memories, 20 recent complete exchanges within a 32,000-character history context. Older saved messages are not all automatically recalled. Full budgets/timeouts are in AI_ARCHITECTURE.md.
- Owner-controlled AI RPC records/token counts are not tamper-proof billing/clinical audit evidence.
- Web research, voice, files, tool actions, automatic memory proposals, cross-chat summaries, embeddings, clinical integrations and Stripe remain unimplemented.
- Gateway/provider retention and logs, BYOK policy, staging access, backup/export/deletion/usage retention and sensitive-data contracts require review before beta personal-data operation. No production PHI was introduced.

## Exact next step

Founder review of the Aurelius 1E dashboard/materials on a real phone/foldable, then service activation and daily Aurelius evaluation. No body model is scheduled. The disconnected sample can be tested immediately by running the existing checkout and selecting **Explore a sample day**.

When ready, sync the preserved history into the official workstation checkout, reconnect the new GitHub account, and configure protected Vercel/Supabase/Gateway access. Apply all four migrations, run real integration/founder/live-provider gates, then use Aurelius daily and assess quality with the existing rubric. Daily records are not automatically in AI context; the next intelligence slice should add a user-reviewed, source-linked daily briefing only after live quality, ownership and privacy validation. A phone-installable hosted preview follows verified Auth/HTTPS setup; never expose the local harness.
# Ascend Loop V1 work in progress

The first slice is documented in [ASCEND_LOOP_V1.md](ASCEND_LOOP_V1.md). It adds owner-scoped universal capture, optional structured Aethelios interpretation, a confirmed capture-to-daily-action path, carried-forward daily context, opt-in recent daily context for Aethelios, and a factual 30-day Progress history. This branch has not been deployed or migrated against hosted Supabase. Conversational baseline, full action tool registry and review extraction remain open.
# Ascend Profile baseline continuation

The next Ascend Loop slice is described in [ASCEND_PROFILE_PHASE.md](ASCEND_PROFILE_PHASE.md). The six-step guided baseline proposes structured facts and requires user confirmation. Corrections supersede active values with owner-scoped revision history. Command and optional Aethelios context consume current confirmed state. Proposal usage shares the existing AI quota. Both Ascend Loop migrations must precede app deployment; hosted migration, live model and two-account Auth verification remain open.
# Aethelios confirmed action boundary

See [AETHELIOS_ACTION_PHASE.md](AETHELIOS_ACTION_PHASE.md). A saved conversation turn can now yield a reviewable `create_daily_action` proposal. Approval executes an owner-scoped atomic daily write; dismissal makes no daily change. The general tool registry and guided evening extraction remain open. Three ordered Ascend Loop migrations must precede deployment.

# Guided evening review and tomorrow context

See [ASCEND_EVENING_REVIEW.md](ASCEND_EVENING_REVIEW.md). Command now offers a confirmed, editable evening review. Aethelios can propose a draft from saved reflection and action status; manual entry works without the model. Versioned owner-only reviews feed tomorrow's Command, opt-in Aethelios context and Progress, with correction history. Four ordered migrations must precede deployment. A general tool registry, hosted Auth verification, live-model quality, device testing and lifecycle controls remain open.
