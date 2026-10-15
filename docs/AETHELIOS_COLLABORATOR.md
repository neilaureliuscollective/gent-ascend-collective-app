# Aethelios collaborator intelligence — 2026-10-15

Status: implemented on a focused branch. Not merged, not deployed, no paid evaluation run from this task.

This continues the knowledge, behavior and evaluation layer on the existing published-knowledge foundation. It does not replace brand facts, memory, Talk creation tools, Cedar, Realtime transport, transcript filtering, charcoal-glass materials, or the separately active image-attachment and globe-voice builds.

## Architecture

```
edition.ts                 single promptVersion + knowledgeEdition + live persistence tag + evalPack
behavior.ts                character + vision/craft/research/conversation strengths
playbooks.ts               seven expertise modules + inspectable selection (max two)
working-state.ts           derived from this conversation (not a second memory store)
prompt.ts / buildMessages  Talk and Live application context
service.ts                 production text composition uses the same derived state
live/service.ts            admission state + trusted-turn refresh via application items
behavior-eval*.ts          scenarios, gates, sequential harness, reserved-cost runner
```

Authoritative versions live in [`src/domains/intelligence/edition.ts`](../src/domains/intelligence/edition.ts). Talk turns store `aethelios-2026-10-15.collaborator.1`. Live persistence remains `aethelios-live-pilot.3` and still composes `aureliusInstructions` + `sharedCharacter` from prompt.ts. Knowledge edition is unchanged: `2026-10-15.human-ascendance.1`. Eval pack is `collaborator.3`.

## Expertise modules

Operational playbooks, not persona inflation. The seven modules (vision, architect, ux, brand, studio, lifestyle, health) plus talk/agency remain. Selection is still deterministic: current request, short follow-ups, selected artifact, approved/selected direction, recent corrections. At most two modules inject. No extra model-routing call.

## Continuity (this phase)

`deriveWorkingState` / `workingStateFromTurns` read this conversation’s persisted turns in chronological order (`id`, `status`, `user_text`, `assistant_text`, optional per-turn `selectedArtifact`), owner-scoped selected artifact identity, and thread summary. They track:

- objective
- proposed options from the latest option set in the active scope
- selected direction bound to the option set that was offered at that moment (`selectedSource` turn/option-set/ordinal)
- approved direction (explicit approval only; separate from selection)
- typed constraint fields (audience, palette, tone, objective, format, dimensions, requirement) with superseded values
- constraints, rejected approaches, revocations (history retained)
- clarification when option/version evidence is missing
- artifact id / version / project
- `authorization: 'none'` always — conversation state grants no tools and no founder access

Provenance rules:

- Interleaved turns are processed as they happened. “The second” resolves against the preceding option set in that scope. A later X/Y/Z list cannot rewrite an earlier B. Ambiguous references stay unresolved and ask one precise question.
- “Do not use the second” and “not approved” revoke the relevant active selection or approval while keeping history. They never create approval. Rejecting one element does not clear every project decision.
- Per-turn artifact identity isolates objectives, choices, approvals and constraints. A silent UI artifact change does not reuse unrelated approvals just because the user did not type “Switch.” Returning to earlier work restores that work’s latest valid state, including revocations. Production history without per-turn artifact tags keeps conversation-level decisions and attaches the current artifact identity.
- Standing preferences copy only from an explicit “from now on.” Other shared guesses are not made.
- Corrections apply by field and scope; the latest explicit correction to the same field in the same scope wins. Unrelated fields remain. Ambiguous language is not coerced into a structured value.
- A thread summary mentioning charcoal glass is not an approved decision.
- Preference, selection and creative-direction approval are never authorization for an external action.
- No new personal facts are persisted. This is not `ai_memories`.

Talk `service.ts` and Live admission pass the same grounded state into `buildMessages`, including selected artifact id/version/project after ownership checks. Ordinary chat still loads no playbook. Once a direction is selected, later turns refine it.

### Live mid-call refresh

After a trusted persisted voice turn, Live may inject an application item (`conversation.item.create` with a compact application id) containing the refreshed working state. It does **not** call `response.create`, so Cedar, VAD, transport, permissions, transcript filtering and compact text motion stay unchanged.

**Unsupported without a transport change:** applying a correction to the in-flight spoken reply would require `response.cancel` plus a new `response.create` while audio may already be playing. That is a larger Realtime/VAD change and is not improvised here. The injected item is available to subsequent provider responses.

## Evaluation

- No-cost path: Vitest composition, working-state continuity, selection, privacy, scoring-function and reserved-cost tests.
- Opt-in path: `npm run eval:behavior` with `AETHELIOS_BEHAVIOR_EVAL=1` (approval) and `AETHELIOS_BEHAVIOR_EVAL_EXECUTE=1` (actual model answers). Paid calls were not run from this task.
- Scenario set: `AETHELIOS_BEHAVIOR_EVAL_SET=core|held-out|all` (default `core`). Reports which set ran.
- Comparison is an **ablation** of the current instructions with playbooks/working-state omitted (`aethelios-2026-10-15.collaborator.1-ablation.playbooks-working-state-omitted`). It is **not** a pinned historical baseline of commit `6e35741`. `historicalBaselinePinned` is false.
- Sequential harness: `historyMode: generated-multi-turn` feeds generated assistant replies into later user turns. Injected generators are for offline tests. Scripted-history final-turn tests are labeled separately.
- Reload tests use the persisted-turn loading seam. A joined-text summary is not a reload test. Text-based voice wording tests are not audio or interruption tests.
- Pass/fail uses required outcomes, forbidden outcomes and critical gates. Stylistic dimension scores do not pass a scenario. Empty or irrelevant answers fail substantive tasks. Search failure must honestly state that verification is unavailable and must reject unsupported current facts; several honest phrasings can pass. Privacy, ownership, permission, false-completion, citation and search-honesty gates are non-compensating. Usefulness and judgment require human review; keyword matches cannot establish them.
- Citations must match supplied source receipts and must not assert claims absent from that evidence. A URL in the answer is not sufficient.
- Generated multi-turn continuity is derived from the option actually generated and selected. If that cannot be resolved, the scenario is unscorable rather than passed with a hardcoded direction.
- Cost: paid evaluation stays off by default. The fully assembled instructions plus messages, including accumulated history, are measured before dispatch. Oversized requests are rejected (`reject-oversized`); they are not truncated, so a reservation is never taken for a smaller payload than the one sent. Cost is reserved before each sequential call, including retries. Every dispatched attempt is counted, including failures, timeouts and retries. Missing usage on any turn retains that turn’s reservation and is not summed as $0 because another turn reported usage. Reports distinguish estimated, reserved and reported cost. Unknown pricing, invalid limits and insufficient remaining budget refuse further dispatch. Provider errors keep partial reports. Local USD estimates do not control provider-wide billing. Mocked generator results prove plumbing only.

Official references used while designing this: [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) (2026-10-15) and [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) (2026-10-15). OpenAI is deprecating the hosted Evals platform; this runner stays local.

## What the tests actually prove

Proved by synthetic fixtures and existing service/auth seams:

- Option-set provenance across multiple sets in the same project and in different projects; reload keeps the original B after a later X/Y/Z list.
- Choose → approve → revoke; reject one element; silent artifact change without “Switch”; return restores revoked state; missing provenance asks one precise question. Assertions use final active state and source IDs.
- Typed field corrections: emerald base → charcoal base, warm tone → restrained tone, more than four corrections across artifacts, one field does not erase another.
- Production `buildMessages` receives that grounded state, including owner-scoped artifact identity and source IDs.
- Context-off, forged founder identity and malicious retrieved text remain inside composition boundaries.
- Scoring rejects empty answers, keyword stuffing, invented prices, fabricated citations and missing required outcomes; a correct paraphrase and “I have not deployed it” do not fail those gates. Generated continuity without a resolvable selected option is unscorable.
- Eval runner skip / ablation label / held-out set / unknown pricing / invalid limits / oversized assembled input / growing history / mixed known-unknown usage / retry / timeout / provider-error partials. Dispatch counts and remaining reservations are asserted.
- Live trusted-turn refresh injects an application item without `response.create` (synthetic socket; not microphone, not interruption).

Not proved:

- Live model answers, conversational quality, creative usefulness or judgment on real Talk/Live calls.
- Audio, barge-in, or applying a correction to the current spoken reply.
- Hosted Auth, RLS, or provider billing control.

Do not claim intelligence improved from green builds or mocked answers.

## Out of scope

No production merge, hosted SQL, credential rotation, provider switch, fine-tuning, Cedar/VAD/audio changes, or paid evaluation launch.
