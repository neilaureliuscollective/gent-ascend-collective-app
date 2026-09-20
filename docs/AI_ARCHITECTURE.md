# Aurelius intelligence architecture

Stage 1 defines interfaces only; no installed AI runtime, model call, chat persistence or workflow engine. Aurelius is a global contextual surface with a future server orchestrator, not a standalone chat product.

Pipeline: verified principal + capabilities → authorized domain context projections → source-aware context assembly → bounded model/tool execution → validated proposal → user confirmation when needed → domain mutation → event. Never trust client-provided person IDs, roles or tool scopes. Tool handlers reauthorize every call, including resumed execution.

Context types: canonical facts, user preferences, active goals, observations, temporary context, summaries, conversation turns and inferred claims. Preserve origin, source IDs, timestamp, confidence where meaningful and user-confirmation status. Model text never updates canonical records implicitly.

Memory retrieval starts with SQL filters and source-linked summaries. Add embeddings only when measured retrieval limitations justify them. Deletions must invalidate summaries and derived indexes; memory write policy and user controls precede durable memory.

Research: downloaded the official published ai@7.0.107 package without installing it into the application. Its package.json and bundled docs/08-migration-guides/23-migration-guide-7-0.mdx confirm Node >=22 and ESM-only. The bundled agent references confirm typed runtime context, tool approvals and telemetry. WorkflowAgent is supplied by the separate @ai-sdk/workflow integration; durable contexts must be serializable, and its loop requires an explicit step budget. This is available infrastructure, not an obligation to add a workflow engine now. Stage 3 should recheck the chosen release before coding. Use instructions, isStepCount and onEnd where the v7 docs specify them; do not copy v6 examples.

Stage 3 starts with read-only contextual assistance and an explicit feature-level unavailable state when no model key exists. Add source references, cancellation, bounded steps/timeouts, per-user usage limits, cost accounting and telemetry without sensitive payloads. Provider briefs are drafts with source dates/uncertainty, approved by the user before export or sharing; not diagnosis or treatment instructions.

Future tool approvals persist actor, scope, exact action/input hash, expiry, idempotency key and state; never treat a prior general chat message as perpetual approval. Durable execution follows a concrete workflow need and privacy review.
