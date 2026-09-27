# Aethelios Chat Foundation — September 27, 2026

Founder approved the Phase One conversation build. This branch combines the commerce preview and latest public Aethelios living-field branch before changing member chat. No hosted migration or production release has been performed.

## Implemented

- Additive migration `20260927210000_aethelios_chat_foundation.sql`: archive and title metadata, thread summary checkpoint, revision ancestry, per-message text/parts/status records backfilled from every existing turn, future media metadata, auxiliary model usage, indexed owner-scoped full-text search. Existing `ai_turns` IDs and action proposal foreign keys remain intact.
- One atomic user/assistant message projection per turn. The existing turn ledger remains the generation and daily-action source during this compatibility phase. A future tool/Studio writer may add `tool` messages and media assets after its private Storage and permissions contract is implemented.
- Owner-derived metadata/search/summary/revision RPCs; grants and RLS keep direct content mutation unavailable to client roles. Unlimited conversation count/history in place of arbitrary 100/200 caps; per-account request quotas remain.
- Server-side cursor paging for conversation lists and older turns; message-content search; generated first-thread titles with fallback to the first message. Manual rename wins over generated titles.
- Retry a failed/cancelled latest reply, regenerate a completed latest reply, and edit/resend the latest message. Previous versions remain in the database and can be expanded in the transcript. Old versions are excluded from subsequent model context. Existing explicit memory and approved daily-action boundaries remain.
- Context assembly keeps recent completed turns from the selected conversation; after long threads, it builds a bounded thread summary checkpoint of older turns. A summary is conversation context, never confirmed cross-conversation memory. Context assembly fails closed if the older thread cannot be summarized, rather than silently claiming continuity.
- Confirmed memory is selected by relevance to the new question; recent daily records enter only for related questions. Founder bridge retrieval remains owner-scoped and bounded.
- Desktop library and mobile drawer gain indexed search, archive/restore, inline rename and pagination. Transcript gains load-older, copy, revision controls and draft edit state. Existing NDJSON stream, stop and persistence acknowledgment remain.

## Research decisions

- OpenAI Responses API remains the provider adapter; `store:false` and application-owned transcript avoid coupling history to provider retention. Current OpenAI guidance: https://developers.openai.com/api/docs/guides/conversation-state and https://developers.openai.com/api/docs/guides/streaming-responses . Assistants was sunset August 26, 2026: https://developers.openai.com/api/docs/assistants/migration .
- The app continues using Next.js 16 Node Route Handlers and the installed AI SDK 7 adapter, instead of adding a competing chat stack. Route guidance: https://nextjs.org/docs/app/getting-started/route-handlers .
- Supabase owner policies, session-bound clients and Postgres full-text indexes remain the access/search spine: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/database/full-text-search .
- Image/file inputs and conversational image generation use content parts and assets later: https://developers.openai.com/api/docs/guides/file-inputs and https://developers.openai.com/api/docs/guides/image-generation . This phase does not create a Storage bucket or expose an upload control.

## Release order and verification

1. Review and apply the new migration to staging. Backfill is part of that migration; confirm old conversation, reply, feedback and action-proposal links before switching deployed code.
2. Deploy the branch to a protected preview with server-only OpenAI key and real Auth. Test founder and second account, long conversation, refresh, sign-out/in, search, archive, revision and cross-account denial. No production schema/code promotion before these checks.
3. Evaluate generated titles and thread summaries with a live model and measure latency/token usage. `AETHELIOS_TITLE_MODEL` and `AETHELIOS_SUMMARY_MODEL` may be set to a vetted cheaper model; both default to the configured chat model. Auxiliary calls have their own bounded usage ledger (60/day, 5/min per person).
4. Test closed Fold, unfolded Fold, desktop and iPhone Safari, including keyboard, long Markdown/code, offline failure and reconnect. The PWA service worker must not cache private chat responses.

Local result: lint, strict types, 88 unit/PGlite SQL tests, production build, and migration ledger check passed. PGlite is not a GoTrue/PostgREST integration. Browser tests could not run because the pinned Chromium download returned an invalid/truncated archive. The environment has no OpenAI key, Supabase connection or local Supabase CLI runtime. No live model, hosted DB or physical-device claim is made.

## Remaining limits

- Uploading images/PDFs, generated assets, voice, advanced persistent memory, tools and Studio are not active. The message and asset schema creates a safe integration point, not a visible promise of those capabilities.
- Historical text is still stored in `ai_turns` while the per-message projection is kept transactionally in sync. A later contract migration can retire the legacy pair after existing feedback/action references move; avoid a second independent writer now.
- Long legacy threads may incur summary latency on first continuation. The live quality/latency gate must tune batch sizes and model routing. Failed summary preparation blocks that request, preserving thread truth.
- UI browser behavior and real cross-user Auth are open gates until preview testing. No production deploy or schema change was attempted.
