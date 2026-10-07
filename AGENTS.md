> Public Aethelios visual update (2026-10-07): the founder approved BLACK × GOLD × AETHER PETROL. Read docs/AETHER_PETROL.md. This supersedes all green/plum brand guidance below for this repository. Use src/platform/visual/aether-palette.json as the color source; retain existing functional/accessibility guards. Public descriptor: PERSONAL INTELLIGENCE OS.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

- Current Command visual identity (2026-10-04): read docs/COMMAND_IMMERSIVE.md. Use the existing flowing `EnergyOrb` / `world-energy-renderer` from cinematic arrival/world, including the matching static fallback. Do not reintroduce `AureliusPresence` / `presence-renderer` metal-band-and-star artwork into Command or its shared shortcut. AURELIUS_1F.md is historical for this surface. Keep saved-record source connections truthful and motion purely decorative; no implied listening, analysis or background agency.

- Command orchestration Phase2 (2026-10-04): read docs/COMMAND_ORCHESTRATION.md. Use the request-time Command service and shared next-move resolver; keep exact source/day/version/owner confirmation guards and existing atomic daily RPCs. Preparation/receipts are deterministic saved-record views, not LLM or background-agent activity. Preserve per-message model consent, mounted-only change comparison, uncertain-write replay lock and deeper-draft isolation. No public cinematic prefetch from the workspace sidebar.

- Public Mission Continuity (2026-10-07): read `docs/MISSION_CONTINUITY.md` before changing Mission/Talk/Studio handoffs. Public Aethelios is a Personal Intelligence OS for outside users of any gender, not the private Founder platform. Keep independent personal/Mission context controls, exact revision receipts, explicit direction review, idempotent Studio links and personal/company isolation. Do not reintroduce manual continuation prompts or imply background work. This phase does not override separately approved brand tokens.

- Public Mission Deliverables (2026-10-07): read `docs/MISSION_DELIVERABLES.md` before changing artifact/version/review flows. Creation uses completed personal Mission replies; edits append immutable versions. Human review is exact-version assessment, never a claim of external verification. Keep session-bound exports, idempotent creation, stale-write guards, opt-in bounded context receipts and preservation after Mission removal.
