import 'server-only';
import { createHash } from 'node:crypto';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { architectModel } from './schema';
import { generateWebsite } from './model';
import { parseProject, type WebProject } from './project';
export async function architectSession() {
  const session = await intelligenceSession();
  if (process.env.ARCHITECT_STORAGE_ENABLED !== 'true')
    throw new IntelligenceError(
      'Architect cloud storage is not enabled. Your local workshop and exports still work.',
      503,
    );
  return session;
}
function dbError(code?: string): never {
  throw new IntelligenceError(
    code === '40001'
      ? 'This project changed. Reload before saving.'
      : code === '23505'
        ? 'This request is already reserved. Inspect the job receipt before retrying.'
        : code === 'P0001'
          ? 'The current execution limit has been reached.'
          : code === '42501'
            ? 'This project or execution permission is unavailable.'
            : 'Architect storage could not confirm the operation. Reload before retrying.',
    code === 'P0001'
      ? 429
      : code === '42501'
        ? 403
        : code === '40001' || code === '23505'
          ? 409
          : 503,
  );
}
export async function listProjects() {
  const { client, person } = await architectSession();
  const [projects, allowance, jobs] = await Promise.all([
    client
      .from('architect_projects')
      .select('*')
      .eq('person_id', person.id)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(20),
    client.from('architect_allowances').select('*').eq('person_id', person.id).maybeSingle(),
    client
      .from('architect_jobs')
      .select('*')
      .eq('person_id', person.id)
      .gte('created_at', new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z')
      .order('created_at', { ascending: false })
      .limit(60),
  ]);
  if (projects.error || allowance.error || jobs.error) dbError();
  const grant =
    allowance.data && new Date(allowance.data.expires_at).getTime() > Date.now()
      ? allowance.data
      : null;
  return {
    projects: projects.data,
    jobs: jobs.data,
    executionEnabled: !!architectModel(process.env) && !!grant,
    monthlyLimit: grant?.monthly_jobs ?? 0,
    used: jobs.data.length,
  };
}
export async function readProject(id: string) {
  const { client, person } = await architectSession();
  const [project, versions] = await Promise.all([
    client
      .from('architect_projects')
      .select('*')
      .eq('id', id)
      .eq('person_id', person.id)
      .eq('archived', false)
      .maybeSingle(),
    client
      .from('architect_versions')
      .select('*')
      .eq('project_id', id)
      .eq('person_id', person.id)
      .order('revision', { ascending: false })
      .limit(10),
  ]);
  if (project.error || versions.error) dbError();
  if (!project.data || !versions.data.length)
    throw new IntelligenceError('Project not found.', 404);
  return { project: project.data, versions: versions.data };
}
export async function saveProject(
  projectId: string,
  versionId: string,
  expected: number,
  content: WebProject,
) {
  const { client } = await architectSession();
  if (Buffer.byteLength(JSON.stringify(content), 'utf8') > 180000)
    throw new IntelligenceError(
      'Cloud source exceeds the 180 KB JSON limit. Reduce it before saving.',
      413,
    );
  const saved = await client.rpc('architect_save', {
    p_project: projectId,
    p_version: versionId,
    p_expected: expected,
    p_content: content,
  });
  if (saved.error) dbError(saved.error.code);
  return { revision: saved.data };
}
export async function deleteProject(projectId: string) {
  const { client } = await architectSession();
  const result = await client.rpc('architect_delete', { p_project: projectId });
  if (result.error) dbError(result.error.code);
  return { deleted: true };
}
export async function generateProject(
  input: { projectId: string; requestId: string; expected: number; instruction: string },
  signal: AbortSignal,
) {
  const { client } = await architectSession();
  const model = architectModel(process.env);
  if (!model)
    throw new IntelligenceError('Architect AI execution is not configured and approved.', 503);
  const work = await readProject(input.projectId);
  if (work.project.revision !== input.expected)
    throw new IntelligenceError('Project changed. Reload before generation.', 409);
  const source = parseProject(work.versions[0]!.content);
  if (Buffer.byteLength(JSON.stringify({ source, instruction: input.instruction }), 'utf8') > 16000)
    throw new IntelligenceError(
      'This job exceeds the 16 KB model-input limit. Reduce the project source or request.',
      413,
    );
  const reserved = await client.rpc('architect_reserve', {
    p_id: input.requestId,
    p_project: input.projectId,
    p_expected: input.expected,
    p_hash: createHash('sha256')
      .update(JSON.stringify({ source, instruction: input.instruction }))
      .digest('hex'),
    p_model: model,
  });
  if (reserved.error) dbError(reserved.error.code);
  try {
    const draft = await generateWebsite(model, source, input.instruction, signal);
    const finished = await client.rpc('architect_finish', {
      p_id: input.requestId,
      p_output: draft,
    });
    if (finished.error) dbError(finished.error.code);
    return { draft, requestId: input.requestId };
  } catch {
    try {
      await client.rpc('architect_finish', { p_id: input.requestId, p_output: null });
    } catch {
      /* Reservation remains counted. */
    }
    throw new IntelligenceError(
      'Generation or its receipt could not be confirmed. Inspect cloud job history before retrying; the reservation remains counted. No project version was changed.',
      503,
    );
  }
}
