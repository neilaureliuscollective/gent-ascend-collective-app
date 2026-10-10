# Public Aethelios — Mission Deliverables

## Phase and rationale

Founder authorized “Research plan and execute next build phase” on October 7, 2026. Public repository only. Inspection found that Talk/Council retained replies and Mission Continuity connected direction to Studio, while personal text work remained inside transcripts. Company work already had a separate structured delivery system; it should not become a prerequisite for personal work.

This phase turns useful conversation output into durable work products: **reply → deliverable → revision → user review → export → continue**. It supplies a concrete output layer before expanding specialists or autonomous execution. It does not build another dashboard, coworker roster or chat engine.

Before: return to a reply and copy/edit it elsewhere, losing the connection to its Mission and the distinction between drafts and reviewed work.
After: create a work product from a completed reply, edit it, save new versions, retain history, record review against acceptance criteria, export an exact saved version, and continue with bounded version-specific context.

## Research applied

Reviewed October 7, 2026:

- https://www.anthropic.com/engineering/building-effective-agents — prefer simple, composable workflows; retain human checkpoints before increasing autonomy. Applied as explicit promotion and version-specific review, with no extra model calls.
- https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/ — efficient correction and understandable system behavior. Applied as editable work products, visible draft/review status, recoverable conflicts and exact saved-version exports.
- Installed Next 16 route-handler and data-security guides — request-time private reads, server-only domain services, authorization for every read/mutation, same-origin validated writes.

The synthesis is specific to Aethelios: strengthen the work created by the primary intelligence rather than ask users to manage more agents.

## Architecture and scope

- Additive migration `20261007210000_mission_deliverables.sql`, dependent on Mission Continuity. Owner-bound deliverable identities, immutable text versions, and a security-invoker summary view. Authenticated clients have SELECT only; narrow security-definer RPCs resolve identity from `auth.uid()`.
- Creation reads the canonical completed reply on the server, validates personal Mission/conversation ownership and direction revision, and is idempotent per source reply. It copies the full reply, never silently truncates it. Replies over 50,000 characters cannot be promoted in this slice.
- Saving uses expected revision and a unique version request ID. Identical retries return the existing version; changed payloads and stale revisions fail. Every new version begins unreviewed.
- Review requires saved acceptance criteria and a review note, applies only to the exact current version, and has immutable replay semantics. It records a human assessment, not independent verification, external execution, or Mission completion.
- Export returns authenticated, private, no-store Markdown attachments for an explicit version, including draft/review status and notes. No public sharing URL is created.
- Mission context captures up to three latest deliverable versions with exact IDs, 1,800-character body excerpts and 600-character acceptance excerpts. Existing context receipts stay immutable. Personal context and Mission context remain independent; documents do not become global memory. Council receives the existing common scoped context.
- Mission deletion detaches deliverables rather than deleting work. Source conversation deletion removes its source reference while retaining the copied document. Explicit deliverable deletion requires confirmation and exact current revision, and deletes its versions. Already captured conversation context remains part of prior turns, as does original source text.
- Limits: 500 deliverables per person and 100 versions per deliverable. Lists read compact summaries. Opening one deliverable reads its bounded version history (worst case roughly five million text characters); lazy version-body loading is deferred and should precede substantially larger documents or limits.

## Experience and preservation

Entry points are in the existing Mission/Talk detail surface, pinned replies and the Missions page. No new primary navigation destination. Edit/review is a full work surface with wrap-safe controls at phone, Fold and desktop widths. A failed or ambiguous mutation retains visible edits and locks writes until explicit reload; reload warns before discarding text. Browser refresh warns for dirty drafts. In-app navigation does not provide persistent draft storage.

Integrated the already approved Aether Petrol change from main, preserving its assets, palette and accessibility behavior. Preserved Talk streaming, Council selection, existing model routing, Studio generation/refinement, company work, billing/access, authentication, ownership and confirmed memory. No new provider calls, dependency, billing model, background worker or production privilege.

This is a personal text-deliverable foundation. It does not rename or replace company Build, execute generated code, publish sites, send outreach, create PDF/PPTX, automatically generate revisions, or verify factual accuracy. Studio remains the visual artifact system. Later work can add specialist-assisted revision and execution against this stable artifact boundary.

## Sequence and acceptance

1. Inspect main, PR #62, public routes, domain services, ownership/schema and company work; review primary research.
2. Integrate the merged Aether Petrol assets/tokens without redesign.
3. Add owner-scoped data/RPCs, schemas/services and private export boundary.
4. Connect promotion, editor, explicit review, history, export and Mission context receipts.
5. Verify isolation, stale revisions, replay, version review, deletion lifecycle, responsive UI and existing Mission/Talk/brand flows.

Build definition of done: reviewable integrated changes, passing local gates, honest release status and no claim of hosted acceptance. Release requires migration ordering (Mission Continuity first, then Deliverables), real two-account Auth/PostgREST checks, actual model evaluation with context on/off, and physical phone/Fold/DeX checks before separately approved production promotion.

Rollback: deploy the preceding code while retaining additive records. Do not reset hosted data or remove stored versions. The new context function remains compatible with existing consumers; older clients may ignore the added deliverable field.

Main risks: stale multi-tab state, review mistaken for proof, cross-account source leakage, and document/history growth. Atomic guards, explicit user-review language, RLS/composite ownership and bounded payloads address these. Physical-device and hosted-provider behavior remain separate acceptance gates.
