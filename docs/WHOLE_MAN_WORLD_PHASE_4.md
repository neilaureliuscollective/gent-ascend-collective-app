# Whole-Man World Phase 4 — the Grooming world

Founder authorized research, planning and implementation on October 2, 2026. Continues draft PR #33 with the approved green/gold/obsidian identity.

## Why this phase

Inspection found a substantial existing Grooming system: owner-bound profiles, versioned rituals, practice records, scan consent/history, generated look concepts, private photos, products and professional handoffs. Its entry still presented many forms and equally weighted actions in one long workspace. The strongest next slice is a dedicated environment with one useful daily practice, while keeping those working tools intact.

The implementation uses `/experience/grooming` as the world entrance. Ritual, Ascend Scan, My Look and Professional are stable labeled choices with one focused surface and action. The selected area survives refresh in the URL. The Whole-Man node and directory now enter this environment, and existing private tools link back to the corresponding area. The full Concierge remains available for deeper editing and history.

## Research

Primary sources reviewed October 2, 2026. Suitability assessments below are product judgments, not comparative usability trials.

| Source | Useful principle | Gent Ascend decision |
| --- | --- | --- |
| [L’Oréal: Beauty Genius](https://www.loreal.com/en/articles/science-and-technology/loreal-paris-beauty-genius/) and [Beauty Tech](https://www.loreal.com/en/beauty-science-and-technology/beauty-tech/) | Guidance, visual exploration and routines can form one beauty experience. | Connect existing tools around a repeatable grooming practice. Keep commerce secondary and preserve the current qualitative, non-diagnostic scan boundary. No claim of equivalent model validation. |
| [Apple: Custom Plans](https://support.apple.com/en-mide/guide/fitness-plus/apdf222051d8/ios) | A routine is easier to revisit when the next session is readily available. | Lead with the member's own morning/evening/weekly ritual, not a new questionnaire or inferred routine. |
| [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Secondary detail should appear when needed; mobile benefits from prioritization. | One selected area, one main action; ritual steps in the established contextual sheet. |
| [W3C: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | True tabs require a complete focus/keyboard contract. | Use a plainly labeled group of native pressed buttons for URL-backed area selection, with no incomplete tab semantics or hidden swipe requirement. |
| [Supabase: insert](https://supabase.com/docs/reference/javascript/insert), [select](https://supabase.com/docs/reference/javascript/select), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | Insert results require explicit selection; ownership is enforced by session-bound policies. | Reuse existing tables/grants and authenticated client; retain owner filters and composite ritual ownership. No service-role access. |
| [web.dev: performant animations](https://web.dev/articles/animations-guide) | Transform/opacity are the preferred animation properties. | One reused compressed mirror asset with a small CSS drift, paused by the existing visibility/dialog/Still controller. No new graphics context, provider call or dependency. |

Installed Next.js 16.3.5 guidance and the earlier Phase 3 data-security research remain applicable: thin route handlers, server-only domain access, minimal private projections, no-store responses and server authorization for every mutation. The Supabase changelog reviewed in Phase 3 introduced no required package change for these existing-table operations.

## Build plan and architecture

1. Preserve the current Grooming recovery implementation and database ownership model; inspect ritual/check-in schema and permissions before adding a task surface.
2. Compose a dedicated environment using the existing `ritual-mirror-v1.webp` concept asset, current brand typography and fine gold framing. Keep all labels and controls in HTML. Retain the approved flowing orb identity in the shared Aethelios sheet.
3. Read at most three active rituals and one latest completed check-in per ritual. Return only owner identity guard, account date/timezone, ritual text/version and recording timestamps. No profile sensitivities, photos, scan results, product history or private professional notes are loaded into the entrance.
4. Present the member's exact saved steps one at a time. The user deliberately records completion; viewing steps does not log practice. An empty ritual offers the existing editor. Guest practice is labeled, local to this view and never written to an account.
5. Record through `grooming_checkins` with a client-generated UUID reused for retries. Existing primary-key uniqueness provides one receipt per request ID. Check existing receipt first, then current account/date/active ritual; validate owner and ritual on every retry. Concurrent identical inserts resolve the unique conflict by reading the owner-bound receipt. No schema migration is needed; the manual insert type now reflects the table's already-supported optional ID.
6. Preserve actual version history: ritual rows are immutable through the existing service and edits create a new ID/version. A recorded practice points to the displayed ritual. A ritual retired before validation is rejected; if it is retired after validation, the record still refers to the exact historical version practiced. This operation never changes the current routine.
7. Verify guest navigation, deep links, refresh, focus return, small/enlarged layouts, missing imagery, Still, member completion, duplicate-request recovery, stale session/date/ritual and real unauthenticated API boundaries. Save code, research and actual UI evidence on the existing draft.

## Persistence and product limits

Request-ID idempotency prevents duplicate writes for the same retry; it does not enforce a universal once-per-day rule across separate devices or new requests. The interface shows the last recorded date and makes today's recorded ritual reviewable. Existing history still permits separate genuine practices.

Scan, My Look and professional workflows remain in the working account workspace. This phase supplies a better entrance and a complete ritual task; it does not claim all underlying forms were redesigned. Scans still need explicit consent, look generation retains its existing quota and concept labeling, and professional sharing still uses selected-text passes rather than automatic account or photo access. No camera or paid model request starts from the new entrance.

The mirror is existing fictional brand concept art, not the member's image or a live analysis. No new asset was generated. The entire site remains a draft and production is unchanged. Existing hosted migration reconciliation, real two-account Auth/persistence, provider quality and physical-phone/Fold/PWA checks remain release gates.

## Verification

Passed production build/strict TypeScript, ESLint, 158 unit/service/route/SQL-emulation tests and the recorded migration ledger. All 15 existing world browser regression cases passed; all seven new Grooming browser cases passed on the clean final build. The latter cover 360/768/1440 layouts, URL selection/refresh, guest non-persistence, focus return, member retry after a lost response, empty and unavailable states, 320px enlarged text with missing imagery/reduced motion, and real unauthenticated API boundaries. A stale incremental build cache was discarded before final Grooming verification.

Visual review removed repeated headings, tightened mobile spacing and corrected the mirror crop. Actual UI captures: [phone](evidence/world-phase4/grooming-mobile.webp), [Fold-like](evidence/world-phase4/grooming-fold.webp), [desktop](evidence/world-phase4/grooming-desktop.webp), [recorded practice using synthetic member data](evidence/world-phase4/ritual-member-fixture.webp). Member browser fixtures are synthetic and never represented as live account verification. These browser sizes are emulation, not physical-device performance measurements.
