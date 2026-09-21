# Execution status — 2026-09-21

**Latest milestone: Aurelius 1B workspace refinement implemented and locally verified.** The founder explicitly deferred GitHub reconnection and live-service testing, and authorized continuing the premium structure and experience. See [Aurelius 1B](AURELIUS_1B.md). Saved-conversation search/navigation, personal-context cards, refined memory presentation and an honest signed-out preview are now available. No provider, auth, billing or database permissions changed. The remaining real-service gates below still apply.

Canonical repository update: founder created https://github.com/neilaureliuscollective/aurelius-collective-app. Verified it exists and is empty; changed this checkout's origin and project rules to the new destination while retaining the existing folder and complete history. The connected GitHub identity still lacks write access. Pending: reconnect the new account, verify authorization, push main, then import this new repo into Vercel. This execution checkout is not the founder's mounted Desktop.

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

| Gate                                 | Result                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| ESLint                               | Passed, zero warnings                                                                           |
| Strict typecheck                     | Passed                                                                                          |
| Unit + SQL + SDK mock-provider tests | 53 passed                                                                                       |
| Production build                     | Passed                                                                                          |
| Browser interactions                 | 25 passed at 360/768/1440px                                                                     |
| Migration chain                      | Three migrations executed in PGlite; explicit minimal Auth adapter                              |
| UI inspection                        | Phone/desktop conversation screenshots reviewed; composer and empty heading visible in viewport |
| Actual Supabase reset/Auth/PostgREST | Unrun: Docker/Podman unavailable                                                                |
| Real founder browser journey         | Extended for memory persistence; unrun without local Supabase                                   |
| Paid live-model smoke                | Unrun: no AI_GATEWAY_API_KEY configured                                                         |
| Intelligence-quality evaluation      | Unrun; requires real founder conversations                                                      |
| GitHub CI / remote push              | Not performed; last verified connector access is read-only                                      |
| Hosted preview / production          | None                                                                                            |

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

No founder setup is required to preserve this milestone. GitHub reconnection is deliberately deferred. When the founder is ready, import/sync this committed milestone into the existing official checkout with write-authorized access. On a Docker-capable machine configure Supabase and a dedicated Gateway key, run the real integration/founder/live-model tests, and resolve any differences. Then Neil uses Aurelius daily and flags quality failures. Prioritize conversation quality, continuity and sourced research before expanding dashboard modules. A protected phone-installable preview follows verified hosted Auth and HTTPS/PWA setup; never expose the local developer harness.
