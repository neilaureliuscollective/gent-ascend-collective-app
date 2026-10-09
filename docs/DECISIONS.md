# Commerce visual correction — 2026-10-02

Published Shopify photography is authoritative merchandise media and must not require a separate story approval flag. Keep Shopify CDN validation; keep optional true product models separately approved. Remove fabricated vessels from commerce fallback; use labeled missing photography. Use the existing GSAP stack for scoped scroll choreography with Still/reduced-motion cleanup and bounded catalog animation. Sources: https://shopify.dev/docs/api/storefront/latest/objects/MediaImage ; https://gsap.com/docs/v3/GSAP/gsap.matchMedia/ ; https://web.dev/articles/animations-guide . Founder explicitly approved implementation and previously authorized live commerce publication.

# Decisions and research evidence

2026-09-28 — Studio project workspace phase two. Retain the working private project, reference and image-version tables; add only `creative_type` and an owner-edited JSON brief to projects. The brief is validated on the server and guides subsequent image generation while each image's original user request remains saved. A compare-and-swap `updated_at` check prevents overwriting an edit made elsewhere. Creation paths are prompts for intent, not new model modes or unsupported claims. The Library gathers versions and references; refinement continues to use a saved image. Video is deferred until its task lifecycle, pricing and moderation are separately designed. Official references reviewed: [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route), [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries), [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/), and [Runway product ad recipe](https://docs.dev.runwayml.com/recipes/product-ad/). Existing migration owner policies cover the new project columns. `20260928015000_studio_project_briefs.sql` must be applied before this code is promoted to a hosted environment.

2026-09-28 — Aethelios conversation room phase one. The signed-in `/app/aethelios` experience uses a dedicated visual viewport, an independently scrolling message region and an expandable composer. Reuse the public `IntelligenceOrb` shader for the member welcome and active-conversation indicator, with a CSS static fallback and the existing user Still/reduced-motion preference; keep existing conversation, memory and founder-bridge APIs untouched. The prior member orb renderer remains in other app surfaces. `VisualViewport` measures the keyboard-visible height where supported; `dvh` and safe-area insets provide the CSS fallback. Official references reviewed: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [MDN viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length), and installed Next.js 16.3.5 App Router CSS and Server/Client Component guides. The browser runner could not download a valid Chromium archive; physical Fold keyboard and WebGL performance remain unverified.


2026-09-27 — Ascend Journey mobile motion correction. The first preview revealed an incorrect desktop-only cinematic breakpoint. Keep native document scrolling and sticky, scrubbed compositions at Fold and phone widths with the existing GSAP ScrollTrigger dependency. Narrow screens change composition and duration, not whether the scene is directed. Still and OS reduced motion retain the complete normal-flow reading path. `svh` provides stable scene geometry while mobile browser chrome changes; transforms and opacity carry foreground motion. Official references: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [Chrome viewport units](https://developer.chrome.com/blog/whats-new-css-ui-2023), [web.dev animation performance](https://web.dev/articles/animations-and-performance). Hardware review remains necessary before any performance claim or production promotion.

2026-09-27 — Ascend Journey Phase 3. Make the existing ritual scene human first, then reveal one product. Reuse the real Vitalis concept assets and opt-in 3D atelier instead of introducing a second 3D canvas or five simultaneous product animations on the homepage. A 91 KB concept mirror frame supplies the human moment. Desktop uses a bounded two-beat ScrollTrigger; touch/short/Still/reduced-motion layouts show both complete panels in document flow. Section ResizeObserver refreshes scroll measurements after responsive height changes. Preserve global Shop access and honest nonorderable preview status. Official [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [Next 16 Image](https://nextjs.org/docs/app/api-reference/components/image), [web.dev responsive images](https://web.dev/learn/design/responsive-images) and [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) reviewed. [Baymard homepage/category research](https://baymard.com/research/homepage-and-category-usability) informs direct product finding, not a measured conversion claim. Physical Fold/Safari and field performance remain unverified.

2026-09-27 — Ascend Journey Phase 2. Reuse the existing GSAP/native-scroll architecture for one complete authored LifeOS decision instead of adding a renderer, smooth-scroll library or simulated private data. Desktop threshold updates hold the scene long enough to understand each step; touch and short viewport layouts use explicit buttons and document flow. Browser work should primarily change opacity/transform and respect reduced motion and Still. The current member Ascend Loop (`/app/ascend`, Command, goals and review) supports confirmed human actions; public presentation avoids claiming autonomous personal state changes. Official references reviewed: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [web.dev animation performance](https://web.dev/articles/animations-guide/), [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), and [Chrome foldable viewport segments](https://developer.chrome.com/blog/viewport-segments-api-shipped). Layout uses responsive CSS rather than hinging on viewport segment support.

2026-09-27 — Ascend Journey Phase 1. Extend the `cinematic-estate` branch rather than replace its GSAP/Three architecture. The public opening becomes threshold → human → shared Aethelios visual → six-stage LifeOS representation; existing commerce preview and Reserve chapters remain reachable. Native scroll, semantic server HTML, the existing orb renderer, and natural-flow phone/tablet layouts minimize duplicated rendering systems and touch-scroll risk. WebGPU, audio, full 3D human modeling, and smooth-scroll interception are deferred. The illustrated man is a concept asset, not a member or health model. Official documentation reviewed: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading), [React Three Fiber performance scaling](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [Web Vitals](https://web.dev/articles/vitals), [W3C reduced motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39), and [Chrome viewport segments](https://developer.chrome.com/blog/viewport-segments-api-shipped). The repo uses direct Three.js, so R3F was researched but not introduced. No field-performance or physical Fold claim follows from browser emulation.

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

# 2026-09-24 — Aethelios cross-app publication seam

Keep the private founder workspace and member app independently authorized.
Start with a manually reviewed, editioned public fact snapshot in the member
app. Personal memory and private founder knowledge are excluded. Only after a
real publication workflow needs automation should a server-side, read-only
approved-edition feed replace the snapshot. Current Supabase RLS guidance
requires authorization at the data boundary; app OAuth scopes alone do not
restrict database data. References checked 2026-09-24:
https://supabase.com/docs/guides/database/postgres/row-level-security and
https://supabase.com/docs/guides/auth/oauth-server/token-security.

## 2026-09-25 — Confirmed evening reviews, separate from chat and memory

Extend the existing daily record with a versioned, person-owned review rather than promoting conversational text to memory. Aethelios may propose an editable three-field draft from a saved day, but confirmation records the user's choice. The RPC checks local day and source/review versions under the same person lock as daily writes; revision history preserves corrections. Command carries tomorrow context and unresolved friction, while Progress reads historical confirmed reviews. No causal patterns are inferred from sparse records. Primary technical references checked 2026-09-25: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data and https://supabase.com/docs/guides/api/securing-your-api and https://supabase.com/docs/guides/database/functions. Supabase changelog index was attempted but not retrievable from this environment; verify it alongside real migration testing before deployment.

## 2026-09-25 — Private Founding Members pilot

Founder requested a parallel next build while he tests the daily system. Prioritize a 4–6-person private cohort over commerce/affiliate breadth: use a founder-reserved normalized email, Supabase Auth's verified identity and an owner-derived claim RPC to grant existing beta capability. Dashboard invitation is a separate trusted manual step, avoiding a service-role secret in the consumer app. SSR invite template sends a token hash to `/auth/confirm`; no public signup. Feedback is voluntary and visible to the founder, while LifeOS records remain owner-only. Official Supabase email template/Next.js SSR guidance, function security and RLS were checked 2026-09-25; links and acceptance limits are in [pilot plan](FOUNDING_MEMBERS_PILOT.md).

## 2026-09-26 — Arrival + Command

Founder approved public world + existing OS route separation, preview collections, Reserve gateway and install/mobile conversation improvements. Preserve the modular monolith, RLS, model adapter and existing AI persistence. Keep Shopify, paid membership and real Reserve activation in subsequent gated slices.

Evidence reviewed in this session:

- Next.js route groups: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- Shopify Cart API and checkout handoff: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage
- Shopify customer accounts: https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api
- Shopify product subscriptions: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/subscriptions
- Install criteria: https://web.dev/articles/install-criteria
- Safari 26 Home Screen behavior: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Visual viewport/keyboard: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
- Video loading: https://web.dev/articles/lazy-loading-video and https://web.dev/learn/performance/video-performance

See ARRIVAL_COMMAND.md and CINEMATIC_MEDIA_PLAN.md for implementation boundaries and shooting/replacement plan.

## 2026-09-26 — Cinematic Emerald public foundation

Founder approved implementation after reviewing the first public pass. Use the existing Next.js/Three.js architecture with one native-scroll director, emerald materials, dimensional sections and a lazy interactive product study. No scroll interception or always-running 3D loop. Keep official crest and current API/auth/commerce boundaries. See CINEMATIC_EMERALD.md for official source links, implementation limits and the follow-on Grooming Discovery and guest intelligence sequence.

## 2026-09-26 — Directed cinematic homepage

Founder approved a continuous public journey following storyboard/research. Added GSAP + @gsap/react for scoped scroll timelines now that the opening needs coordinated scene staging. Preserved native scrolling, Next server content, existing public/private boundaries and media slots. Three.js intelligence sculpture loads near view with still/context-loss fallback and full disposal. Original environment/campaign imagery and supplied five-product references are documented in CINEMATIC_ESTATE.md. No final SKU 3D accuracy claim; exact flat labels/dimensions remain prerequisites for final merchandise models. Official references: https://gsap.com/resources/React/ , https://gsap.com/docs/v3/Plugins/ScrollTrigger/ , https://modelviewer.dev/examples/color , https://threejs.org/docs/pages/GLTFLoader.html .

## 2026-09-26 — Living Estate and updated founder seal

Founder approved environment build and supplied new tailored-gentleman crest. Preserve exact original crest, use generated companion only for small install icons; retain old originals. Ambient scene layers complement native scroll; pause offscreen/hidden/Still/reduced motion. Selective Three armillary with environment reflections, no real-time shadow maps. Generated Reserve image clearly labeled as atmosphere concept, Gent emblem removed from Reserve representation. Product generated cutouts are campaign visualizations, not print label masters. See LIVING_ESTATE.md for sources, placement plan and limitations.

## 2026-09-26 — one Aethelios visual and stable scene architecture

Founder approved the public scene repair. Reuse the existing member orb renderer and fallback through a public decorative adapter; remove the parallel faceted sculpture. Do not import conversation services or simulate microphone/model activity. Keep architectural backgrounds stable and animate bounded foregrounds. Native sticky stages have a measured navigation inset and only activate where the viewport can contain the composition. Public Reserve representation centers consultation/products/relationship alongside Katie's salon craft, with honest concept/availability labels. Sources, tradeoffs and hardware limitations: SCENE_REPAIR.md.

## 2026-09-27 — Ascend Journey Phase 5: public-to-personal entrance

The former `/enter` redirect now renders inside the existing public layout, preserving the same crest, obsidian/green/gold materials, persistent Shop navigation and optional Still mode. Its account state is resolved server-side from the existing verified Supabase claims; it does not infer access from metadata or a client flag. The existing password Server Action and private invitation claim remain authoritative. An allowlisted form marker only chooses whether sign-in errors return to `/enter` or the legacy `/app/you` form; successful sign-in still sends ready members to Command and others to the founding-member welcome. The verified invite callback retains its direct welcome route. That screen now shares the entrance motif in both claim and first-session states. No open registration, new Auth provider, new data read, RLS change or artificial transition delay is added.

Research checked against the September 27 Supabase [SSR client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Auth changelog](https://supabase.com/changelog?tags=auth), [getClaims reference](https://supabase.com/docs/reference/javascript/auth-getclaims), Next.js 16 [route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) and [Server Function redirect](https://nextjs.org/docs/app/api-reference/functions/redirect), and [W3C reduced motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39). The route group preserves `/enter` as the URL; a server action redirect supports progressive enhancement; cookie-backed SSR and the existing proxy retain the session. The existing stack has no relevant breaking change requiring a package or auth architecture migration. The visual handoff uses CSS and a shared image, not a second WebGL canvas or a forced route animation.

## 2026-09-27 — Commerce Spine V1

Founder approved the planning pass for implementation. Build within the existing Next.js public shop, using Shopify Headless Storefront API `2026-07` for merchandise/cart and Shopify-hosted checkout. Keep Supabase Auth/membership independent; guest and members can shop without claiming automatic Shopify customer association. Retain preview data when a live store is unavailable, and exclude subscription-only items until the Headless channel path is verified. Activation, boundaries and primary references are in [Commerce Spine V1](COMMERCE_SPINE_V1.md).

## Aethelios Studio V1 — 2026-09-27

Founder requested research and execution of the next phase after Chat Foundation. Reuse the verified session/capability boundary and private Supabase Storage. Keep project/version lineage in application Postgres, render with the current OpenAI Responses image tool using `store:false`, and send the selected saved image as an input for edits. This avoids relying on provider conversation retention while preserving a future bridge from chat messages to Studio versions. Fast/precise model selection, a 12-request rolling allowance, one in-flight request and explicit saved outcomes bound initial cost. Sources and open gates are in [AETHELIOS_STUDIO_V1.md](AETHELIOS_STUDIO_V1.md).

## Aethelios Chat + Studio release hardening — 2026-09-27

A read-only hosted audit revealed 16 applied Gent Ascend/Reserve migrations in one Supabase project, whereas this repository owns eleven of them. A broad CLI migration push is unsafe until the shared ledger is reconciled. Release only the two reviewed, ordered Aethelios migrations through a controlled migration step, after staging/ownership testing. Replace the 10 MB upload-through-Function with direct private Storage upload and server-validated finalization; Vercel's 4.5 MB Function body limit makes the original route fail on common phone photos. See [AETHELIOS_RELEASE_READINESS.md](AETHELIOS_RELEASE_READINESS.md) for exact gates and primary references.

## Grooming Concierge reconstruction — 2026-09-28

Use one person-owned domain migration and a controlled release after the lost local-only phase commits. Scan interpretations remain qualitative; generated looks are separate from progress evidence; professional handoff shares selected text only and requires member acceptance for service history. Keep Reserve schedules and private staff notes outside Gent Ascend. Supabase RLS and Storage boundaries: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/storage/security/access-control . See [recovery brief](GROOMING_CONCIERGE_RECOVERY.md).

2026-09-28 — Studio storyboard phase three. A project now holds up to eight ordered scene briefs, each with a message, visual direction, placement and optional motion concept. Scenes can attach completed images from the same project; generating a new frame through the existing private image path links it back to the scene after success. Images survive scene deletion in the project Library. The board can be printed for review. A locked database RPC enforces scene count under concurrent requests, owner RLS restricts rows, column grants prevent moving ownership or order, and a composite key prevents images from another project being linked. This is an editorial workflow, not video generation. Runway's [multi-shot recipe](https://docs.dev.runwayml.com/recipes/multi-shot-video/) and [async task SDK](https://docs.dev.runwayml.com/) informed the eventual motion path; paid video, task state, moderation and export need separate implementation. Apply `20260928015000_studio_project_briefs.sql` then `20260928020000_studio_storyboard.sql` before preview or production promotion.
2026-09-28 — Studio Finish phase four. A saved image can enter a dedicated finishing room with three canvas formats, three restrained editorial treatments, text hierarchy and focal controls. The same browser canvas is used for preview and PNG export, so the exported pixels match the visible composition. One private composition per completed image is persisted with owner RLS, a composite same-project image key, explicit field limits, and optimistic revision matching. Existing original images stay unchanged. Text is user-authored to avoid unreviewed brand claims. This adds no paid provider. Future video needs a separate provider task lifecycle, cost and failure model. Reviewed [MDN canvas drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage), [toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) and [blob URLs](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob) for the local export path. `20260928023000_studio_finishes.sql` follows the brief and storyboard migrations before hosted promotion.
2026-09-28 — Hosted Studio release privilege correction. Supabase's hosted default privileges granted `anon` and `authenticated` all table privileges at creation, despite narrower explicit grants. `20260928151124_studio_table_privileges.sql` revokes those defaults and regrants only the scene and finish operations the application uses. Scene creation remains through its owner-checked RPC, preserving the eight-scene concurrency limit. This migration follows the three Studio feature migrations. Verify effective `has_table_privilege` and RLS on hosted Supabase before deploying.

## 2026-09-28 — Ascend Performance Phase 1 (founder approved)

Add a Performance domain and member world inside the canonical application. Typed longitudinal facts and versioned plans remain distinct from Aethelios memory and future clinical Health Intelligence. Start with a complete strength practice/review loop and an explicitly consented device draft. The narrow progression rule produces a reviewable proposal; optional model interpretation cannot execute plan writes. Direct Health Connect/HealthKit access requires a future native component. Source evidence and remaining gates: [ASCEND_PERFORMANCE_PHASE_1.md](ASCEND_PERFORMANCE_PHASE_1.md).

## 2026-09-28 — Performance Phase 2: programs before predictive scores

Founder authorized research, planning and the next build. Add a repeating multi-session program and explicit session preparation on the existing Performance foundation. A deterministic preview and database reconstruction agree; the accepted and original plan persist with session history. No automatic load increase, clinical inference, calendar integration or measured readiness claim. Completion advances only the current revision's next slot. Research, boundaries and migration ordering: [Phase 2](ASCEND_PERFORMANCE_PHASE_2.md).

## 2026-09-28 — Ascend Performance Phase 3

Use a single owner-bound database evaluator for per-session progression preview and atomic acceptance. Preserve conservative rule versions and exact evidence; show missing evidence explicitly. Two recent comparable sessions can support one user-approved rep increase, with no load or autonomous changes. Research, thresholds, limitations, source references and sequencing: [Phase 3](ASCEND_PERFORMANCE_PHASE_3.md). Integrate current main Aethelios/Studio work; retain the whole-man hierarchy.

## 2026-09-28 — Performance Phase 4

Founder approved the next research/plan/build phase. Close the approved-decision loop with first-attempt outcomes before broadening adaptive programming. Read-only owner-RLS projection, immutable plan lineage, no cherry-picking and no causal claims. Existing consent gates Aethelios access. See [Phase 4](ASCEND_PERFORMANCE_PHASE_4.md) for primary sources and precise rules.

## 2026-09-28 — Performance Phase 5: Fuel & Body

Expand beyond training with a focused daily-total workflow and optional user-defined references. Reuse versioned check-ins to preserve recovery fields, and give reference targets their own versioned history. Report per-metric complete-day denominators and normalize original weight units; never score historical adherence against a newly changed target. Three readings in each of two adjacent weeks is a display threshold, not validated physiological accuracy. NIDDK self-monitoring and dynamic-model research, Supabase function/RLS documentation and the installed Next.js guide informed the boundaries; see [Phase 5 research and plan](ASCEND_PERFORMANCE_PHASE_5.md). No new provider or automatically calculated intake recommendation. The [revised V1 sequence](ASCEND_PERFORMANCE_ROADMAP.md) identifies four remaining core phases after this build; the flagship expansion has separate feasibility gates.

## 2026-09-28 — Performance Phase 6: Recovery & sleep

Founder authorized the next research/plan/build phase. Replace static Restore observations with focused capture, separate seven-day sleep/energy/soreness context, a daily user-chosen routine and exact next-day follow-through. Preserve existing fuel/body values and freeze past routine plans while allowing versioned corrections to follow-through. No causal improvement claim, fabricated readiness score, universal bedtime, new reminder or training mutation. [Research, scope, invariants and release gates](ASCEND_PERFORMANCE_PHASE_6.md). Three core phases remain in the revised V1 sequence.

## 2026-09-29 — Interaction System Phase 3 and recovery

Reuse the canonical remotely preserved Performance Phase 6 and merge released main before UI migration. Reconstruct shared native task sheets, retain drafts, and preserve domain persistence/offline semantics. My World remains the parent of both Performance and Grooming. Do not claim the pruned local Phase 2 code is recovered. Official interaction references, reconstruction scope and release limitations: [Phase 3](INTERACTION_SYSTEM_PHASE_3.md).

## 2026-10-02 — Whole-Man World vertical slice

Founder approved the world-entry plan. Use an additive `/experience` route family and a build-time homepage rollout switch, preserving the current private service contracts and routes. Keep GSAP for finite portal choreography, React ViewTransition for environment continuity, CSS for feedback, and the existing optional Three.js orb. Do not add Motion/R3F or a video pipeline without a demonstrated need. Guest reflection and workout recording are explicitly session-only and never grant identity/entitlements. Reuse Training and PerformanceWorkspace rather than duplicate workout persistence. See WHOLE_MAN_WORLD.md for current official documentation and release limits.

## 2026-10-02 — Whole Man World Phase 2: spatial mobile navigation

Founder requested deeper research and authorized implementation after rejecting the flat mobile composition. Use one architectural environment, four accessible destination nodes, the existing adaptive orb, a selected action and an on-demand direction sheet. Keep route selection in the URL and server-render the first scene. Bound ambient effects to transform/opacity; pause hidden/offscreen/modal motion and honor Still, OS preferences and Data Saver. Reuse all domain services. No added renderer, dependency or migration. Primary comparisons (Apple, Linear, Oura, Endel, Active Theory), technical references, phased plan and asset provenance: [Phase 2](WHOLE_MAN_WORLD_PHASE_2.md).


## 2026-10-02 — Follow the founder's energy-orb reference

The founder rejected the atlas's older metal-ring/star orb and supplied the Aethelios flowing violet sphere as the visual reference. Adapted the existing founder-owned `app/personal/living-orb.tsx` shader geometry/noise to emerald (#0B3B32 family) and fine gold (#C4912F family) rather than generating a bitmap or adding a rendering dependency. The new atlas-only renderer has a 480px canvas cap, 30fps target, adaptive pixel ratio, lifecycle disposal and pause on hidden/offscreen/dialog/input states. Context loss falls back to static SVG; Still and Data Saver do not mount the shader. Decorative energy never represents model activity or health measurements. Preserved established navigation targets and accessible button labels while replacing numbered node discs with distinctive illuminated glyphs.


## 2026-10-02 — World personal continuity reuses the daily intention

The next world phase surfaces one saved user-authored priority and next unfinished action. Reuse `daily_entries.intention` and `daily_save`; do not create a parallel task/priority store or infer destinations from personal text. A server-only daily projection returns minimal current-day data, with date/timezone/source shown in the focused editor. Mutation preserves the other daily fields, checks authenticated owner/date/version and relies on the existing atomic owner lock for races. Account ID in the request is a stale-session guard only. Failed/uncertain writes retain the draft and require deliberate reload, not automatic replay. The public scene paints independently, while private API responses remain no-store. No private browser persistence, dependency, migration, AI call or production promotion. Research sources and test limits: `WHOLE_MAN_WORLD_PHASE_3.md`.


## 2026-10-02 — Phase 4: Grooming world with recorded ritual practice

Expand the existing Grooming domain into a dedicated world, prioritizing a useful repeatable ritual over a second recommendation engine. Research reviewed L’Oréal Beauty Genius, Apple Custom Plans, NN/g progressive disclosure, W3C interaction patterns, Supabase query/insert contracts and web.dev animation guidance. Reuse the existing fictional mirror image, exact saved ritual steps and account-bound check-ins. Use the existing check-in UUID primary key for retry idempotency, with authorized owner and ritual validation; request ownership is only a stale-session guard. Keep guests local and explicitly labeled. Preserve Scan consent, Look quotas and selected-text professional handoffs. No schema, dependency, renderer or AI-provider change. Research, source links, implementation plan and acceptance limits: [Phase 4](WHOLE_MAN_WORLD_PHASE_4.md).


## 2026-10-02 — Inviting entrance and sound activation

Founder approved a slower, illuminated entrance and ElevenLabs sound direction. Preserve the original official crest bytes; screen compositing removes the black matte visually without AI redrawing its detail. Use one GSAP timeline, approximately four seconds, with a recognition hold and accelerated final approach. Enter is the trusted gesture for audio activation; persistent mute wins. Direct world entry stays silent. Pause on hidden/dialog/conversation states. Retain the existing synthesized audio until actual ElevenLabs assets can be generated and auditioned; no substitute provider was used. Technical references: https://developer.chrome.com/blog/autoplay , https://elevenlabs.io/docs/overview/capabilities/music , https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert . Reviewed October 2, 2026. Planned assets: 4.05-second warm resonant awakening cue, restrained gold-toned three-note motif, 60–90 second instrumental ambient bed with gentle forward pulse and an edited seamless loop. Mix for phone speakers, no harsh impact, no vocals, and no dependence on sub-bass. Generate once, serve compressed files; no per-visitor model request.


## 2026-10-02 — Native product-film entrance

Use one compressed founder-footage montage between the existing crest and EnergyOrb. Native muted inline H.264 avoids extra player/3D scene dependencies; assign its source only on deliberate entry. Respect reduced motion and Data Saver; remember completion with a versioned local preference and offer replay. Handle unavailable/failed playback and keep Skip plus a total watchdog. No commerce or manufacturing claims and no ElevenLabs audio in this phase. Research and edit details: CINEMATIC_PRODUCT_ENTRANCE.md. Verified clean production output after an incremental prerender retained an older bundle reference.
## 2026-09-29 — Phase 7 movement identity and evidence

Use a small original catalog of stable exercise identities instead of importing media or guessing identity from user text. Substitution and custom renaming reset identity/load; progression is opt-in for catalog selections and remains manual when selected. Completed cardio/mobility records are distinct from resistance prescriptions and never qualify for rep progression. Intensity is optional self-report; normalize distance only within an activity summary, retaining entered units. Follow existing owner-scoped RPC, receipt, optimistic-version and immutable-revision contracts. Research and release boundaries: [Phase 7](ASCEND_PERFORMANCE_PHASE_7.md). No additional dependency or infrastructure.

## 2026-09-27 — Commerce Spine V1

Founder approved the planning pass for implementation. Build within the existing Next.js public shop, using Shopify Headless Storefront API `2026-07` for merchandise/cart and Shopify-hosted checkout. Keep Supabase Auth/membership independent; guest and members can shop without claiming automatic Shopify customer association. Retain preview data when a live store is unavailable, and exclude subscription-only items until the Headless channel path is verified. Activation, boundaries and primary references are in [Commerce Spine V1](COMMERCE_SPINE_V1.md).

## 2026-10-02 — Founding launch foundation

Use five phases documented in FOUNDING_LAUNCH_PHASE_1.md. Phase one builds public offer definitions and launch states before accepting money. Keep integer-cent founding prices independent of trusted membership access, retain existing invitation/beta/founder flow, and keep Shopify authoritative for merchandise. Preview/preorder readiness is checked server-side on direct adds and at checkout; no future discounts or supplier holds are implied by a label. Defer paid preorder activation until actual selling-plan and supplier-held fulfillment tests pass. Official sources and unresolved commercial terms are recorded in the phase document.
# 2026-10-02 — Founding membership lifecycle (Phase 2)

Use Stripe hosted subscription Checkout and the customer portal for the three canonical monthly USD founding prices. Keep all three prices on one subscription product so portal downgrades can be scheduled at renewal. Validate price amount/cadence/mode and portal policy on the server. Use a separate restricted recovery portal for cancellation and payment management if sales/full plan management fail validation. New sales require approved commercial terms, explicit tax mode and a support address; activation remains disabled.

Payment-derived access is a database projection of verified current provider state. A return URL, arbitrary metadata or paid catalog entry is not an entitlement. Serialize current subscription and dispute/refund reads per person, persist retryable checkout attempts, and commit processed event IDs with the membership projection. Expand access only for an active subscription with a paid matching-price invoice and a future item billing period. Preserve only already-paid access during an unpaid upgrade. Conservative full-refund/dispute review holds prevent new subscription charges; the refund policy must be approved before activation.

Normal member data reads remain session-bound. The provider adapter's service credentials are limited to a service-only security-invoker control RPC with explicit table grants/RLS; no generic privileged client is exported. Keep beta/founder authority and clinical authorization independent. Essential gains personal guidance/memory; Signature/Reserve gain Studio creation under existing ceilings. No Reserve quota, consultation capacity or product bundle obligation was inferred.

Public registration is separate from pilot invitations and checkout activation. Use verified Supabase Auth, confirmed email, fixed callback destinations and hosted CAPTCHA. Existing pilot/local harness behavior stays intact; public signup remains closed until actual Auth/SMTP/CAPTCHA setup is verified. Local provider/SQL/browser checks cannot stand in for live Auth/payment acceptance. Detailed current sources and activation gates are in `docs/FOUNDING_LAUNCH_PHASE_2.md`.

## 2026-10-02 — Premium commerce Phase One

Founder approved the premium-commerce build after its research brief. Extend the existing commerce routes and 3D study, keep Shopify price/availability and the server launch policy authoritative, and separate curated product education from commerce privileges. Use a strict versioned approved `gent_ascend.product_story` JSON enrichment, explicit media approval, no arbitrary HTML/prices/discounts, on-demand actual Shopify GLB inspection and accessible image fallback. Save a browser-local collection with an explicit persistence boundary; do not imply email signup or account sync. Native selling-plan preorders, real member discounts and analytics persistence remain separate activation work. Preserve the existing closed preorder path rather than re-labeling ordinary stock overselling as a preorder implementation. Research links and content/activation contract: `PREMIUM_COMMERCE_PHASE_1.md`. No new package, migration, service credential or production data operation.

## 2026-10-02 — premium commerce Phase Two decision support

Following founder authorization, extend the Phase One showroom with optional category/availability discovery, an inspectable saved-selection dossier, and explicit approved alternative/complementary product links. Research and execution plan: `docs/PREMIUM_COMMERCE_PHASE_2.md`. Keep broad browsing available, reveal missing facts, avoid supplement/skin personalization and title-based fit inference, and preserve the Shopify launch gate. Use a bounded shared browser store rather than repeated storage parsing/listeners on every product card. No migration or dependency. Phase Two is stacked on the Phase One review candidate; neither is a production release by this decision.

## 2026-10-02 — Premium commerce Phase Three purchase handoff

Founder authorized the next researched commerce phase. Focus on purchase review, approved delivery/payment/return disclosure, visible quantity subtotal and held-item cart recovery. Official Shopify Cart documentation treats costs as estimates until checkout; the app preserves its server-validated checkout redirect. Shopify preorder setup requires merchant configuration that is not verified in this source checkout. Keep preorder gates intact rather than collect money on an unverified fulfillment promise. Guard cart mutations against stale read responses and simultaneous client writes. Scope, research and next activation prerequisites: `PREMIUM_COMMERCE_PHASE_3.md`. No migration, dependency or production promotion.

## 2026-10-02 — Premium commerce Phase Four catalog reliability

Founder authorized research and build of the next phase. The single newest-60 catalog window could omit older saved products and approved relationships. Replace it with bounded cursor traversal, deduplicated public catalog results and fail-closed incomplete-read handling. Add transient public-language search and ready-only shelf filtering intersected with chapter/saved selections. Preserve merchant-owned availability, existing release gates and browser-local save semantics. Official pagination research, limits and acceptance scope: `PREMIUM_COMMERCE_PHASE_4.md`. No dependency, migration, merchant configuration or production release. Native paid preorder activation remains dependent on verified merchant/supplier/payment setup.

## 2026-10-02 — Premium commerce Phase Five product sharing

Founder authorized the next researched build. Add user-invoked native sharing/copy/manual link fallback and product Open Graph/Twitter metadata, while preserving existing no-index settings. Shared links exclude query/hash/private context. Use only a configured validated public HTTPS origin for canonical URLs and server-rendered escaped Product JSON-LD; omit schema for curated concept products and commercial offers for held releases. No fabricated ratings, imagery, dispatch windows or discounts. Scope/research/activation limits: `PREMIUM_COMMERCE_PHASE_5.md`. No dependency, migration, external message sending or production promotion.

## 2026-10-04 — Member product Cabinet recovery increment

Founder authorized continued research and execution. Refreshed main still lacks the member-product Phase 1 build. Build its necessary account-synced Cabinet prerequisite on the existing `grooming_products` ledger rather than a parallel ownership catalog, with stable Shopify IDs, self-reported states and owner/version guards. Pricing remains Shopify retail until verified identity and enforcement exist. The full Phase 2 purchase/replenishment plan remains dependent on those integrations; do not label this recovery increment a completed phase. Research, implementation, migration and open gates: `MEMBER_PRODUCT_CABINET.md`.

## 2026-10-04 — Member Council inside the existing Aethelios workspace

Founder explicitly authorized inspection, Phase 1 implementation and target-main production release. Use the founder Council at `41ab4399` as evidence, preserving its role definitions without repository tools or Mission OS. Member Council requests use the existing verified account, capability check, bounded personal context, turn/message ledger and direct OpenAI adapter. Table is a reviewed two-to-three-specialist deliberation inside the existing conversation; only the reviewed cast runs and Aethelios synthesizes. No second engine/navigation/database, service credentials, private founder bridge, external writes or auto-memory. Bounded prompt-version tags preserve cast/identity on the existing ledger; normalized durable mission steps remain a later phase. Official research, reuse/adaptation/defer decisions and limits: `MEMBER_COUNCIL.md`.

## 2026-10-04 — Collection-to-Ritual Continuity
Close the gap between native product browsing, synced Cabinet and ritual practice before advertising order history or member prices. Reuse the existing owner ledger and server catalog. Import requires explicit selection, server review, owner/product revalidation and confirmation; preserve browser saves and previous personal state. See PRODUCT_RITUAL_CONTINUITY.md for current official research and bounded views.


## 2026-10-04 — Customer Account connection before economic privileges

Advance the live Collection/Cabinet work with a browser-scoped, explicitly initiated OAuth/PKCE customer connection and read-only recent orders. Verify the provider's signed identity and API customer; keep credentials in short-lived encrypted host-only cookies bound to the Gent owner and configuration. No refresh token persistence, new ledger, membership inference, historical Cabinet purchase badge or discount enforcement is introduced. Merchant configuration and real Shopify acceptance stay separate from CI provider fixtures. Follow discovered supported endpoints and current Customer Account object contracts. Full research, scope, activation and durable-link next phase: CUSTOMER_ACCOUNT_CONNECTION.md.

## October 2, 2026 — Deferred free account claim

Founder approved direction-first account conversion. Reuse Supabase SSR and existing daily_save rather than anonymous Auth provisioning or a second profile system. Google + email OTP; existing passwords remain. Free signup configuration is independent of membership/billing. Authentication never grants paid/beta/founder/clinical authority. Account state and imports remain owner-derived and idempotent.

Official sources reviewed October 2: https://supabase.com/docs/guides/auth/auth-email-passwordless (OTP email template must use .Token; signInWithOtp creates users by default); https://supabase.com/docs/guides/auth/social-login/auth-google (SSR PKCE code exchange); https://supabase.com/docs/guides/auth/auth-anonymous (anonymous identities use authenticated role; not enabled); https://supabase.com/changelog.md (reviewed recent Auth/SSR changes, no relevant breaking auth integration change); packaged Next.js 16.3.5 route-handler/cookies documentation (mutable response cookies, no shared private caching). Recent Postgres minor advisory affects specific extensions/encrypted legacy data; this migration introduces none of those features.

Research informs the UX, without claiming measured conversion results: https://www.nngroup.com/articles/login-walls/, https://www.nngroup.com/articles/commitment-levels/, https://www.nngroup.com/articles/progressive-disclosure/, https://www.nike.com/membership. See ACCOUNT_CLAIM_PHASE_1.md for release settings and verification limitations.


## 2026-10-04 — Public launch Phase 1: entry and first value

Founder authorized execution of the consolidated launch blueprint's first phase. Recover PR #41's owner-derived, idempotent account claim instead of creating another identity ledger. Add an explicit first-session priority and next move through existing Daily Command, preserving existing daily fields and actions. Starting paths are authored suggestions; opening the page never runs a model or saves data. Account creation does not grant paid/beta/founder access. Existing public-browser draft claims stay explicit and reviewable. Publish a draft PR for the remaining consolidated launch work, with production signup/configuration and migration activation separately gated. See PUBLIC_LAUNCH_PHASE_1.md for evidence and limits.

## 2026-10-04 — Connected daily experience and shared member research

Preserve PR52's first-session foundation. Project existing domain facts into a member-calendar week, with partial-source failure labeled unavailable and no inferred readiness/efficacy. Continue actual saved training, ritual and conversation records from Command. Keep coaching editable and personal context opt-in; adjustments use existing confirmation paths. Use the pinned OpenAI provider webSearch tool across all supported member conversational roles, bounded and read-only, and persist provider-returned source links in existing assistant text. Official contract reviewed: https://ai-sdk.dev/providers/ai-sdk-providers/openai#web-search-tool. Installed Next16 data-security and server/client boundary guide domain-layer ownership and minimal DTOs. No background agent, second ledger, model upgrade or production release.

## October 4 — public launch release controls

Reuse existing identity/account/billing/commerce controls; add a founder-authenticated configuration/acceptance ledger and member support route. Configuration never auto-promotes into verified launch readiness. Use Next's built-in Web Vitals hook behind a default-off server flag and bounded same-origin scalar log endpoint; exclude raw URLs, identifiers and written content, respect DNT/GPC. This is an initial diagnostic sink, not durable analytics or measured field compliance. Whole-account export/deletion and legal publication remain operational acceptance gaps. Research and exact release/rollback contract: `PUBLIC_LAUNCH_PHASE_4.md`.

## October 4 — Ascend Mirror camera-first scan

Fix the confirmed live camera=() document policy to camera=(self), including client-navigation entry documents, preserving denied microphone/location and explicit user permission. Keep camera frames local; self-host pinned MediaPipe 1.0.1 assets/model and use a bounded CPU web worker for framing/steady capture. Existing OpenAI/private Storage scan pipeline receives only explicitly approved images. No streaming vendor, new database, medical claims, identity matching, or automatic photo upload. Research, model provenance/hash and honest test boundaries: ASCEND_MIRROR.md.


## 2026-10-04 — Recover Command home while preserving direct member entry

Founder approved the researched home recovery after reporting a visual regression. One named-area hero grid replaces the stacked direct-home override; today's move and the current EnergyOrb share the opening composition. Talk expands on demand; operational sources move into disclosure. No new intro, model call or policy change. Official Oura Today, Samsung foldable and web.dev motion references, scope, validation and limitations are recorded in COMMAND_HOME_RECOVERY.md. The lazy day workspace now owns its post-mount focus callback, fixing a browser-observed loading-placeholder scroll race.

## 2026-10-07 — Public Mission Deliverables

Choose durable, versioned personal text work before expanding autonomous agents. Reuse saved completed replies and existing session/RLS infrastructure; no new model or package. Research: Anthropic “Building effective agents” (simple workflows and human checkpoints), Microsoft Research Human-AI Interaction guidelines (efficient correction), installed Next 16 route-handler/data-security guides. Full scope, ownership, boundaries, limits and release gates: `MISSION_DELIVERABLES.md`.

## 2026-10-08 — Public Intelligence OS Phase 1

Founder approved execution of the researched Phase 1 plan. Consolidate PR #63 (which already contains #62 and current main), selectively recover #60 consent/bridge behavior, and preserve approved Petrol assets and company/Studio/billing boundaries. Source categories are explicit, excluded reads are gated, and an older client without categories fails closed to no saved personal sources. Work/Library is an owner-filtered metadata projection over existing schemas. Immutable deliverable history is loaded lazily; exact-version export remains Markdown. Session drafts are bounded in memory with explicit restoration and no browser persistence.

See PHASE_ONE_UNIFICATION.md for migration/rollback prerequisites, provider exposure and acceptance limits; PHASE_ONE_REGRESSION.md accounts for all 107 historical browser failures. Hosted acceptance remains separate from fixtures and disposable local Supabase. No paid service purchase, live billing change, production schema application or production promotion is part of this candidate publication.


2026-10-08 — Public saved-work release preflight. Extend the existing founder launch ledger instead of a new admin surface. Eight four-second session-bound HEAD probes inspect no records; catalog/CLI observations remain separate from hosted Auth/RLS/provider/device acceptance. Preserve both additive Mission migrations by SHA-256 and report partial application before promotion, without rewriting shared Reserve history. Sources: [Supabase select](https://supabase.com/docs/reference/javascript/select), [abortSignal](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal), [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [pg_proc](https://www.postgresql.org/docs/17/catalog-pg-proc.html), [CREATE VIEW](https://www.postgresql.org/docs/17/sql-createview.html), and installed Next 16 request-time/data-security guides. Full scope, catalog receipt and limits: PUBLIC_RELEASE_PREFLIGHT.md.


2026-10-08 — Executable account acceptance. Close the real-account/Storage gap with a bounded session-only runner, shared by disposable local CI and independently verified isolated hosted staging. Reject known live projects, privileged API keys, changed candidates, expired scope and mismatched identities before synthetic writes. Preserve existing local-only harness and migration history. Do not interpret an operator manifest or passing database contract as provider/device/application acceptance or production authorization. Official Supabase branching, API-key and Storage contracts and the concrete provisioning dependency are recorded in PUBLIC_HOSTED_ACCEPTANCE.md.

## 2026-10-08 — Technology Creation Foundation

Choose a fixed, structured service-business renderer before sandboxed autonomous development. Both creation paths converge on a strict reviewed brief; append immutable versions and reuse personal Missions/Saved Work. A trusted server-only settlement RPC prevents ordinary clients from reporting fake provider usage or reclaiming reserved allowance. Unknown outcomes retain reservations with no automatic retry. Use a single economical Technology-only model; preserve Talk defaults and shared identity/visual system. No new package, hosting service, production promotion or customer publishing. Current official OpenAI Structured Outputs and installed AI SDK/Next contracts were reviewed before implementing `Output.object`; technical scope, pricing assumptions, reconciliation limits and acceptance: TECHNOLOGY_FOUNDATION.md. Source: https://developers.openai.com/api/docs/guides/structured-outputs ; installed Next 16 route-handler and server/client boundary guides.

## 2026-10-08 — Technology verified artifacts

Use persisted owner-bound jobs, fenced leases and script-free static HTML export for the existing service template before adopting arbitrary-code executors. No new paid provider. Current Next installed route docs, Supabase RLS docs and MDN iframe docs inspected. Details and explicit roadmap limits: TECHNOLOGY_VERIFIED_BUILD.md.

## 2026-10-09 — Technology Phase 5: bounded page composition

Extend the native reviewed website brief with up to three informational pages and audited text-section layouts; reuse immutable versions, owner RLS, metered exact-version revisions and static exports. Research: Lovable Plan mode (https://docs.lovable.dev/features/plan-mode), Replit Visual Editor (https://docs.replit.com/design/visual-editor), Vercel Sandbox (https://vercel.com/docs/sandbox), accessed 2026-10-09. Keep deterministic edits free of additional AI calls and executable generation behind future isolation/spend controls. Owned imagery requires a separate immutable asset/export lifecycle and is deferred. See TECHNOLOGY_FLEXIBLE_PAGES.md for migration order, rollback compatibility and release gates.

## 2026-10-09 — Technology Phase 6: owned raster snapshots

Use session-authorized personal Studio downloads and immutable per-website normalized JPEG copies instead of signed/remote URLs in briefs. Bound native decoding, ownership, leases, attempts and storage; no additional AI image generation. Add an exact-version/hash read-only publication manifest with hosting disabled. Research: Supabase private buckets (https://supabase.com/docs/guides/storage/buckets/fundamentals), sharp constructor/output/security/0.35.5 changelog (https://sharp.pixelplumbing.com), Vercel for Platforms (https://vercel.com/docs/platforms), accessed 2026-10-09. See TECHNOLOGY_OWNED_IMAGERY.md for source-lifetime behavior, export bounds, rollback incompatibilities and isolated hosted release gates.


## 2026-10-09 — Technology Phase 7 release preparation

Native exact-build approval and bounded portable ZIPs precede paid hosting activation. Owner approval of files is separate from domain, infrastructure budget and production release authority. Terminal revocation blocks future package downloads but cannot recall offline copies. Explicitly revoke Supabase default grants; use session-owned RPCs and a composite release/build identity FK. Pin existing fflate 0.8.3 for three fixed-name stored ZIP entries. Sources: https://vercel.com/docs/platforms ; https://vercel.com/docs/deployment-checks ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://github.com/101arrowz/fflate . Full scope and pending hosted acceptance: docs/TECHNOLOGY_RELEASE_PACKAGES.md.


## 2026-10-09 — Technology Phase 8 deployment-bound acceptance

Keep the recovered creation stack unchanged and verify its actual application path through normal login. Bind hosted acceptance to exact clean candidate commit/tree, independently attested dataless staging reference, immutable protected preview and two verified synthetic accounts; preflight runtime before credentials or writes. Retain all local CI, owner/RLS and migration gates. No customer publishing, paid provisioning or production writes are authorized by development approval. Current Supabase branching pricing is usage-based, outside the spend cap; obtain organization pricing and explicit approval for a short-lived rehearsal. Use existing Playwright/Supabase user clients, origin-scoped Vercel OIDC access and bounded redacted receipts. Details and primary sources: [Phase 8](TECHNOLOGY_HOSTED_ACCEPTANCE.md). Hosted/provider/device/founder gates remain pending; neither READY preview nor local real-Auth acceptance is a production release decision.
