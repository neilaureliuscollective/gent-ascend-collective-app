# Aurelius intelligence architecture

## Shipped foundation: Aurelius 1A

The founder moved working intelligence ahead of measurement/routine expansion. Aurelius is one reusable intelligence service, available in the persistent global panel and /aurelius full workspace. Both use the same authorized routes, database records, prompt policy and streaming implementation. Atlas remains separate.

AI SDK 7.0.107, Node 24/ESM. A ToolLoopAgent owns the versioned instructions and provider settings. It currently has no tools and exactly one model step. Do not add a durable workflow engine merely because the SDK supports it. Current model selection defaults to openai/gpt-6-astra, verified in the Gateway model catalog on 2026-09-20; AURELIUS_AI_MODEL is server configuration, never request input. No provider key is shipped.

Vercel AI Gateway is the initial provider adapter. This avoids installing several model SDKs. It does not require deploying the app to Vercel. Runtime configuration remains isolated; no client imports of credentials or model execution. The adapter boundary can support a direct provider later if latency/privacy/cost evidence warrants it.

## Request and persistence

Verified Supabase identity → person and capability check → atomic database request reservation → freshly loaded owner context/history → bounded agent stream → database finalization → saved acknowledgment to UI.

The browser submits only conversation UUID, request UUID, user text and includeContext. Client-supplied message arrays, roles, ownership, model IDs and instructions are rejected. Normal queries and RPCs use the actual user session. RPCs derive owner from auth.uid() with a fixed empty search_path. There is no service-role app client.

ai_begin_turn locks the person row, reserves a unique request, enforces one pending turn/person, bounded conversations/turns and rolling usage limits. Retrying a request ID never generates a second reply. Stale pending turns expire after two minutes on the next start. ai_finish_turn can finalize a pending owner turn once. Conversation deletion cascades content; late finalization cannot resurrect it. ai_usage survives conversation deletion so content deletion cannot reset quotas.

The authenticated RPC surface permits an owner to finalize their own working records. These records and token counters are not tamper-proof audit or billing evidence, and are never elevated into trusted instructions or clinical truth. Server capability checks protect the actual model-spend endpoint. Future billing must reconcile trusted provider receipts in a separately protected operational domain.

The stream persists partial output as failed/cancelled when possible. The client receives a saved event only after confirmed persistence. Server death/network loss may leave a pending lease; UI says reload instead of declaring success. No resumable stream or background continuation is promised. Stop/closing the panel aborts the request; any in-flight provider processing may already have incurred usage.

## Context and memory

On each request, optionally project current profile, active goal and at most 24 explicitly confirmed memories. Only needed fields leave the server. Context strings are serialized as a user-level data message, never inserted into the privileged instruction text. This is defense in depth, not a guarantee that a model cannot be influenced; there are no write/external-action tools in this phase.

History includes at most 20 recent completed exchanges, up to 32,000 characters, with intact user/assistant pairs. Incomplete replies are displayed but not reused in context. Current request is capped at 6,000 characters. Stored history may exceed the model's supplied context; the UI discloses that limitation. No cross-conversation automatic recall or generated summaries yet.

Memory is manual, user-confirmed, source=user, kind=fact/preference, timestamped and versioned. Saved conversational text is not automatically memory. Corrections reject stale versions. Deletion removes the record from subsequent retrieval; old chat messages may still quote it and must be deleted separately. Requests already sent cannot be recalled. No embeddings/vector database or background inference store.

## Behavior and feedback

Canonical reasoning and temperament documents are mirrored in docs/doctrine/. Runtime instructions are a reviewed distillation in prompt.ts, tracked by promptVersion on each turn. They establish composure, warmth, concise judgment, respectful challenge, honest uncertainty and proportional depth. They explicitly state the absence of web research, files, voice and external actions, and prohibit claiming such work was performed.

Helpful/Needs work is explicit per-reply feedback. The local founder console surfaces the most recent ten flagged replies for prompt review. Feedback does not fine-tune weights, automatically update instructions or silently create facts. Changes require evaluation using AURELIUS_EVALUATION.md.

## Bounds and privacy

120 starts/person/rolling 24 hours; 10/minute; one active generation/person; 100 conversations/person; 200 turns/conversation; 24 memories × 500 characters; 4,096 output tokens; 90-second model timeout; 95-second stream abort; no SDK retries. These are initial operational ceilings, not membership/pricing promises. Input/output token counts are diagnostics, not an authoritative dollar bill. Use a dedicated Gateway key with an operator-configured spend budget before live testing.

Gateway requests set disallowPromptTraining=true. This is not zero retention or a BAA; BYOK and team/provider settings have separate implications. Before personal/sensitive beta use, review actual Gateway logging/retention/provider routing and contracts. Do not send production PHI. This phase's automated model tests use synthetic data.

No raw prompts/errors in application telemetry. The SDK's default stream error handler logs errors, so a model middleware replaces raw provider exceptions/error chunks before they reach it and omits raw request/response metadata. Unit tests verify that provider secrets do not leak through this path. Markdown renders without raw HTML or remote images, with safe default URL handling.

## Later extension points

Typed context providers remain available for metrics, routines and timelines. Introduce research tools with sourced citations, approval policies for consequential actions, user-reviewed memory proposals and summarization only after the text/continuity loop is validated. Every tool must independently reauthorize ownership; prompt text never grants permission.
