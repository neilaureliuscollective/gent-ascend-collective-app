# Aurelius Collective — canonical project rules

Official repository: https://github.com/neilaureliuscollective/aurelius-collective-app.git
Founder workstation: ~/Desktop/aurelius-og. Remote execution checkouts of this same repository are not replacement projects. Never initialize a competing repository or reuse an older build.

Read docs/PROJECT_CONSTITUTION.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_HARNESS.md and docs/BUILD_ROADMAP.md before changes. Check git status and preserve existing work.

- Aurelius is the public system intelligence. Atlas is a separate founder system.
- Build a strict TypeScript modular monolith with person-centered domain ownership. Routes compose domain services; they do not own business rules.
- Never block founder development behind production email, onboarding, payment or subscription. Keep real local Supabase identity and RLS; no forged user headers, query bypass, client-controlled privileges, or service-role data access for normal users.
- Harness is local-only: explicit opt-in, development runtime, no hosted deployment, loopback origin, local Supabase, authenticated seeded founder for mutations. Reject incompatible configuration. Production and preview must return 404 for harness routes/actions. Test this before release.
- Membership, role, beta grant, feature availability and clinical authorization are independent. A paid tier never authorizes clinical care. Admin simulation never grants access to other people.
- No speculative infrastructure. No AI, Stripe, workflow, vectors or clinical integrations until the corresponding useful slice requires them.
- Preserve RLS, least privilege and server validation. User metadata is not an authorization source. No secrets, production records or personal medical history in seeds, logs, tests or public Git.
- Research current official APIs and package compatibility before major integrations; record evidence and dates in docs/DECISIONS.md.
- Obsidian/gold/deep purple, premium typography and considered spacing; no generic template UI. Verify phone, unfolded width and desktop, keyboard, focus, contrast and reduced motion.
- Run lint, typecheck, unit tests, production build, interaction tests and migration checks before declaring Stage 1 complete. Mark unrun gates explicitly; never equate SQL emulation with a real Supabase Auth test.
- Commit meaningful milestones. No history rewriting or production deployment without founder approval. Do not silently change major product decisions.
- Update docs/STATUS.md with implemented behavior, limitations and next stage. Keep placeholders honest and sample data labeled.

- Founder sequence update: usable Aurelius is the immediate priority before metrics/routines. Read docs/AURELIUS_1A.md and docs/doctrine/ before changing AI behavior.
- Never label mock-provider or intercepted-browser results as a live model test. Never claim ChatGPT parity without measured founder evaluation.
- AI output is never auto-promoted to memory. Only explicit user confirmation writes memory; private history/context uses session-bound ownership. Maintain stream save acknowledgments, quotas and error redaction.

- Founder-approved logo and purple are canonical: read docs/BRAND_IDENTITY.md and docs/DESIGN_SYSTEM.md. Preserve the original master. The core purple is dark aubergine #150319; do not substitute neon/blue-violet. The classical figure belongs to the approved seal, not every interface surface. Keep decorative 3D optional, bounded and independent of personal data.

- Founder sequence update: Aurelius 1D daily dashboard is authorized before live activation. Read docs/DAILY_DASHBOARD.md. Do not build any human/body model until requirements/measurements are ready. Keep self-reports distinct from imported/derived readings; never invent an AI briefing or readiness score. Sample mode is labeled, in-memory and never a privilege bypass. Daily private data is not automatically model context.
