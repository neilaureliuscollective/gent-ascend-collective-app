# Gent Ascend Collective — canonical project rules

> Current founder-approved direction (2026-09-26): Arrival + Command is implemented on the working branch. Read docs/ARRIVAL_COMMAND.md (or ARRIVAL_COMMAND.md from docs/) for public `/` + member `/app` architecture, honest product previews, Reserve gateway, installation and mobile Aethelios. This supersedes older dashboard-first and commerce-last sequencing below. Production promotion still requires founder approval and the recorded release gates.


Official repository: https://github.com/neilaureliuscollective/gent-ascend-collective-app.git
Founder workstation: ~/Desktop/aurelius-og. Remote execution checkouts of this same repository are not replacement projects. Never initialize a competing repository or reuse an older build.

Read docs/PROJECT_CONSTITUTION.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_HARNESS.md and docs/BUILD_ROADMAP.md before changes. Check git status and preserve existing work.

- Aethelios is the Digital Co-Founder and public intelligence; the former AI name is retired. Atlas is a separate founder system.
- Build a strict TypeScript modular monolith with person-centered domain ownership. Routes compose domain services; they do not own business rules.
- Never block founder development behind production email, onboarding, payment or subscription. Keep real local Supabase identity and RLS; no forged user headers, query bypass, client-controlled privileges, or service-role data access for normal users.
- Harness is local-only: explicit opt-in, development runtime, no hosted deployment, loopback origin, local Supabase, authenticated seeded founder for mutations. Reject incompatible configuration. Production and preview must return 404 for harness routes/actions. Test this before release.
- Membership, role, beta grant, feature availability and clinical authorization are independent. A paid tier never authorizes clinical care. Admin simulation never grants access to other people.
- Hosted founder authority is the person-bound `founder_access` row, read with the user's session and RLS. It grants implemented nonclinical access independently of membership. Never expose `/dev` on hosted deployments or derive founder status from email/user metadata.
- No speculative infrastructure. No AI, Stripe, workflow, vectors or clinical integrations until the corresponding useful slice requires them.
- Preserve RLS, least privilege and server validation. User metadata is not an authorization source. No secrets, production records or personal medical history in seeds, logs, tests or public Git.
- Research current official APIs and package compatibility before major integrations; record evidence and dates in docs/DECISIONS.md.
- Current founder identity: Gent Ascend Collective, obsidian #050706 / green #0B3B32 / gold #C4912F. Aethelios is the Digital Co-Founder; preserve the official crest artwork; Legacy Reserve is the product brand. Premium typography and considered spacing; no generic template UI. Verify phone, unfolded width and desktop, keyboard, focus, contrast and reduced motion.
- Run lint, typecheck, unit tests, production build, interaction tests and migration checks before declaring Stage 1 complete. Mark unrun gates explicitly; never equate SQL emulation with a real Supabase Auth test.
- Commit meaningful milestones. No history rewriting or production deployment without founder approval. Do not silently change major product decisions.
- Update docs/STATUS.md with implemented behavior, limitations and next stage. Keep placeholders honest and sample data labeled.

- Founder sequence update: usable Aethelios is the immediate priority before metrics/routines. Read docs/AURELIUS_1A.md and docs/doctrine/ before changing AI behavior.
- Never label mock-provider or intercepted-browser results as a live model test. Never claim ChatGPT parity without measured founder evaluation.
- AI output is never auto-promoted to memory. Only explicit user confirmation writes memory; private history/context uses session-bound ownership. Maintain stream save acknowledgments, quotas and error redaction.

- The 2026-09-22 Gent Ascend logo and green/gold palette supersede all previous purple direction: read docs/BRAND_IDENTITY.md and docs/DESIGN_SYSTEM.md. Preserve the original master. The core green is #0B3B32; use the supplied standing gentleman crest. The classical figure belongs to the approved seal, not every interface surface. Keep decorative 3D optional, bounded and independent of personal data.

- Founder sequence update: Aurelius 1D daily dashboard is authorized before live activation. Read docs/DAILY_DASHBOARD.md. Do not build any human/body model until requirements/measurements are ready. Keep self-reports distinct from imported/derived readings; never invent an AI briefing or readiness score. Sample mode is labeled, in-memory and never a privilege bypass. Daily private data is not automatically model context.

- Current visual direction is Gent Ascend (docs/GENT_ASCEND_MIGRATION.md). Historical 1E colors are superseded by obsidian, green and gold. Connection geometry is decorative navigation, never evidence of live integrations. Preserve Still/solid/reduced-motion and dialog quiet behavior.

- Aurelius 1F owns the current Orb (docs/AURELIUS_1F.md): preserve the static fallback, bounded optional scene, adaptive resolution and lifecycle cleanup. Listening/speaking are labeled visual previews with no audio/microphone; never imply live voice or replace real request/save/error status with a demo.

- Latest founder correction: read docs/AETHELIOS_IDENTITY.md. Aethelios extends the human founder’s mission; he never replaces people or claims human experience. Public AI copy must use Aethelios, including voice previews and metadata. Stable API/database/environment identifiers remain unchanged. The authorized fictional portrait is an identity asset, not a body/health model.

- Founder deployment decision, 2026-09-22: use OpenAI directly with server-only OPENAI_API_KEY and existing OpenAI API credits. No AI Gateway billing or routing. The repository above supersedes the old repository URL. Broader Collective product transformation remains in planning until approved.
