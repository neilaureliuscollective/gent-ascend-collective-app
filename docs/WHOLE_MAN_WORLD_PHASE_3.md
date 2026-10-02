# Whole-Man World Phase 3 — personal continuity

Authorized research, planning and build: October 2, 2026. Continues draft PR #33 and the founder-approved emerald energy orb.

## Product decision

The world now needs to remember a useful commitment. The next slice is one saved daily priority and the next unfinished action from the existing daily system. This makes the environment useful on return without filling it with cards, activity counters or fictional signals. The priority belongs to the whole man and is not classified into a world by guessing from his words.

The existing `daily_entries.intention` is the source of truth. Do not create a second priority table, auto-copy guest reflection into an account, or store private records in browser storage. One understated personal signal occupies the destination-copy space for members; its focused sheet holds the full text, editor, source/date and return-to-day link. Guests retain the existing session-only direction exercise.

## Research and implications

Primary sources checked October 2, 2026. These are design and implementation findings, not claims of user trials.

| Source | Relevant finding | Build decision |
| --- | --- | --- |
| [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Prioritize frequent, important actions and defer secondary controls. | One priority in the scene; editing and detail appear in the existing contextual sheet. |
| [Next.js: Data Security](https://nextjs.org/docs/app/guides/data-security), also installed Next.js 16.3.5 docs | A server-only data access layer should authorize requests and return minimal data transfer objects. | A daily-domain projection returns only the current date, priority, version, source timestamp and next action. Wellness and reflection fields never enter the world response. |
| [Next.js: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) | Route handlers expose standard request/response behavior. | A thin GET/PUT adapter calls the daily service; body and origin validation reuse the existing application boundary. |
| [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | Grants and ownership policies work together; authenticated role alone is not ownership. | Reuse session-bound `authorizedPerson`, owner predicates and the existing `daily_save` transaction. No service-role client, schema change or new grant. |
| [Supabase: RPC](https://supabase.com/docs/reference/javascript/rpc) | Client RPC invokes database functions with named arguments. | Existing versioned transaction preserves atomicity and rejects writes that race after the server reads the day. |
| [W3C: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Save and error feedback should be available to assistive technology without moving focus. | A live status acknowledges confirmed saves; errors retain the draft and offer explicit reload. |
| [Supabase changelog](https://supabase.com/changelog) | Reviewed recent platform entries, including September 25 Postgres changes and September 30 middleware release. | Neither requires a new library for this existing daily-record slice. No platform upgrade or extension change. Markdown index retrieval was unsupported by the research tool; the HTML changelog was read instead. |

## Execution plan and implemented architecture

1. Preserve the approved orb, scenery and spatial navigation. Inspect the current daily schema and version-locking transaction.
2. Add a narrow current-day read and intention-only update in the daily domain. The authenticated person's timezone determines the day. A stale account, date or version blocks the write. The client-supplied owner is only a guard against saving an old draft into a newly signed-in account, never authorization.
3. On update, read existing daily fields on the server, retain energy, sleep, reflection and ordered actions, then call `daily_save` with the expected version. Its owner lock and date/version checks close the read/write race. Return a fresh minimal snapshot after success.
4. Paint the world independently of private-data loading. Fetch once on entry and refresh on return to a visible/focused page when no editor/draft is active. No continuous poll, realtime subscription, extra scene or additional dependency.
5. Display one dated, user-authored priority. Use the established sheet for editing, show the next unfinished action, and return to `/app#daily-actions`. The existing daily workspace remains the owner of action completion and review.
6. Keep drafts on close/reopen and failed saves. A conflict or uncertain result requires explicit reload before retry; no automatic replay or success animation before confirmation. Guest reflection remains explicitly separate.
7. Verify the service's projection and preservation behavior, route origin/auth/body constraints, database regression suite and actual production UI at phone/Fold-like/desktop widths.

## Limits and next phase

This is a built account-backed integration, not a claim that a real hosted member has completed acceptance. Browser member flows use clearly identified synthetic API fixtures; real unauthenticated endpoint boundaries are exercised separately. Existing SQL-emulation tests cover the transaction and ownership, not live Supabase Auth. Physical phone/Fold/PWA and hosted two-account acceptance remain release gates inherited from earlier phases.

No migration, dependency or production deployment. Remaining guest drafts disappear on refresh. Selected-world URL behavior stays intact. There is no automatic AI interpretation, action completion, health score, background personal-data collection or private context sharing with Aethelios.

Next useful phase: dedicated Grooming world entrance and continuity into the existing Concierge, preserving its working analysis, routines and professional boundaries. Subsequent world expansion should reuse this narrow projection pattern rather than loading every domain into the home scene.

## Verification

- Production Turbopack build/strict TypeScript and ESLint pass.
- All 150 unit/service/route/SQL-emulation tests pass, including seven new tests for projection, field preservation, stale owner/date/version, race rejection, outages and API boundaries.
- Recorded migration ledger check passes; no hosted query, migration or deployment was performed.
- Fifteen existing world browser scenarios passed. All six new priority scenarios passed on the final build: member editing/refresh at 360/768/1440 widths, conflict recovery, uncertain network result, and real guest endpoint/auth boundaries. Member cases intercept the API with synthetic records and are not real Auth tests.
- Initial visual review found the added priority below the dock; replaced the member destination-copy block with the priority. The corrected phone case explicitly checks dock clearance. Two initial test failures were locator ambiguity with Next's route announcer; scoped assertions to the dialog and reran successfully.
- Inspected actual built phone and desktop layouts. [Phone world](evidence/world-phase3/personal-world-mobile-fixture.webp), [phone editor](evidence/world-phase3/priority-editor-mobile-fixture.webp), [desktop world](evidence/world-phase3/personal-world-desktop-fixture.webp). These captures use synthetic member records, not live personal data.
- No physical-device frame-rate/battery or real hosted two-account persistence claim. Those acceptance checks remain open.
