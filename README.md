# Aurelius Collective

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
