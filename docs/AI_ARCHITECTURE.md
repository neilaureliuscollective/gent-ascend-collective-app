# Aurelius intelligence architecture

Stage 1 defines interfaces only; no installed AI runtime, model call, chat persistence or workflow engine. Aurelius is a global contextual surface with a future server orchestrator, not a standalone chat product.

Pipeline: verified principal + capabilities → authorized domain context projections → source-aware context assembly → bounded model/tool execution → validated proposal → user confirmation when needed → domain mutation → event. Never trust client-provided person IDs, roles or tool scopes. Tool handlers reauthorize every call, including resumed execution.

Context types: canonical facts, user preferences, active goals, observations, temporary context, summaries, conversation turns and inferred claims. Preserve origin, source IDs, timestamp, confidence where meaningful and user-confirmation status. Model text never updates canonical records implicitly.

Memory retrieval starts with SQL filters and source-linked summaries. Add embeddings only when measured retrieval limitations justify them. Deletions must invalidate summaries and derived indexes; memory write policy and user controls precede durable memory.

Research: published ai@7.0.107 package requires Node >=22; runtime selected is Node 24. Detailed 7.0 API/ESM/tool/runtime-context/workflow claims must be checked against bundled official docs at Stage 3; the web docs endpoint was not reliably accessible in this session. Do not infer that every named feature is stable merely because the major package exists. No speculative WorkflowAgent integration.

Stage 3 starts with read-only contextual assistance and an explicit feature-level unavailable state when no model key exists. Add source references, cancellation, bounded steps/timeouts, per-user usage limits, cost accounting and telemetry without sensitive payloads. Provider briefs are drafts with source dates/uncertainty, approved by the user before export or sharing; not diagnosis or treatment instructions.

Future tool approvals persist actor, scope, exact action/input hash, expiry, idempotency key and state; never treat a prior general chat message as perpetual approval. Durable execution follows a concrete workflow need and privacy review.
