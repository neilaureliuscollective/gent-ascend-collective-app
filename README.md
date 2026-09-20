# Aurelius Collective

Canonical personal operating environment. Read [project rules](AGENTS.md) and [current status](docs/STATUS.md) first.

Node 24, npm. `npm ci`, then `npm run dev` renders the Stage 1 shell at http://127.0.0.1:3000 without external credentials. For real founder identity/persistence, start Docker and run `npm run dev:setup`; follow the generated local entry instruction. No Stripe, SMTP or production onboarding required.

`npm run check` runs lint, typecheck, unit and fast SQL/RLS tests, then production build. `npm run test:e2e` checks the built application. `npm run test:integration` requires running local Supabase and exercises real Auth and ownership. `npm run db:reset` resets local synthetic data; never use production data here.

Architecture and stages: [architecture](docs/ARCHITECTURE.md), [roadmap](docs/BUILD_ROADMAP.md), [developer harness](docs/DEVELOPMENT_HARNESS.md).
