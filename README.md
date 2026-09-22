# Gent Ascend Collective

A men’s personal operating environment. Aurelius is the intelligence inside Gent Ascend. See [brand migration](docs/GENT_ASCEND_MIGRATION.md) for the latest implementation.

Canonical personal operating environment. Read [project rules](AGENTS.md) and [current status](docs/STATUS.md) first.

For the fresh GitHub → Vercel deployment, follow [Vercel setup](docs/VERCEL_SETUP.md): exact import settings, required environment variables, hosted migrations, founder beta access and OpenAI/Gateway connection.

Node 24, npm. `npm ci`, then `npm run dev` renders the application shell at http://127.0.0.1:3000 without external credentials. For real founder identity/persistence, start Docker and run `npm run dev:setup`; follow the generated local entry instruction. No Stripe, SMTP or production onboarding required.

`npm run check` runs lint, typecheck, unit and fast SQL/RLS tests, then production build. `npm run test:e2e` checks the built application and isolated editor components (synthetic actions, no database). Install Chromium first with `npx playwright install chromium`. `npm run test:integration` requires running local Supabase and exercises real Auth, profile/goal persistence, event creation and ownership. `npm run test:founder` runs the full browser journey against local Supabase; use a fresh synthetic seed with no active founder/member goal. `npm run db:reset` resets local synthetic data; never use production data here.

Architecture and stages: [architecture](docs/ARCHITECTURE.md), [roadmap](docs/BUILD_ROADMAP.md), [developer harness](docs/DEVELOPMENT_HARNESS.md).

The personal foundation now includes profile editing, one active goal with a concrete next step, Command context and completed/archived goal history. It uses actual Supabase persistence when configured. Stage 1/2A remain pending real-Supabase acceptance in this execution environment; see [current status](docs/STATUS.md).

On a Docker-capable machine, from this repository: `npm ci`, `npm run dev:setup`, `npm run test:integration`, `npm run test:founder`. For an existing local database that lacks the new migration, stop the app and use `npx supabase migration up --local` to preserve local data, or deliberately use `npm run db:reset` for a clean synthetic state. Never reset a hosted database.

`npm run db:types` writes a separate generated comparison file; reconcile it with the currently hand-maintained `database.ts` contract after local Supabase validation. SQL grants, rather than generated TypeScript Insert/Update shapes, enforce write permissions.

Aurelius 1A is now implemented: shared global/full-screen conversation UI, AI SDK streaming, saved history, profile/goal context, user-confirmed memory and reply feedback. Read [activation and acceptance](docs/AURELIUS_1A.md) and [AI architecture](docs/AI_ARCHITECTURE.md). Configure the server-only `AI_GATEWAY_API_KEY` in ignored `.env.local`; the app is honest about unavailable replies when the key is missing. `npm run test:ai:live` makes one synthetic paid-provider connection test and is separate from normal CI. Real service checks remain pending in this environment.

Aurelius 1B adds a searchable conversation library, refined context/memory views and a signed-out workspace preview. Open `/aurelius` to explore it without credentials; drafting is temporary and sending/saving stays disabled until authorized services are connected. See [scope and checks](docs/AURELIUS_1B.md). The founder has deferred GitHub reconnection; the current milestone remains local until that step.

Aurelius 1D adds the working daily dashboard. From `/`, select **Explore a sample day** to try intention, energy/sleep, actions, history and reflection without credentials; sample edits disappear on exit/reload. Real personal saves use the fourth migration and authenticated Supabase ownership. [Dashboard research and build](docs/DAILY_DASHBOARD.md) records the scope, evidence and remaining gates. No human/body model is included. `scripts/dashboard-audit.mjs` captures current daily screenshots and local resource measurements after a production build.

Aurelius 1E refines the daily dashboard/shared shell with obsidian surfaces, metallic gold and concentrated purple, plus lightweight orbital lighting. [Material decisions and evidence](docs/AURELIUS_1E.md) record accessibility/performance limits. Still mode remains available; no new service or body model is required.

Aurelius 1F upgrades the shared Orb with a dark crystalline core, reflective gold bands and layered light. Open `/aurelius` → **Explore the Orb** to inspect Ready/Listening/Preparing/Speaking/Stopped visual previews. Microphone and audio remain off. The same identity works in Still mode and without WebGL. [Scope, research and limits](docs/AURELIUS_1F.md); `scripts/orb-audit.mjs` captures the actual UI and local rendering evidence.
