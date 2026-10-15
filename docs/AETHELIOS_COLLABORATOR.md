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

Authoritative versions live in [`src/domains/intelligence/edition.ts`](../src/domains/intelligence/edition.ts). Talk turns store `aethelios-2026-10-15.collaborator.1`. Live persistence remains `aethelios-live-pilot.3` and still composes `aureliusInstructions` + `sharedCharacter` from prompt.ts. Knowledge edition is unchanged: `2026-10-15.human-ascendance.1`. Eval pack is `collaborator.2`.

## Expertise modules

Operational playbooks, not persona inflation. The seven modules (vision, architect, ux, brand, studio, lifestyle, health) plus talk/agency remain. Selection is still deterministic: current request, short follow-ups, selected artifact, approved/selected direction, recent corrections. At most two modules inject. No extra model-routing call.

## Continuity (this phase)

`deriveWorkingState` / `workingStateFromTurns` read this conversation’s persisted turns (`status`, `user_text`, `assistant_text`), owner-scoped selected artifact identity, and thread summary. They track:

- objective
- proposed options from actual assistant text
- selected direction (preference)
- approved direction (explicit approval only)
- constraints, rejected approaches, latest-scoped corrections
- clarification when option/version evidence is missing
- artifact id / version / project
- `authorization: 'none'` always

Provenance rules:

- “Do not use the second” and “not approved” never create approval.
- “Use the second” resolves against supplied options; if those options are missing or ambiguous, the state asks one precise question instead of choosing.
- Corrections apply in chronological order; the latest explicit correction wins within its scope. More than four corrections keep the newest applicable values.
- A thread summary mentioning charcoal glass is not an approved decision.
- Switching project/artifact identity parks prior approvals.
- Preference and selection are never authorization for an external action.
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
- Pass/fail uses scenario-specific required outcomes. Privacy, ownership, permission, false-completion and citation gates are non-compensating. Averages do not pass a scenario. Usefulness and judgment require human review; keyword matches cannot establish them.
- Citations must match supplied source receipts. A URL in the answer is not sufficient.
- Cost: paid evaluation stays off by default. Before dispatch the runner validates model pricing, input/output limits and a conservative reservation (including retries). Insufficient remaining budget causes zero additional dispatches. Unknown pricing and invalid limits refuse dispatch. Missing usage retains the reservation and is not treated as $0. Provider errors keep partial reports. Local USD estimates do not control provider-wide billing.

Official references used while designing this: [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) (2026-10-15) and [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) (2026-10-15). OpenAI is deprecating the hosted Evals platform; this runner stays local.

## What the tests actually prove

Proved by synthetic fixtures and existing service/auth seams:

- Option resolution, negated approval, latest-correction wins, summary-not-approval, project-scope, missing-option clarification, persisted-turn reload after unrelated chatter.
- Production `buildMessages` receives that grounded state, including artifact identity.
- Context-off, forged founder identity and malicious retrieved text remain inside composition boundaries.
- Scoring rejects keyword stuffing, fabricated citations and missing retained facts; “I have not deployed it” does not fail as a false completion.
- Eval runner skip / ablation label / held-out set / unknown pricing / invalid limits / reservation / missing usage / provider-error partials.
- Live trusted-turn refresh injects an application item without `response.create` (synthetic socket; not microphone, not interruption).

Not proved:

- Live model answers, conversational quality, creative usefulness or judgment on real Talk/Live calls.
- Audio, barge-in, or applying a correction to the current spoken reply.
- Hosted Auth, RLS, or provider billing control.

Do not claim intelligence improved from green builds or mocked answers.

## Out of scope

No production merge, hosted SQL, credential rotation, provider switch, fine-tuning, Cedar/VAD/audio changes, or paid evaluation launch.
