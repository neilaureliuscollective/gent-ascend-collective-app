import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { originReady } from '@/domains/architect-origin/service';
import { calculateEstimator } from './engine';
import {
  estimatorConfigSchema,
  type InvokeToolCommand,
  type SaveToolCommand,
  type SavedEstimatorInvocation,
  type SavedEstimatorTool,
  type SavedEstimatorVersion,
} from './schema';

function requireReady() {
  if (!originReady())
    throw new IntelligenceError(
      'Architect persistence is awaiting its reviewed database migration. Your existing environments remain available.',
      503,
    );
}

function failSave(error: { message?: string } | null) {
  const detail = error?.message ?? '';
  if (/changed/i.test(detail))
    throw new IntelligenceError(
      'This tool changed after you opened it. Reload the saved revision; the unsaved draft is kept.',
      409,
    );
  if (/Replay mismatch/i.test(detail))
    throw new IntelligenceError('The exact save was already recorded. Reload the receipt before editing.', 409);
  if (/unavailable/i.test(detail)) throw new IntelligenceError('Project or tool unavailable.', 404);
  if (/limit/i.test(detail)) throw new IntelligenceError('Tool or invocation limit reached.', 409);
  throw new IntelligenceError(
    'Save was not confirmed. Reload to inspect the receipt; keep your draft.',
    409,
  );
}

export async function readArchitectTools(projectId: string, toolId?: string) {
  const { client, person } = await intelligenceSession();
  requireReady();
  const ownedProject = await client
    .from('architect_origin_projects')
    .select('id')
    .eq('person_id', person.id)
    .eq('id', projectId)
    .maybeSingle();
  if (ownedProject.error) throw new IntelligenceError('Project unavailable.', 503);
  if (!ownedProject.data) throw new IntelligenceError('Project unavailable.', 404);
  const tools = await client
    .from('architect_origin_tools')
    .select('*')
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (tools.error) throw new IntelligenceError('Tool library unavailable. Reload before editing.', 503);
  const selectedId = toolId ?? tools.data?.[0]?.id;
  if (!selectedId) return { tools: [] as SavedEstimatorTool[], versions: [] as SavedEstimatorVersion[], invocations: [] };
  const ownedTool = (tools.data ?? []).some((row) => row.id === selectedId);
  if (toolId && !ownedTool) throw new IntelligenceError('Tool unavailable.', 404);
  const [versions, invocations] = await Promise.all([
    client
      .from('architect_origin_tool_versions')
      .select('*')
      .eq('person_id', person.id)
      .eq('project_id', projectId)
      .eq('tool_id', selectedId)
      .order('revision', { ascending: false })
      .limit(25),
    client
      .from('architect_origin_tool_invocations')
      .select('*')
      .eq('person_id', person.id)
      .eq('tool_id', selectedId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (versions.error || invocations.error)
    throw new IntelligenceError('Tool history unavailable. Reload before editing.', 503);
  return {
    tools: (tools.data ?? []) as SavedEstimatorTool[],
    versions: (versions.data ?? []) as SavedEstimatorVersion[],
    invocations: (invocations.data ?? []) as SavedEstimatorInvocation[],
  };
}

export async function saveArchitectTool(input: SaveToolCommand) {
  const { client, person } = await intelligenceSession();
  requireReady();
  const saved = await client.rpc('architect_origin_tool_save', {
    p_tool: input.toolId,
    p_project: input.projectId,
    p_request: input.requestId,
    p_expected: input.expected,
    p_name: input.name,
    p_config: input.configuration,
    p_note: input.note,
  });
  if (saved.error || saved.data == null) failSave(saved.error);
  return { revision: saved.data as number, requestId: input.requestId, personId: person.id, toolId: input.toolId };
}

export async function invokeArchitectTool(input: InvokeToolCommand) {
  const { client, person } = await intelligenceSession();
  requireReady();
  const version = await client
    .from('architect_origin_tool_versions')
    .select('*')
    .eq('person_id', person.id)
    .eq('project_id', input.projectId)
    .eq('tool_id', input.toolId)
    .eq('revision', input.revision)
    .maybeSingle();
  if (version.error) throw new IntelligenceError('Saved tool revision unavailable.', 503);
  if (!version.data) throw new IntelligenceError('Saved tool revision unavailable.', 404);
  const configuration = estimatorConfigSchema.parse(version.data.configuration);
  const result = calculateEstimator(configuration, input.quantities);
  const recorded = await client.rpc('architect_origin_tool_record_invocation', {
    p_id: input.requestId,
    p_tool: input.toolId,
    p_revision: input.revision,
    p_inputs: { quantities: input.quantities, source: input.source },
    p_result: result,
    p_source: input.source,
  });
  if (recorded.error || !recorded.data) failSave(recorded.error);
  return {
    toolId: input.toolId,
    projectId: input.projectId,
    revision: input.revision,
    name: version.data.name as string,
    configuration,
    inputs: { quantities: input.quantities },
    assumptions: result.assumptions,
    result,
    provenance: {
      source: input.source,
      requestId: input.requestId,
      personId: person.id,
      recorded: true,
    },
  };
}
