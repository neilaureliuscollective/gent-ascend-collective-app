/** Receiving contract for conversational use. Talk #121 does not implement this adapter. */
export const architectToolInvokeContract = {
  id: 'architect.quantity_cost_estimator.invoke',
  version: '2026-10-14.1',
  path: '/api/architect-tools',
  method: 'POST',
  authorization: 'Authenticated session cookie. Owner, project and permission come from the server session, never from a browser-supplied owner ID or a model claim.',
  input: {
    action: 'invoke',
    projectId: 'uuid of an owned Origin project',
    toolId: 'uuid of an owned estimator tool',
    revision: 'positive integer of the exact saved revision',
    requestId: 'uuid used for idempotent provenance',
    quantities: 'optional map of item UUID to explicit quantity overrides',
    source: 'architect | agent-fixture',
  },
  output: {
    toolId: 'string',
    projectId: 'string',
    revision: 'number',
    name: 'string',
    configuration: 'validated saved estimator configuration',
    inputs: 'echoed quantity overrides',
    assumptions: 'string[] including waste/markup rules',
    result: 'structured decimal totals',
    provenance: { source: 'string', requestId: 'string', personId: 'string', recorded: 'boolean' },
  },
  refusals: [
    'Unauthenticated session',
    'Foreign project or tool',
    'Unknown or unavailable revision',
    'Malformed or missing quantities',
    'Draft-only identity (unsaved tools cannot be invoked)',
    'Unsupported action or tool kind',
  ],
  talk: 'Talk must not claim it can operate this tool until a reviewed adapter posts this exact contract and the same Auth/PostgREST tests pass from the Talk surface. Architect uses the contract directly.',
} as const;

export function fixtureAgentInvoke(input: {
  authorized: boolean;
  projectId: string;
  toolId: string;
  revision: number;
  quantities?: Record<string, string>;
}) {
  if (!input.authorized) {
    return {
      ok: false as const,
      error: 'Agent fixture refused a foreign or unauthenticated scope. No calculation ran.',
    };
  }
  return {
    ok: true as const,
    command: {
      action: 'invoke' as const,
      projectId: input.projectId,
      toolId: input.toolId,
      revision: input.revision,
      requestId: '00000000-0000-4000-8000-000000000201',
      quantities: input.quantities ?? {},
      source: 'agent-fixture' as const,
    },
  };
}
