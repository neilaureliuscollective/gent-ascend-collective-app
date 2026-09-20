# Founder development harness

## Access architecture

The full local path uses real Supabase Auth and session cookies. A local seed creates a synthetic founder user and corresponding person/membership. Founder entry signs into that seeded account; every application read uses its authenticated JWT and RLS. No service-role application client, forged JWT or request-provided user ID.

Enable only when all conditions hold: NODE_ENV=development; APP_ENV=local; explicit AURELIUS_DEV_HARNESS=true; VERCEL/VERCEL_ENV absent; Supabase URL (if set) is loopback; request origin/host is loopback; and a random server-only bootstrap token is supplied on initial entry. CLI setup generates that token in ignored .env.local and prints a local entry instruction. Keep the Next dev listener bound to 127.0.0.1.

Initial entry exchanges the token for a normal local Supabase session. Before rendering the console or applying scenario changes, verify the session and exact seeded founder Auth ID. A copied scenario cookie is insufficient. The scenario is signed, short lived, owner-bound and httpOnly; validate it on every read. Same-origin POST is required for mutation. Production build/runtime reject enabled harness configuration. Routes return 404 outside local development even if queried directly.

## Three modes

Developer: immediate local founder session; payment/email/onboarding are not gates. Default developer access grants implemented nonclinical capabilities; scenario mode can intentionally reduce them for testing. Admin simulation is a presentation scenario, not another person's data access. Health simulation enables only a future informational surface, never clinical permissions.
Beta: real hosted Auth + RLS, server-stored invitation grant, Stripe test state, normal onboarding; founder has explicit beta grant instead of a development backdoor.
Production: real Auth and billing; no harness entry, overrides or seed credentials. Production environment with harness flag is a configuration error.

## Stage 1 controls

Console skeleton: selectable free/Aurelius/Health/beta/admin scenarios, billing states and onboarding state. Expose planned feature toggles as disabled until corresponding services exist. No fake buttons for unimplemented destructive data operations. Reset data through explicit local-only CLI now. Persona history packs (new/30 day/6 month/athlete/health/customer), memory clearing and full feature switches follow in Stage 2 as those schemas exist.

## Commands and protection

npm run dev:setup starts local Supabase, generates local-only credentials/config and seeds the founder via the local Auth admin API. It refuses to overwrite non-local existing configuration. npm run dev starts loopback Next. npm run db:reset is explicitly destructive to local synthetic data and uses --local; setup then recreates test identities. Hosted DB reset is never an application feature.

If Docker is unavailable, the shell remains inspectable and tests can run, but founder persistence and real Auth acceptance remain unverified. Never label a fixture shell as a complete founder harness.

## Required abuse cases

Hosted preview and production flag combinations; hostile Origin/Host; invalid/absent bootstrap token; unauthenticated scenario mutation; non-founder session; expired/tampered scenario; cross-person reads/writes; billing self-escalation; anonymous database access. Assert both positive local behavior and negative production behavior.
