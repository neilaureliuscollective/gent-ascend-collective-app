# The Ritual — Daily Grooming Intelligence

Founder-approved October 4, 2026. Canonical base: `6abfd6d90bf433a85e3eda53e29bacd60662ec03`. Build/review approval only; production promotion is a separate step.

## Delivered experience

- `/app/grooming` now opens the same operational chamber as `/experience/grooming`. Member initial data is read server-side; history, direction, scans, concepts, professional handoffs and original deep links remain available. A signed-out sample never writes account data.
- The member's timezone suggests morning or evening. Every time is immediately selectable; this is a deterministic suggestion, not an inferred schedule. No repeated introduction or questionnaire.
- Guided practice follows the exact saved newline steps. “I've done it” explicitly records a familiar routine without walking every step. Neither viewing nor closing the player completes it.
- The player reads the actual owner-linked Cabinet products, including external products and member-reported state/notes. It shows the latest twelve links and exact count, with a full Cabinet destination. No consumption, purchase, ingredient recommendation or depletion inference.
- Focused creation/refinement provides an editable familiar-care starter, review, current-version comparison, explicit save and retained draft. A reviewed revision keeps product links with the conceptual ritual while earlier check-ins remain attached to their original version.
- Optional completion feedback records Comfort/effort/irritation self-report. Seven local days show recorded rituals and actual notes, bounded to the latest hundred qualifying entries. No appearance score, causal claims or fabricated improvement.
- Private visual history supports optional side-by-side member-selected photos. Images remain behind the existing owner-bound route. Different views/same-photo selections are labeled. Photos are never sent to Aethelios by this UI.
- The grooming conversation starter now supplies a useful editable prompt. Existing per-message personal-context consent controls remain authoritative. Relevant context includes current versioned rituals, product links and seven recent practice notes.
- When the user explicitly requests a routine revision, Aethelios may emit one bounded structured draft. A completed, schema-valid saved reply gets “Review ritual change.” The server resolves that exact owner-bound turn; the editor compares against the current routine and requires explicit saving. Chat never writes a ritual. Invalid/partial/multiple draft blocks have no review action.

## Architecture and recording semantics

Reuse existing domain services, image routes, conversation/Council infrastructure, visual atmosphere and full-screen ContextSheet. No new production dependency or provider.

The additive migration `20261004222000_grooming_daily_intelligence.sql` introduces an optional check-in local day and private replay ledgers. Owner-resolving RPCs handle practice, feedback and reviewed revisions. Anonymous execution is revoked. Normal application requests carry the member's session; no service-role access.

Practice shares the ritual-versioning lock, validates the displayed active version and current local day, and adopts an existing legacy completion for that day. Two different requests for the same ritual/day return the authoritative same completion. Exact replay is valid after retirement/midnight; changed payloads are rejected. Existing records are neither backfilled nor deleted. Direct authenticated check-in insertion is revoked, so migrate and release this application together; the legacy workspace writer now uses the same RPC.

Editor saves use an immutable request with exact draft/version/source. An uncertain result locks editing while a retry confirms the same write. Confirmed stale/auth failures require reload. A source turn must remain an owner-bound completed reply at saving; it does not confer authority.

Legacy free-text routines remain canonical. Step-specific product assignment, custom schedules, calibrated skin analysis, push reminders, AR styling and automatic replenishment are not introduced. No unsupported timer or quantity is invented.

## Research and review

Planning compared official advertised Skin Bliss, LumiLog, Rhune early access and Geologie capabilities. Competitors were not tested hands-on. Sources reviewed October 4, 2026:

- https://getskinbliss.com/
- https://apps.apple.com/us/app/lumilog-skincare-routine/id6760220238
- https://rhuneskin.com/
- https://geologie.com/

Read the installed Next.js 16.3.5 mutating-data guide before implementation. Reviewed React component state, ownership at mutation boundaries, parallel reads, hydration, keyboard/native modality, bounded payloads and retained failure drafts.

## Validation and release limits

Local lint, strict type generation/typecheck, all 294 unit/SQL tests, production compilation/build and the recorded 28-file inherited migration ledger pass. SQL tests cover daily duplicate requests, same-ID replay, stale day/version, wrong owner, anonymous/direct-write denial, optional feedback, version history and product-link retention. PGlite is not real Auth/PostgREST.

Final local browser run: 27/27 Grooming, Cabinet and Council checks passed; the four retained-direction checks also passed in the preceding run. The fullscreen player/editor were visually inspected at phone/Fold widths. Review publication was blocked by automatic approval review because it requires explicit source-export permission; no PR or CI run is claimed. These tests include signed-out production API behavior and intercepted private fixtures; fixture images are not hosted member acceptance. Added real local Auth/PostgREST RPC tests and a real authenticated member chamber save/reload/practice browser gate to CI. Local Docker/Supabase is unavailable, so those gates depend on CI execution.

Before production: reconcile latest main, apply only this reviewed additive migration to the correct Gent-owned ledger, verify real identity/RLS/RPC behavior, verify deployed candidate identity, and perform signed-in physical iPhone/Fold/PWA and live model-draft evaluation. No migration, provider call, production deployment or real customer data change was performed in this build.
