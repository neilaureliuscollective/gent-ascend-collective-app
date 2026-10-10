# Existing Public Aethelios audit — 2026-10-10

Audit baseline: main checkout `bc0e561d516267ff6f7467ffeaff5813fd0dbb3c`. Evidence is repository source and current local checks; historical STATUS release receipts are not fresh live-provider verification. No private founder repository was accessed. Existing public interop adapters were inspected only as public code; no private endpoints were contacted.

## Findings and ecosystem mapping

| Environment | Existing implementation and evidence | Limits / activation prerequisites |
|---|---|---|
| Intelligence | `/app/aethelios`, Library/history, streamed Responses calls, summary/title calls, thread search/archive, feedback and explicit memory; `domains/intelligence`, chat-foundation migration | Server-only OpenAI, verified identity and existing capability required. Provider results not freshly verified. Document/file inputs and multimodal chat remain later work; image references exist in Studio. No unlimited inference or ambient memory promotion. |
| Entities | Five Council roles: Athena, Prometheus, Apollo, Hermes, Themis; independent bounded calls, reviewed cast, at most three perspectives, Aethelios synthesis and prompt-version receipts; `council.ts`, `council-model.ts` | Existing public Council is the Entity foundation. No private Coworkers copied; no repository access, code execution, external writes or autonomous runs. |
| Life | `persons`, profile/version guards, active goal, daily intention/actions/review, capture inbox, Ascend baseline/proposals, request-time Command/next-move projections, progress and continuity | Existing records rather than duplicate profile. Calendar and task integrations are not present. Daily/wellness context has existing per-message consent; proposed Brief must not invent or silently collect information. |
| Studio | Private image projects, reference prepare/finalize uploads, image version lineage, project briefs, storyboards/scenes and finish/export code; `domains/studio`, `platform/openai/image`, Studio RPCs and Storage policies | Generation depends on provider/access. Existing image reservations and recovery remain. Storyboard is not video rendering; broad presentation/audio/video production is not claimed. Inspect exact export handlers before promising a format. |
| Business & Build | Owned companies, briefs, company-scoped conversations and context, reviewed company jobs, immutable deliverable versions, company-linked Studio; `domains/companies`, `company-work` | Technical planning and proposed code through Prometheus, not a repository runner or coding sandbox. No organization-wide sharing or customer CRM introduced. |
| Health | Existing `health.navigation` and always-denied `clinical.care` capability; privacy/clinical gateway architecture; existing wellness observations under Life/Performance | No biological identity, lab vault, clinician service or wearable integration is implemented. New introductory page has education and in-memory general reminders only. No Health storage or provider sharing. |
| Lifestyle | Presence, Grooming profiles/scans/look previews/rituals/products/professional briefs; Performance training/fuel/recovery/movement; native Collection, product pages/cart, Cabinet and Shopify customer read-only orders | Provider-backed scans/images depend on credentials. Shopify merchant configuration and verified checkout hosts govern commerce. Customer connection is browser-scoped, not global identity federation. No invented appointments, product discounts or verified purchases. |
| Membership | Free plus legacy `aurelius`/`health` and founding `essential`/`signature`/`reserve`; existing Stripe config, signed webhook, service-only billing projection, reconciliation leases, paid invoice checks, portal/checkout and readiness gates | Existing offers are $19.99/$49.99/$74.99 monthly USD. Source pricing is not evidence of active customer counts or product availability. No live Stripe dashboard inspection, payment or product mutation. |
| Onboarding | `/enter`, `/join`, claim/email-code and Google readiness gates, Turnstile, auth confirmation, first-session priority and welcome, invitation/founder grants | Signup and hosted email/Google require explicit readiness config. No privilege from email or user metadata. Existing session/person mapping stays unchanged. |

## Identity, database and security

`currentIdentity` verifies Supabase claims. `currentPerson` resolves the unique `persons.auth_user_id` to the separate stable application UUID `persons.id`. Tables generally own records by `person_id`; private Storage paths also use Auth UID. Existing RLS, restricted column grants, same-origin routes, bounded bodies and fixed-search-path RPCs are layered controls. Stripe operational service access must remain confined to its control boundary; never use service-role data reads for normal member requests.

The migration chain contains historic timestamp-renamed foundation files plus additive domain migrations. The hosted ledger checker compares 28 recorded application-owned files and separately acknowledges five Reserve-owned entries; it is not a full live-schema reconciliation. No migration is added or edited in this phase. Composite ownership references, optimistic versions, request IDs and uncertain-write locks remain.

Public interop contains previously implemented private founder-link/published-knowledge adapters. They remain untouched and are not activated by the ecosystem UI. This phase gives no expanded access to founder grants or notebooks.

## Visual and deployment evidence

Latest relevant instructions are Imperial Workspace / Imperial Steel and the material-led Talk/Studio correction. Shared palette uses `#12382D`, `#205443`, gold `#C4912F`, stone/ivory surfaces and carbon/steel materials. Existing member crest and installed icons remain. Corporate identity uses green/gold/obsidian and a temporary wordmark pending the exact approved master crest.

Node 24 / npm / Next 16.3.5, Vercel independent Git deployment, Supabase hosted persistence, server-only provider variables. `vercel.json` retains framework defaults. Production Supabase connection currently pins public configuration in code due to previously documented stale environment variables; do not remove this compatibility override without a verified operator reconciliation. No Vercel project or secret values were accessed. Proposed company/app domains are not configured or claimed available.

## Technical debt and risks

1. Historic documentation includes obsolete names, four-migration instructions and provider routing descriptions. Current source/ledger and newest STATUS take precedence; do not apply old reset/bootstrap guidance to hosted services.
2. Production Supabase public config pin should eventually move back to verified project environment settings, preserving account project identity.
3. Full broad browser/founder gates have historically failed separately from focused suites; inspect actual current failures rather than weakening them.
4. Existing general context may include wellness/training/Presence under consent. Future sensitive Health cannot use that general-context path. Classification/consent/retention/export/incident readiness needs review before sensitive-data beta.
5. Quotas are technical limits, not sustainable commercial allocations. Council fanout, title/summary calls, images and provider tools need measured cost accounting before tier revisions.
6. Cross-domain SSO, organization permissions, background durable jobs, code execution, calendar connections and full data export/closure remain separately scoped work.

## Complete route inventory

Route presence below means source exists, not that every service-backed action passed live acceptance. Protected pages can display a signed-out/configuration state. Route groups do not alter URLs.

| URL | Kind | Source |
|---|---|---|
| `/experience/aethelios` | Page | `src/app/(experience)/experience/aethelios/page.tsx` |
| `/experience/grooming` | Page | `src/app/(experience)/experience/grooming/page.tsx` |
| `/experience` | Page | `src/app/(experience)/experience/page.tsx` |
| `/experience/performance` | Page | `src/app/(experience)/experience/performance/page.tsx` |
| `/experience/performance/practice` | Page | `src/app/(experience)/experience/performance/practice/page.tsx` |
| `/experience/world` | Page | `src/app/(experience)/experience/world/page.tsx` |
| `/about` | Page | `src/app/(public)/about/page.tsx` |
| `/aethelios` | Page | `src/app/(public)/aethelios/page.tsx` |
| `/enter` | Page | `src/app/(public)/enter/page.tsx` |
| `/gent-ascend` | Page | `src/app/(public)/gent-ascend/page.tsx` |
| `/join` | Page | `src/app/(public)/join/page.tsx` |
| `/launch` | Page | `src/app/(public)/launch/page.tsx` |
| `/membership` | Page | `src/app/(public)/membership/page.tsx` |
| `/` | Page | `src/app/(public)/page.tsx` |
| `/reserve` | Page | `src/app/(public)/reserve/page.tsx` |
| `/shop/[handle]` | Page | `src/app/(public)/shop/[handle]/page.tsx` |
| `/shop/cart` | Page | `src/app/(public)/shop/cart/page.tsx` |
| `/shop` | Page | `src/app/(public)/shop/page.tsx` |
| `/shop/world/[handle]` | Page | `src/app/(public)/shop/world/[handle]/page.tsx` |
| `/support` | Page | `src/app/(public)/support/page.tsx` |
| `/app/aethelios/meet` | Page | `src/app/(workspace)/app/aethelios/meet/page.tsx` |
| `/app/aethelios` | Page | `src/app/(workspace)/app/aethelios/page.tsx` |
| `/app/arrival` | Page | `src/app/(workspace)/app/arrival/page.tsx` |
| `/app/ascend` | Page | `src/app/(workspace)/app/ascend/page.tsx` |
| `/app/ascend-profile` | Page | `src/app/(workspace)/app/ascend-profile/page.tsx` |
| `/app/aurelius` | Page | `src/app/(workspace)/app/aurelius/page.tsx` |
| `/app/captures` | Page | `src/app/(workspace)/app/captures/page.tsx` |
| `/app/collection/[handle]` | Page | `src/app/(workspace)/app/collection/[handle]/page.tsx` |
| `/app/collection/cabinet` | Page | `src/app/(workspace)/app/collection/cabinet/page.tsx` |
| `/app/collection/cart` | Page | `src/app/(workspace)/app/collection/cart/page.tsx` |
| `/app/collection/orders` | Page | `src/app/(workspace)/app/collection/orders/page.tsx` |
| `/app/collection` | Page | `src/app/(workspace)/app/collection/page.tsx` |
| `/app/companies/[id]` | Page | `src/app/(workspace)/app/companies/[id]/page.tsx` |
| `/app/companies/[id]/work/[jobId]` | Page | `src/app/(workspace)/app/companies/[id]/work/[jobId]/page.tsx` |
| `/app/daily` | Page | `src/app/(workspace)/app/daily/page.tsx` |
| `/app/ecosystem` | Page | `src/app/(workspace)/app/ecosystem/page.tsx` |
| `/app/entities` | Page | `src/app/(workspace)/app/entities/page.tsx` |
| `/app/founder/launch` | Page | `src/app/(workspace)/app/founder/launch/page.tsx` |
| `/app/founder/pilot` | Page | `src/app/(workspace)/app/founder/pilot/page.tsx` |
| `/app/goals` | Page | `src/app/(workspace)/app/goals/page.tsx` |
| `/app/grooming/brief` | Page | `src/app/(workspace)/app/grooming/brief/page.tsx` |
| `/app/grooming/look/[id]/brief` | Page | `src/app/(workspace)/app/grooming/look/[id]/brief/page.tsx` |
| `/app/grooming/look` | Page | `src/app/(workspace)/app/grooming/look/page.tsx` |
| `/app/grooming` | Page | `src/app/(workspace)/app/grooming/page.tsx` |
| `/app/grooming/professional` | Page | `src/app/(workspace)/app/grooming/professional/page.tsx` |
| `/app/grooming/scan` | Page | `src/app/(workspace)/app/grooming/scan/page.tsx` |
| `/app/health` | Page | `src/app/(workspace)/app/health/page.tsx` |
| `/app/install` | Page | `src/app/(workspace)/app/install/page.tsx` |
| `/app/life` | Page | `src/app/(workspace)/app/life/page.tsx` |
| `/app/membership` | Page | `src/app/(workspace)/app/membership/page.tsx` |
| `/app/missions` | Page | `src/app/(workspace)/app/missions/page.tsx` |
| `/app/ongoing` | Page | `src/app/(workspace)/app/ongoing/page.tsx` |
| `/app` | Page | `src/app/(workspace)/app/page.tsx` |
| `/app/performance` | Page | `src/app/(workspace)/app/performance/page.tsx` |
| `/app/presence` | Page | `src/app/(workspace)/app/presence/page.tsx` |
| `/app/progress` | Page | `src/app/(workspace)/app/progress/page.tsx` |
| `/app/studio` | Page | `src/app/(workspace)/app/studio/page.tsx` |
| `/app/welcome` | Page | `src/app/(workspace)/app/welcome/page.tsx` |
| `/app/work` | Page | `src/app/(workspace)/app/work/page.tsx` |
| `/app/world` | Page | `src/app/(workspace)/app/world/page.tsx` |
| `/app/you` | Page | `src/app/(workspace)/app/you/page.tsx` |
| `/api/account/auth` | HTTP handler | `src/app/api/account/auth/route.ts` |
| `/api/account/claim` | HTTP handler | `src/app/api/account/claim/route.ts` |
| `/api/account/events` | HTTP handler | `src/app/api/account/events/route.ts` |
| `/api/aethelios-link/callback` | HTTP handler | `src/app/api/aethelios-link/callback/route.ts` |
| `/api/aethelios-link/disconnect` | HTTP handler | `src/app/api/aethelios-link/disconnect/route.ts` |
| `/api/aethelios-link/start` | HTTP handler | `src/app/api/aethelios-link/start/route.ts` |
| `/api/ascend-profile/propose` | HTTP handler | `src/app/api/ascend-profile/propose/route.ts` |
| `/api/ascend-profile` | HTTP handler | `src/app/api/ascend-profile/route.ts` |
| `/api/aurelius/actions` | HTTP handler | `src/app/api/aurelius/actions/route.ts` |
| `/api/aurelius/ahead` | HTTP handler | `src/app/api/aurelius/ahead/route.ts` |
| `/api/aurelius/chat` | HTTP handler | `src/app/api/aurelius/chat/route.ts` |
| `/api/aurelius/feedback` | HTTP handler | `src/app/api/aurelius/feedback/route.ts` |
| `/api/aurelius/memory` | HTTP handler | `src/app/api/aurelius/memory/route.ts` |
| `/api/aurelius/orchestrate` | HTTP handler | `src/app/api/aurelius/orchestrate/route.ts` |
| `/api/aurelius` | HTTP handler | `src/app/api/aurelius/route.ts` |
| `/api/billing/readiness` | HTTP handler | `src/app/api/billing/readiness/route.ts` |
| `/api/billing` | HTTP handler | `src/app/api/billing/route.ts` |
| `/api/billing/webhook` | HTTP handler | `src/app/api/billing/webhook/route.ts` |
| `/api/capture/action` | HTTP handler | `src/app/api/capture/action/route.ts` |
| `/api/capture/interpret` | HTTP handler | `src/app/api/capture/interpret/route.ts` |
| `/api/capture` | HTTP handler | `src/app/api/capture/route.ts` |
| `/api/command` | HTTP handler | `src/app/api/command/route.ts` |
| `/api/commerce/cart` | HTTP handler | `src/app/api/commerce/cart/route.ts` |
| `/api/commerce/customer/callback` | HTTP handler | `src/app/api/commerce/customer/callback/route.ts` |
| `/api/commerce/customer/disconnect` | HTTP handler | `src/app/api/commerce/customer/disconnect/route.ts` |
| `/api/commerce/customer` | HTTP handler | `src/app/api/commerce/customer/route.ts` |
| `/api/companies` | HTTP handler | `src/app/api/companies/route.ts` |
| `/api/company-talk/chat` | HTTP handler | `src/app/api/company-talk/chat/route.ts` |
| `/api/company-talk` | HTTP handler | `src/app/api/company-talk/route.ts` |
| `/api/company-work` | HTTP handler | `src/app/api/company-work/route.ts` |
| `/api/company-work/visual` | HTTP handler | `src/app/api/company-work/visual/route.ts` |
| `/api/daily/complete` | HTTP handler | `src/app/api/daily/complete/route.ts` |
| `/api/daily/review` | HTTP handler | `src/app/api/daily/review/route.ts` |
| `/api/daily` | HTTP handler | `src/app/api/daily/route.ts` |
| `/api/daily-command` | HTTP handler | `src/app/api/daily-command/route.ts` |
| `/api/grooming/feedback` | HTTP handler | `src/app/api/grooming/feedback/route.ts` |
| `/api/grooming/image` | HTTP handler | `src/app/api/grooming/image/route.ts` |
| `/api/grooming/look` | HTTP handler | `src/app/api/grooming/look/route.ts` |
| `/api/grooming/ritual` | HTTP handler | `src/app/api/grooming/ritual/route.ts` |
| `/api/grooming/scan` | HTTP handler | `src/app/api/grooming/scan/route.ts` |
| `/api/membership/registration` | HTTP handler | `src/app/api/membership/registration/route.ts` |
| `/api/missions` | HTTP handler | `src/app/api/missions/route.ts` |
| `/api/monitoring/performance` | HTTP handler | `src/app/api/monitoring/performance/route.ts` |
| `/api/performance/machine-scout` | HTTP handler | `src/app/api/performance/machine-scout/route.ts` |
| `/api/performance` | HTTP handler | `src/app/api/performance/route.ts` |
| `/api/studio/finish` | HTTP handler | `src/app/api/studio/finish/route.ts` |
| `/api/studio/image` | HTTP handler | `src/app/api/studio/image/route.ts` |
| `/api/studio/reference` | HTTP handler | `src/app/api/studio/reference/route.ts` |
| `/api/studio` | HTTP handler | `src/app/api/studio/route.ts` |
| `/api/studio/scenes` | HTTP handler | `src/app/api/studio/scenes/route.ts` |
| `/api/world/grooming` | HTTP handler | `src/app/api/world/grooming/route.ts` |
| `/api/world/priority` | HTTP handler | `src/app/api/world/priority/route.ts` |
| `/auth/confirm` | HTTP handler | `src/app/auth/confirm/route.ts` |
| `/checkout` | HTTP handler | `src/app/checkout/route.ts` |
| `/dev` | Page | `src/app/dev/page.tsx` |

## Domain and migration inventories

Domains: `access`, `ascend-profile`, `billing`, `capture`, `catalog`, `command`, `commerce`, `companies`, `company-work`, `continuity`, `daily`, `daily-command`, `development`, `ecosystem`, `goals`, `grooming`, `identity`, `intelligence`, `missions`, `onboarding`, `performance`, `person`, `pilot`, `presence`, `release`, `shared`, `studio`, `timeline`.

- `20260924150752_202609200001_foundation.sql` — `persons`, `membership_accounts`, `personal_events`
- `20260924150810_202609200002_person_and_goals.sql` — `goals`
- `20260924150812_202609200003_aurelius.sql` — `ai_conversations`, `ai_turns`, `ai_usage`, `ai_memories`
- `20260924150813_202609210004_daily_dashboard.sql` — `daily_entries`, `daily_actions`
- `20260924150814_202609240005_grooming_foundation.sql` — `grooming_profiles`
- `20260924150815_20260924144912_founder_access.sql` — `founder_access`
- `20260925135437_ascend_loop_capture.sql` — `life_captures`
- `20260925135447_ascend_profile_baseline.sql` — `ascend_profile_facts`, `ascend_profile_revisions`
- `20260925135455_aethelios_confirmed_actions.sql` — `ai_action_proposals`
- `20260925135504_daily_review_continuity.sql` — `daily_reviews`, `daily_review_revisions`
- `20260925210204_founding_members_pilot.sql` — `pilot_invitations`, `pilot_feedback`
- `20260926031906_daily_action_completion.sql` — functions, grants, policies or schema amendments
- `20260927210000_aethelios_chat_foundation.sql` — `ai_messages`, `ai_message_assets`, `ai_aux_usage`
- `20260927220000_aethelios_studio_v1.sql` — `ai_studio_projects`, `ai_studio_references`, `ai_studio_versions`, `ai_studio_usage`
- `20260928015000_studio_project_briefs.sql` — functions, grants, policies or schema amendments
- `20260928020000_studio_storyboard.sql` — `ai_studio_scenes`
- `20260928021459_ascend_performance_phase_1.sql` — `performance_profiles`, `performance_plans`, `performance_plan_revisions`, `performance_checkins`, `performance_sessions`, `performance_sets`, `performance_private`
- `20260928023000_studio_finishes.sql` — `ai_studio_finishes`
- `20260928145533_ascend_performance_programs.sql` — `performance_programs`, `performance_program_revisions`, `performance_session_context`, `performance_private`
- `20260928151124_studio_table_privileges.sql` — functions, grants, policies or schema amendments
- `20260928151743_ascend_performance_progression.sql` — `performance_progression_decisions`
- `20260928152818_grooming_concierge_recovery.sql` — `grooming_goals`, `grooming_rituals`, `grooming_checkins`, `grooming_products`, `grooming_looks`, `grooming_events`, `grooming_scans`, `grooming_scan_usage`, `grooming_photos`, `grooming_scan_observations`, `grooming_look_previews`, `grooming_look_usage`, `grooming_professional_passes`, `grooming_professional_codes`, `grooming_service_proposals`
- `20260928203910_ascend_performance_outcomes.sql` — functions, grants, policies or schema amendments
- `20260928215620_ascend_performance_fuel_body.sql` — `performance_fuel_targets`, `performance_fuel_target_revisions`
- `20260928223531_ascend_performance_recovery.sql` — `performance_recovery_routines`, `performance_recovery_revisions`
- `20260929083302_ascend_performance_movement.sql` — `performance_movements`, `performance_movement_revisions`
- `20261002105745_founding_membership_billing.sql` — `billing_profiles`, `billing_controls`, `billing_event_receipts`, `billing_enrollment_receipts`
- `20261002123344_restrict_chat_trigger_execution.sql` — functions, grants, policies or schema amendments
- `20261002141618_ascend_daily_command.sql` — `daily_command_records`, `daily_command_revisions`
- `20261002165518_account_claim.sql` — `onboarding_claims`
- `20261004180000_member_product_cabinet.sql` — functions, grants, policies or schema amendments
- `20261004222000_grooming_daily_intelligence.sql` — `grooming_practice_requests`, `grooming_ritual_requests`
- `20261005122500_proactive_signal_receipts.sql` — `proactive_signal_receipts`
- `20261006034533_company_workspaces.sql` — `companies`, `company_turn_context`
- `20261006042134_connected_company_work.sql` — `company_jobs`, `company_work_versions`
- `20261006103930_public_intelligence_missions.sql` — `intelligence_missions`
