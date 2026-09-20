# Project constitution

Status: accepted from founder brief, 2026-09-20. Engineering choices below are reversible unless explicitly stated.

## Priorities

Product usefulness, reliable access, privacy, maintainability, premium UX and delivery velocity. One codebase and one initial application database. Prefer a small working vertical slice over speculative horizontal infrastructure.

## Invariants

1. Every private record belongs to a person. An authenticated principal resolves to a person server-side; ownership never comes from client input alone.
2. Normal database access carries that user's Supabase session. Service credentials are restricted to controlled operational tools and future webhook processing.
3. Founder development is independent of production billing, SMTP and onboarding. Database setup remains necessary to test real persistence and RLS; a shell preview must not be represented as a persisted account.
4. Entitlements express product access, not ownership, administrator privileges or clinical eligibility.
5. AI output is a suggestion with provenance, not a canonical fact or provider decision. External actions and consequential changes require scoped authorization.
6. Regulated care stays behind a separate application boundary. A schema name alone does not constitute regulatory compliance.
7. Development convenience must fail closed in hosted/production execution.
8. Product identity and major business changes require explicit founder visibility. Decisions and exceptions are documented.

## Definition of done

Reviewable code, updated documents, meaningful tests, actual gate results, no unlabeled fabricated data and a reproducible local path. An unrun mandatory gate means the stage remains open.

## Scope discipline

Stage 1: responsive shell, config, session adapters, local founder entry, console skeleton, capability policy, first migration/seeds and CI. Do not implement the five-year roadmap. See BUILD_ROADMAP.md for exit criteria.
