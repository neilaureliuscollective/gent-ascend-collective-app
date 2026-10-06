# Aethelios public foundation — Phase 1

Founder approval recovered from the interrupted transformation task. Baseline: main `620e12850afb8d0c9dedb320c032a942e90cf457`. This supersedes earlier Gent Ascend public hierarchy, gender-bound onboarding and dashboard-first navigation. The original repository, persistence IDs, person ownership, billing rights and merchant engines remain.

## Implemented behavior

- `/app` renders the existing full Aethelios conversation workspace, with optional explicit latest-conversation resumption. Opening never submits a message or calls a model. `/app/aethelios` and its starter/conversation query parameters remain supported.
- Aethelios / Ongoing / Library are the three primary destinations. A single searchable capability sheet exposes implemented destinations and access status. It uses the existing native dialog, keyboard focus return and quiet-motion behavior. Existing direct routes remain.
- `/app/daily` retains the richer previous home with source preparation, confirmations, day editing and review. No new generic mission system or domain records were created.
- Ongoing composes daily actions, up to 100 goals and 100 recent Studio project summaries. Writes use the existing daily action confirmation endpoint; goals/projects open their real editors. Independent read failures remain visible.
- Library filters the 40 recent active conversation titles and 100 project titles loaded here. Full conversation history/search/archive stay in the existing conversation controls. Explicit memory uses the existing version-bound editor and up to 24 confirmed records. Projects open their exact owner-verified Studio ID and saved images/versions/finishes.
- Saved context defaults off. The user selects profile/baseline, active goal, confirmed memory, daily records and Presence source categories per future message. Only checked categories are read and included server-side. Training continuity requires both Daily and Presence categories because the existing continuity projection combines them. Conversation text/older-thread summary remain in scope; source exclusion does not erase details already in the conversation. No Personal/Work isolation is claimed.
- Legacy requests that supply only `includeContext` retain their previous public saved-source semantics. `includeContext:false` always excludes saved sources. Ordinary and Council messages share the filtering boundary. Unknown source fields are rejected. All categories off skips saved-context retrieval.
- Structured preparation requires explicit `useSpecialistContext:true`; the UI names the target source and disables preparation until consent. This intentionally fails closed for obsolete clients that omit consent. Preparation remains a transient owner-bound draft, not a saved work item or execution receipt.
- Public private-founder bridge retrieval is disabled, including for founder accounts. Start/callback return 410 and expire their exact legacy cookie paths; ordinary workspace proxy responses also expire them. The authenticated same-origin founder disconnect/revocation route remains for cleanup. Public founder entitlements remain separate and unchanged.
- Public `/`, `/aethelios`, `/about`, `/gent-ascend` now explain Aethelios. `/experience` and `/experience/world` reach the introduction, with the explicit legacy direction claim returning to a retained claim surface in Welcome. Specialist experience engines remain. No domain or private-app origin change.
- Optional context setup uses neutral wording and preserves fact keys/answers. First-session suggestions address deciding, organizing and creating while preserving compatibility keys. Accounts can open Aethelios directly without completing setup; conversation allowances still follow existing access policy.
- Public metadata, navigation, installed identity and versioned central AI/public-knowledge prompts now use Aethelios. The green/obsidian/gold palette remains. Merchant fallback copy identifies Legacy Reserve. Existing historical artwork/files and user-written history remain unchanged.

## Artwork

Built-in image generation produced a square architectural A, guiding star, laurels and complete circular border on deep green with engraved geometry. Prompt constraints: legible A; mandatory circular gold border; no human figure, wordmark or additional letters; restrained metallic depth; no fake device/mockup. The generated master is represented by `public/brand/aethelios-emblem-20261006.webp`; app sizes use versioned PNGs, separate maskable padding, Apple180 and browser512. Existing icon URL aliases redirect to current assets. This is the Phase1 platform asset, not an assertion that a separate logo-polish task has been completed.

Manifest ID `/`, scope `/`, start URL `/app`, origin, database, storage and event IDs remain stable. Browser/OS install updates may require review/reinstall. No service-worker caching of personal responses is introduced.

## Deliberate limitations

No schema migration, repricing, storefront cutover, team/context-space security, autonomous agent, new integration, voice, attachment pipeline or general document exporter. The capability router is a suggested destination; it is not execution or specialist consultation. Projects and goals do not share completion semantics. Title filtering is bounded, not semantic knowledge search.

No production promotion is included in the approved Phase1 plan. Release remains gated on full regression suite reconciliation, real Supabase Auth/PostgREST/founder journeys, hosted live model evaluation and physical device acceptance. This runner has no Docker-backed Supabase or model key; these gates cannot be represented as local mocks.

## Verification

Actual gate results are recorded in STATUS.md. Unit tests cover source payload exclusions, skipped excluded reads, ordinary/Council owner boundaries, zero-context behavior, input rejection and existing persistence/stream contracts. Browser tests cover direct opening, draft retention, source selection, specialist consent, searchable capability-sheet keyboard behavior, private-bridge retirement, installed identity, history/memory/Council continuity and the 390×440 constrained composer. Browser tests use synthetic intercepted workspace data; they are interaction verification, not real Auth or live AI tests. The previous browser suite includes intentionally superseded Gent cinematic, home and navigation assumptions and must be reconciled before release.
