# Aethelios collaborator intelligence — 2026-10-15

Status: implemented on a focused branch. Not merged, not deployed, no paid evaluation run from this task.

This is the next knowledge, behavior and evaluation layer on the existing published-knowledge foundation. It does not replace brand facts, memory, Talk creation tools, Cedar, Realtime transport, transcript filtering, charcoal-glass materials, or the separately active image-attachment and globe-voice builds.

## Architecture

```
edition.ts                 single promptVersion + knowledgeEdition + live persistence tag
behavior.ts                character + vision/craft/research/conversation strengths
playbooks.ts               seven expertise modules + inspectable selection (max two)
working-state.ts           derived from this conversation (not a second memory store)
prompt.ts / buildMessages  Talk and Live application context
agent.ts                   text instructions + web_search + optional Talk tools
live/service.ts            same instruction set + voice delivery; Cedar/VAD unchanged
behavior-eval*.ts          scenarios, deterministic scoring, opt-in execution runner
```

Authoritative versions live in [`src/domains/intelligence/edition.ts`](../src/domains/intelligence/edition.ts). Talk turns store `aethelios-2026-10-15.collaborator.1`. Live persistence remains `aethelios-live-pilot.3` and still composes `aureliusInstructions` + `sharedCharacter` from prompt.ts. Knowledge edition is unchanged: `2026-10-15.human-ascendance.1`.

## Expertise modules

Operational playbooks, not persona inflation:

| ID | Domain | Execute vs advice |
| -- | ------ | ----------------- |
| `vision` | Product vision and business concepts | Briefs are drafts until saved |
| `architect` | Software, websites, applications | Compile/deploy need receipts |
| `ux` | Interaction and visual quality | Chat notes are not a shipped UI |
| `brand` | Brand strategy and launch campaigns | Agency is not implemented |
| `studio` | Studio workflows and production handoffs | Export/render need receipts |
| `lifestyle` | Commerce and product storytelling | Read-only catalog only |
| `health` | Personal/health-information organization | Not a clinic |

`talk` and `agency` remain for ordinary conversation and planned-Agency honesty. Selection is deterministic: current request, short follow-ups, selected artifact, approved direction, recent corrections. At most two modules inject. Reasons are inspectable. No extra model-routing call.

## Continuity

`deriveWorkingState` reads this conversation’s turns, thread summary and selected artifact. It tracks objective, approved direction, constraints, rejected approaches, corrections and next step. After reload, the same turns produce the same derived state. It is labeled untrusted application data and is not `ai_memories`.

## Evaluation

- No-cost path: Vitest composition, selection, privacy and scoring-function tests.
- Opt-in path: `npm run eval:behavior` with `AETHELIOS_BEHAVIOR_EVAL=1` (approval) and `AETHELIOS_BEHAVIOR_EVAL_EXECUTE=1` (actual model answers).
- Cost controls: explicit model, estimated USD, max requests, max output tokens, redacted excerpts, hard stop at budget. Comparison with the previous thin prompt is `AETHELIOS_BEHAVIOR_EVAL_COMPARE=1` and doubles spend.
- A metadata printout is reported as skipped, not as a successful behavior evaluation.
- Do not claim answers improved until executed scores exist.

Official references used while designing this: [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) (2026-10-15) and [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) (2026-10-15). OpenAI is deprecating the hosted Evals platform; this runner stays local.

## Before / after (implemented composition vs unrun live answers)

| Area | Before | After this branch |
| ---- | ------ | ----------------- |
| Prompt version | Drifted copies: docs `.3`, Talk `.talk.1`, eval script `.3` | One `edition.ts` source; Talk `collaborator.1`; Live persistence tag unchanged |
| Expertise | Six shallow keyword playbooks | Seven operational modules with method, tools, quality, failures, done; inspectable scores |
| Selection | Regex on the current utterance plus a short follow-up | Current request, selected artifact, approved direction, recent corrections; still max two; no routing LLM |
| Continuity | History + thread summary only | Derived working state (objective, approved direction, constraints, rejected, corrections, next step) from those same records |
| Character | Warm/direct contract | Same, plus operational vision/craft/research/conversation strengths |
| Eval runner | Printed metadata even when “approved” | Skip / approval-recorded / missing-key / execute with budget hard stop and actual-answer scoring |

Live model answers were **not** generated. Do not claim conversational quality improved until `AETHELIOS_BEHAVIOR_EVAL_EXECUTE=1` is run with founder approval.

## Out of scope

No production merge, hosted SQL, credential rotation, provider switch, fine-tuning, Cedar/VAD/audio changes, or paid evaluation launch.
