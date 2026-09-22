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
