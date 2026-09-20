# Technical architecture

## Runtime and composition

Next.js App Router modular monolith, React, strict TypeScript, Tailwind CSS 4 tokens. Node 24 LTS, ESM, npm lockfile. Server Components compose authenticated reads; interactive islands own transient UI only. Server Actions/route handlers validate input and call domain services. Runtime configuration is server-only and fails closed.

Supabase Postgres/Auth is the sole application persistence and identity platform. Use the Supabase SDK with schema-derived database types (manual migration contract pending verified CLI generation); SQL migrations are the source of schema truth. No second ORM or migration system at this stage. Private Storage buckets arrive with the first real file feature.

src/app: route composition, error/loading boundaries, metadata.
src/components: shared responsive shell and accessible interactions.
src/domains: identity, person, goals, access, billing, intelligence, timeline and development. Add concrete domains when needed, not empty packages for every roadmap noun.
src/platform: environment and Supabase adapters.
supabase: migrations, deterministic synthetic seed, local configuration.
tests: policy, SQL/RLS and browser verification.

## Request boundary

Request → verified Supabase session → person lookup → ownership/capability policy → domain service → session-bound database client. Proxy refreshes cookies; it is not the only authorization boundary. Protect each private service/action too. Authenticated responses are no-store; avoid shared caching of personal data.

## Events and longitudinal context

Use typed domain tables for facts. A personal_events table carries event kind/version, owner, occurred_at, recorded_at, source and a reference to a domain record. No duplicated clinical values in a generic payload. Write record + event transactionally. Stage 2A uses a narrow database trigger for goal lifecycle events. It is a timeline projection, not event sourcing. Use compound ownership references for links where possible; otherwise domain resolution must re-check ownership. Later integrations use unique external-source IDs and idempotent ingestion.

## Navigation proposal

Four stable destinations: Command (today), My world (domains), Progress (longitudinal), You (profile/vault/settings). Aurelius is a persistent contextual panel, with a full conversation workspace at /aurelius when more space is useful. The shared domain service and reusable UI power both surfaces. Community and commerce can appear within My world and relevant tasks. This is a reversible Stage 1 hypothesis, to be tested with founder use. No inaccessible maze of 25 tabs; capability registry will drive discoverable modules as they become real.

## Billing boundary

Stripe customer/subscription → verified idempotent webhook → application billing snapshot → capability policy → service/UI access. No Stripe calls during page rendering. Product/price identifiers are configuration, never amounts embedded in authorization. Handle duplicates and out-of-order events by reconciling current Stripe state; record event receipt and processing atomically. Stripe test mode and real beta flows come later.

## Digital twin extension

Body domain owns measurement/scan records, method, units, consent, timestamps and uncertainty. A read projection composes body state for interchangeable renderers. A renderer is never a source of health truth. No mesh/3D dependency now.

## Deployment and environments

Local: Docker-backed Supabase CLI, synthetic data, explicitly enabled founder harness, no hosted credentials. Shell can render without services but cannot claim persisted identity.
Preview/staging: protected Vercel preview, dedicated non-production Supabase project, real Auth and Stripe test mode, no local harness. Initially use one controlled staging branch to avoid cross-branch destructive migration conflicts; isolated Supabase branches can follow when needed.
Production: separate Supabase project/secrets, Stripe live, no seed identities, no harness. Require reviewed migrations and founder deployment approval. Build artifact carries no development secrets. Configure APP_ENV explicitly; VERCEL_ENV=production must match production.

CI validates pull requests without production secrets. Promote additive migrations before code that needs them. Never run db reset or seed against hosted projects. Prefer expand/migrate/contract changes; application rollback does not undo data migrations. Establish backup/restore drill before beta personal data. No deployment in Stage 1.

## Risks

Harness leakage (layered denial + negative tests); health-data drift (classification and explicit clinical boundary); permission confusion (separate roles/tiers/clinical grant); navigation sprawl (module registry and contextual surfacing); AI overreach (provenance and scoped tools); service overhead (defer until useful); empty remote repo and read-only connector (local commits require later sync).
