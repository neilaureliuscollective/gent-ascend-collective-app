# Decisions and research evidence

2026-09-21 — Founder selected the new canonical repository https://github.com/neilaureliuscollective/aurelius-collective-app.git under the new neilaureliuscollective account. It supersedes legacy-sanctum-co/aurelius-collective-app. Preserve ~/Desktop/aurelius-og and all commits; change origin rather than reinitialize or transfer the old empty remote. GitHub confirmed the new repository exists and is empty. Write authentication remains pending.

Checked 2026-09-20. Published npm latest metadata corroborated framework versions; lockfile is authoritative for actual install.

| Decision                                  | Rationale / tradeoff                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next 16.3.5, React 19.3, Node 24, ESM     | Stable published releases; Node satisfies Next >=20.9, Supabase >=22 and AI SDK >=22                                                                                                                                     |
| TypeScript 6.0.3 + ESLint 9.39.5, strict  | Latest compatible stable lines: Next bundled plugins reject TypeScript 7 (<6.1 peer) and ESLint 10. ESLint 9 has an upstream deprecation notice; reassess Next lint tooling before beta. Do not force unsupported peers. |
| SQL migrations + typed Supabase SDK       | One schema authority; fewer dependencies than simultaneous ORM migrations                                                                                                                                                |
| Local real Auth founder entry             | Exercises RLS and ownership; requires Docker-backed local Supabase                                                                                                                                                       |
| Harness local only                        | Strong isolation; hosted founder testing uses real beta grants instead                                                                                                                                                   |
| Tier != role != clinical grant            | Prevents paid/simulated access becoming clinical/admin authorization                                                                                                                                                     |
| AI SDK deferred                           | Package 7.0.107 bundled docs verified Node 22+, ESM and separate workflow adapter; no AI runtime needed in Stage 1                                                                                                       |
| Four navigation anchors + global Aurelius | Scalable starting hypothesis; revise with observed use                                                                                                                                                                   |
| No service worker private cache           | PWA foundation without persisting sensitive responses offline                                                                                                                                                            |
| No deployment in Stage 1                  | Founder approval required for production; preview unnecessary until gates pass                                                                                                                                           |

## Official sources

- [Next installation](https://nextjs.org/docs/app/getting-started/installation): 16.3.5, Node minimum, standalone lint required in Next 16.
- [React versions](https://react.dev/versions).
- [Tailwind Next setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs): cookie clients, verified claims, proxy refresh; never authorize from getSession alone.
- [Supabase local environments](https://supabase.com/docs/guides/deployment/managing-environments), [seeds](https://supabase.com/docs/guides/local-development/seeding-your-database): migrations + repeatable local resets.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): explicit role grants and owner policies.
- [Supabase HIPAA](https://supabase.com/docs/guides/security/hipaa-compliance), [HIPAA project](https://supabase.com/docs/guides/platform/hipaa-projects): BAA, add-on, High Compliance and shared responsibility.
- [Stripe subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [webhooks](https://docs.stripe.com/webhooks): verify signature, process async lifecycle, handle ordering/retries and duplicate events.
- [AI package metadata](https://registry.npmjs.org/ai/latest): 7.0.107 and Node >=22. Bundled v7 migration and agent references also inspected; runtimeContext and WorkflowAgent verified, detailed integration deferred.

## Repository inspection

Official public remote was empty (no refs/commits); no local application files or history to preserve in this session's checkout. Founder computer's Desktop is not mounted and unpushed workstation files cannot be inspected. Remote checked out at /root/Desktop/aurelius-og, origin unchanged. GitHub connector reported pull=true, push=false. Do not claim that local commits have reached GitHub.

## Stage 2A decisions — 2026-09-20

- Build the first useful personal action: edit profile, choose a goal/next step, see it on Command, then complete/archive. Reuse the existing modular monolith, real session and RLS boundary.
- One active goal is an explicit, reversible first-slice limit. It keeps Command focused and the first founder journey small enough to validate. Multiple concurrent goals and progress percentages are deferred.
- Basic profile and goals are free capabilities; payment and onboarding cannot gate them. This is not a final pricing promise.
- Use optimistic versions to reject stale edits. Controlled React fields retain drafts after failed actions; conflicts require reloading instead of silently overwriting.
- Narrow database triggers maintain version/time and goal events in the same transaction. No workflow engine or second event database.
- Vite 8.3.0, already in Vitest's dependency graph, is now an explicit development dependency solely for isolated real-component browser tests. Fixtures are outside Next routes, marked synthetic, served only on loopback and contain no real credentials. They do not substitute for the separate real Auth/Next/Supabase founder journey.
- Keep Stage 1 and Stage 2A signoff open until actual Supabase reset/Auth/PostgREST and founder browser tests pass. Docker remains unavailable here; GitHub access remains read-only.

Official references rechecked: [Next forms](https://nextjs.org/docs/app/guides/forms), [React useActionState](https://react.dev/reference/react/useActionState), [Supabase database functions](https://supabase.com/docs/guides/database/functions). No new production integration was introduced.

## Aurelius 1A — 2026-09-20

The founder explicitly reordered the roadmap: usable Aurelius comes before metrics/routines. Scope: one reusable conversation service, streaming/history, explicit memory controls, context inspection and feedback. No live research, voice, tools or autonomous mutation yet. The missing capabilities are stated in both UI and runtime instructions.

Read the approved Thinking/Reasoning and Personality/Voice/Temperament v1 doctrines from their current saved documents; mirrored them in docs/doctrine. Prompt distillation is versioned and reviewable. Model changes and prompt changes are not silent self-modification.

Verified npm ai@7.0.107 (Node >=22, ESM), its bundled ToolLoopAgent, streamText, middleware, v4 mock-model and gateway references/source. Verified current Gateway catalog at https://ai-gateway.vercel.sh/v1/models; chose openai/gpt-6-astra as the initial high-capability candidate, configurable server-side. This is not a benchmark claim. No automatic multi-model routing/fallback was added by application code; Gateway's own routing/settings must be reviewed before sensitive beta data.

No additional provider SDK or workflow engine. Added react-markdown@10.1.0 for safe formatted answers; official README confirms default URL safety and warns against unsafe transforms/plugins. Raw HTML and remote image rendering are disabled. Vite remains test-only.

Research sources: [AI SDK agents](https://ai-sdk.dev/docs/agents/building-agents), [message persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence), [Gateway provider options](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options), [disallow prompt training](https://vercel.com/docs/ai-gateway/security-and-compliance/disallow-prompt-training), [ZDR](https://vercel.com/docs/ai-gateway/security-and-compliance/zdr), [React Markdown](https://github.com/remarkjs/react-markdown). AI SDK web pages returned unsupported content types; installed official package docs/source supplied the implementation reference instead.

Gateway no-training filtering is available without requiring a paid hosting plan. ZDR has separate plan/provider requirements and is not claimed here. No PHI approval or infrastructure claim is introduced.

## Aurelius 1B — 2026-09-21

Founder authorization: postpone GitHub reconnection and bot testing; continue the premium structure and experience. Keep the canonical repository and complete history. No push or deployment in this phase.

A 401 from the existing workspace read endpoint renders an empty, visibly labeled preview. This is not a developer bypass: no synthetic identity, entitlement, private records or model answers. Sending is guarded even for keyboard submission; memory writes are disabled. All server authorization remains unchanged. Other server failures remain errors instead of being concealed as a preview.

Conversation navigation is a title-only local filter over already-authorized records. Desktop has a sidebar; smaller widths have an expandable library. Reuse the same session-bound API and shared conversation surface, including the global panel. Personal context is inspectable with explicit inclusion state and bounded-history limitations. Memory remains user-confirmed.

No new packages, APIs, schema, paid services or model behavior. Used existing installed Next/React guidance and existing test harness. The visual refinement is independently verifiable; it does not close outstanding actual Supabase and paid-provider acceptance gates.

## Aurelius 1C research — proposed, not accepted

2026-09-21: founder requested research and a concise visual/build proposal for approval, not immediate implementation. Audited existing UI and researched primary design guidance, color psychology, motivation/habit research, accessibility and web rendering performance. Findings, sources, evidence limits, proposed tokens and acceptance gates are in AESTHETIC_ELEVATION_PROPOSAL.md. No production code, dependency, model behavior, security or infrastructure changed. Next visual implementation waits for founder approval.

## 2026-09-21 — approved identity and Aurelius 1C

The founder supplied the official seal and explicitly requested implementation using its purple. This approves the pending visual proposal and supersedes its provisional palette. Keep the original untouched; use a prepared transparent derivative and a distinct compact digital icon. Sampled enamel anchor #150319. Brand provenance, source hashes and derivative limitations live in BRAND_IDENTITY.md.

Implemented local Sora/Inter (OFL assets, combined 81,908 bytes), shared CSS materials, responsive navigation and one optional Three 0.186.0 scene. Three was chosen for a bounded procedural brand focal point, not a body model or new domain. Dynamic import, static SVG, 1.5 DPR cap, motion preference enforcement and cleanup are mandatory. No React Three Fiber, animation framework, paid assets or extra backend vendor. Initial JavaScript increase 7,485 encoded bytes; optional scene increase 133,447 bytes in the recorded local audit. See AURELIUS_1C.md for evidence and limitations.

No auth, RLS, billing, AI instructions or schema changes. No remote push/deployment. Real services and actual device evaluation remain the next gates.

## 2026-09-21 — Aurelius 1D daily dashboard

Founder explicitly requested research plus implementation while deferring human/body modeling. This supersedes 1C's earlier recommendation to stop at the visual shell. Keep a useful daily loop: arrive, choose, act, reflect. Approved aubergine/gold remains canonical; shared brand imagery is not personal anatomy. Research/limits: DAILY_DASHBOARD.md.

Five actions and one intention are reversible first-slice product limits, not pricing rules. Energy is a 1–5 user report; sleep is manually entered, never a wearable score. No synthetic AI brief/readiness index, streak pressure or unrelated dashboard modules. Morning/evening lens is chosen by the person. No new dependency or infrastructure.

A clearly labeled synthetic sample enables disconnected interaction without a forged identity or persistent browser health data. Personal mode adds normalized daily entries/actions with RLS and an atomic versioned owner-derived RPC. Same-statement embedded reads avoid mixed entry/action versions. Validation loads on interaction rather than inflating the initial dashboard bundle. The dashboard uses the existing static globe; optional canvas remains in the Aurelius welcome only.

Daily data stays outside model context until a separate explicit briefing/context decision. Generic allowlisted starters prefill a draft, never send automatically; a validated conversation UUID resumes authorized history. Live connections, physical-device acceptance and real Supabase gates remain open. No remote push or deployment.

## 2026-09-21 — Aurelius 1E materials and light

Founder approved the researched visual correction: obsidian/charcoal lead, warmer metallic gold, localized approved purple, consistent light and orbital geometry. Implementation/research: AURELIUS_1E.md. Route-aware SVG paths are decorative only. Finite entry/interaction highlights use CSS transforms/opacity; no new framework/renderer/package or body model. Dialog mutation observation extends the existing quiet-state behavior. Personal features, schema and intelligence contracts are unchanged. Physical-device acceptance remains open; no deployment.

## 2026-09-21 — Aurelius 1F focused Orb upgrade

Founder approved the researched Orb proposal. Preserve the logo and 1E environment; refine only the shared Orb, its full-workspace presentation and narrowly related responsive behavior. Use existing Three with standard metallic materials, a small procedural studio reflection map and a bounded core shader. No new renderer dependency, full transmission, postprocessing or downloaded model. Static SVG remains complete.

Listening/speaking are explicitly visual previews until real voice exists. The preview has no microphone, audio, model request or persistence. Actual request/stop state takes precedence. CPU/software-WebGL checks cannot certify phone thermals or battery; add adaptive resolution and preserve lifecycle pause/disposal. Scope and references: AURELIUS_1F.md. No push or deployment.


## 2026-09-22 — Founder selects direct OpenAI and new GitHub destination

Use https://github.com/neilaureliuscollective/gent-ascend-collective-app for this existing application. Connect directly to OpenAI using server-only OPENAI_API_KEY so usage draws on the founder's existing OpenAI API credits. Retain AI SDK 7.0.107 and add compatible @ai-sdk/openai 4.0.72 (provider protocol 4.0.17). Use Responses with store=false, explicit api.openai.com base URL, no Gateway fallback, unchanged quotas and error redaction. Keep the existing default model as gpt-6-astra, verified in OpenAI documentation. Broader product pivot remains planning-only.

Official references checked: https://ai-sdk.dev/providers/ai-sdk-providers/openai.md and https://developers.openai.com/api/docs/models/gpt-6-astra. Provider package source and the existing lockfile verified for compatibility. Live key/account model access is not verified by mock tests.
