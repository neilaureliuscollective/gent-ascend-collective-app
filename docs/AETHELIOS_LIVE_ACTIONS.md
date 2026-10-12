# Aethelios Live — reviewed daily actions (Phase 4B first slice)

Implemented locally October 12, 2026. Not deployed or launched. The existing OpenAI Realtime/WebRTC pilot stays active and gated; GPT-Live remains an evaluation adapter. Cinematic assets and ElevenLabs capabilities are untouched.

## Outcome and reuse

A completed scoped coworker review can now lead to one personal daily action. Select the review in the shared creation workspace, open **Review a personal daily action**, enter your own exact title, inspect the source review and local day/timezone, then explicitly confirm. The title starts blank; no AI prose becomes a commitment automatically. Confirmation writes a planning record, not execution of its contents. A verified receipt links to the existing `/app/daily` editor.

This uses the root LiveController, the same ArtifactSurface in Talk/immersive/compact views, normal session-bound Supabase access, existing `ai_action_proposals`, `daily_actions` and atomic `ai_decide_daily_action_v2` writer. The draft belongs to the shared controller rather than a component, so changing presentation modes or ending voice does not reset it. Changing the bound conversation clears the presentation draft; a saved action remains recoverable from its owned review. No separate action engine, model call, queue, service or subscription was added.

The current daily domain supports writes only to today's local date. This first slice keeps that restriction: the title is editable; the exact day/timezone are visible and bound, not an unsupported future scheduling control. One confirmed action per review, five actions per day. Later scheduling or additional actions from the same review require a separately designed domain contract.

## Security and transaction boundary

- GET preparation reads an owned, active personal conversation and completed, schema-valid scoped review. It returns the verified local date, timezone, daily version and any existing receipt. Preparation writes nothing and supplies no suggested action title.
- POST is same-origin, bounded JSON with a strict schema and explicit `confirm: true`. Paid artifact approval cannot authorize it. The server checks fresh `voice.use` and `daily.write` capabilities; the latter currently belongs to every authenticated person under the existing policy.
- `ai_confirm_reviewed_daily_action` derives the owner from `auth.uid()`, independently enforces the existing founder/beta pilot grant, active personal conversation, completed owned review, current selection, exact local date/timezone and daily version. It shares the existing per-person mutex, locks the selected source and uses the existing daily writer within one transaction.
- The new proposal exists pending only inside that transaction and is committed executed with the action. Legacy action RPCs never see an executable review draft. Existing turn-based action proposals and decisions retain their behavior.
- Stable action UUID, exact replay-payload checks and a unique source-review index prevent duplicate writes. A replay returns only when the original owned daily action still exists with the confirmed title. Changed/removed actions are not recreated. Anonymous/PUBLIC execution and direct client table writes remain denied; SQL uses an empty search path and explicit schema names.
- SQL migration adds provenance/day/version/timezone columns to the existing proposal table. Deleting the conversation removes its review content and clears the review link; the user-confirmed daily action and minimal existing proposal receipt remain personal planning history. No AI review text is copied into the receipt.
- No write function is exposed as a model tool. Voice/Council output cannot invoke this endpoint through the trusted tool dispatcher. No company write, clinical authority, memory promotion, purchase or external action is added.

After the RPC, the service re-reads the canonical daily action before returning success. If the save acknowledgment or receipt read is uncertain, the controller locks confirmation, preserves the exact draft and offers a read-only status check. It never automatically retries. Late status/preparation responses cannot unlock an in-flight save; responses from another bound conversation are ignored. If no receipt can be found, the uncertain draft remains locked for that conversation binding; inspecting daily records is the next step. Cross-tab concurrency is fenced by SQL even if another client creates a new request ID.

## Research and architecture decision

Official documentation checked October 12:

- [OpenAI GPT-Live delegation](https://developers.openai.com/api/docs/guides/live-delegation): application-owned permissions, confirmations, records and task state apply in both delegation modes. Client delegation fits the existing domain services and result-validation boundary. This supports keeping human confirmation in the app; it does not justify promoting the untested adapter.
- [GPT-Live overview](https://developers.openai.com/api/docs/guides/live): speech and backend tasks are separate, with WebRTC suited to browser audio. Keep the existing shared transport and task state; this action requires no extra model/backend-agent step.
- [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations): application-dispatched functions/results remain distinct from audio transport; WebRTC handles interrupted playback truncation. No media or turn-taking changes are necessary for this slice.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions): definer functions need explicit ownership checks, empty search path and narrowly granted execution. Preserve the existing atomic writer instead of client table writes. The changelog Markdown index fetch failed with the research tool's unsupported content-type error; no changelog compatibility review is claimed.
- Installed Next.js 16.3.5 route-handler documentation (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) reviewed before implementation. Private responses remain `private, no-store`; no shared personal cache.

Provider voice/backend pricing is unchanged. Preparing/confirming this action invokes zero OpenAI calls and consumes no new paid AI operation. The underlying source review was already approved and metered by Phase 4A. Database/hosting costs still apply; no measured cost or latency is inferred from fixture tests.

## Validation and launch gates

- Lint and strict typecheck pass. Full unit/SQL suite: **73 files / 478 tests pass**. Final changed action/security/controller suite: **3 files / 101 tests pass**. Historical migration ledger: 28 files unchanged and verified. CSS parsing and `git diff --check` pass.
- New migration scaffold generated by the pinned Supabase CLI with `SUPABASE_HOME=/tmp/aethelios-supabase` (the default home is read-only). Full migration chain passes PGlite tests, including non-owner access, pilot grant denial, absent/incomplete/changed selection, stale version/day/timezone, duplicate/different-payload confirmation, removed/renamed action, rollback at the five-action limit, archived conversations, source deletion, direct-write denial and anonymous grants. This is SQL emulation, not actual Supabase Auth/PostgREST or a multi-connection concurrency benchmark.
- Service/controller tests cover no write before confirmation, permission denial, exact canonical receipt verification, mode continuity, lost acknowledgment locking, read-only recovery and async response fencing. Synthetic Playwright cases cover 390/1440px form/receipt flow; written but unrun because a fresh loopback listen probe fails `EPERM`.
- Fresh production build still fails in the existing prebuild MediaPipe download: DNS `EAI_AGAIN storage.googleapis.com`. Asset preparation and camera functionality were not bypassed. Supabase advisors and local migration listing cannot connect to local Postgres (`ECONNREFUSED 127.0.0.1:54322`). The additive migration is unapplied to hosted Supabase.
- Actual OpenAI conversation/provider latency, voice-with-tool continuity, billed usage, real authenticated action saves, build/browser rendering, hosting sideband lifetime/crash-safe expiry, physical Samsung/iPhone/PWA/audio/battery tests remain open. No ChatGPT parity, completed launch or measured live latency is claimed.

## Next phase

Prioritize the **Phase 5 provider/mobile acceptance slice**, beginning with an authenticated protected-preview end-to-end run of the existing voice → image/research → scoped review → human-confirmed daily action flow. Apply additive migrations to the approved non-production database, restore the build/browser test environment, verify real ownership/receipts and compare Realtime with GPT-Live client delegation on the same recorded scenarios. Measure connect/turn/interruption/transcript/reconnect latency and billed cost before selecting a runtime or widening pilot access. Prove independent expiry/hangup and mobile foreground behavior before any production release. Broader action types and voice-driven proposal convenience follow this evidence; agents still never directly execute privileged writes.
