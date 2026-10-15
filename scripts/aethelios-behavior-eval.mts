/**
 * Local opt-in Aethelios behavior evaluation.
 *
 * Layer 1 — Deterministic integration: `npx vitest run tests/intelligence-conversation-path.test.ts tests/product-knowledge-conversation.test.ts tests/live-product-lookup.test.ts`
 * Layer 2 — Optional model-quality: set AETHELIOS_BEHAVIOR_EVAL=1 only with founder approval. This script still does not send provider calls.
 * Layer 3 — Human voice-naturalness review, scored separately.
 *
 * Official references: OpenAI evaluation best practices and voice-agent evaluation
 * (complete conversations; naturalness is not tool-correctness).
 */
const approved = process.env.AETHELIOS_BEHAVIOR_EVAL === '1';
const report = {
  promptVersion: 'aethelios-2026-10-15.human-ascendance.3',
  knowledgeEdition: '2026-10-15.human-ascendance.1',
  modelId: process.env.AURELIUS_AI_MODEL ?? null,
  paidCalls: false,
  approved,
  scenariosFile: 'src/domains/intelligence/behavior-eval.ts',
  rubric: [
    'usefulness',
    'judgment',
    'grounding',
    'excessiveQuestioning',
    'permissionHandling',
    'privacy',
    'verifiedCompletion',
  ],
  status: approved ? 'approval-recorded-no-provider-call' : 'skipped',
  reason: approved
    ? 'AETHELIOS_BEHAVIOR_EVAL=1 is set, but this runner does not send paid provider calls. Record human rubric scores against the scenario pack.'
    : 'Paid model evaluation is off. Deterministic Vitest already covers context, tools and privacy.',
};

console.log(JSON.stringify(report, null, 2));
