# Public intelligence team + activation — 2026-10-06

## Inspected evidence and plan
Public main already has five specialist definitions, independent bounded OpenAI calls, Aethelios synthesis, exact cast receipts, per-message context consent, context isolation tests and a Council dialog. Access lives in the conversation drawer and is disabled even for team discovery when the model is unavailable. Company jobs are company-scoped deliverables; they are not general personal missions. Do not relabel or duplicate them.

Private reference inspected at f5570f058d74cd8023a5264f7bd2f9740bc16d81: src/core/team-orchestration.ts, src/server/team-orchestration.ts, src/core/mission-os/index.ts and isolation.ts. Reuse small bounded routing, reasons, explicit synthesis, saved progress and review-required action distinctions. Do not copy founder seeds, notebook, business objects, repository tools, founder-specific roles or private project references.

## Research principles
- OpenAI orchestration: coordinator retains responsibility; specialists are bounded capabilities. https://developers.openai.com/api/docs/guides/agents/orchestration
- Anthropic effective agents: simple composable workflows before autonomy; use delegation only where useful. https://www.anthropic.com/engineering/building-effective-agents
- ChatGPT Projects: continuity needs explicit scope; avoid ambient cross-project context. https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- NN/G progressive disclosure and contextual onboarding: show the useful task before secondary complexity. https://www.nngroup.com/articles/progressive-disclosure/ and https://www.nngroup.com/articles/onboarding-tutorials/
- Supabase RLS: ownership restrictions with both USING and WITH CHECK. https://supabase.com/docs/guides/database/postgres/row-level-security

## Implementation order
1. Make existing Council visible in Talk; discovery remains available independently of model access, execution still respects access/configuration. Add useful role starters and explanations.
2. Refine low-cost deterministic routing: simple facts stay central, pressure-testing maps to Athena, explicit verification prioritizes Themis; at most three suggestions, user reviews cast.
3. Adaptive empty session: one objective, optional constraint, useful first artifact; no questionnaire or auto-memory. Preserve returning conversations.
4. Public Missions: one owner-bound saved conversation per mission, explicit objective/status/decisions/questions/next actions, participants derived from actual saved turn receipts. Research/artifacts stay in existing transcript and Studio. No autonomous runs or fictional execution.
5. Add mission create/resume/update/delete with strict validation, owner-bound foreign keys, RLS, optimistic revisions and recoverable create IDs. Surface in Talk and Ongoing, with links to existing Library/Studio.
6. Test routing, Council calls, mission SQL/RLS and browser flows. Run lint/typecheck/unit/build; separately record real-service and production evidence.

## Action and context boundary
Mission fields are user-reviewed records, never execution approvals. Starting a mission makes no provider request; opening it resumes its existing conversation with personal context off. Only selecting Send or Confirm and assemble submits to the existing provider. No external action executor is introduced. No mission record is automatically promoted to person-wide memory.
