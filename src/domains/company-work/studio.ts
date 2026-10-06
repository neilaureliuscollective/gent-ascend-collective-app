import 'server-only';
import { z } from 'zod';
import { readWork } from './service';
import { generateStudio, studioSession, imageBlob } from '@/domains/studio/service';
import { IntelligenceError } from '@/domains/intelligence/service';
export const workVisualInput = z
  .object({
    companyId: z.uuid(),
    jobId: z.uuid(),
    requestId: z.uuid(),
    prompt: z.string().trim().min(3).max(3000),
    mode: z.enum(['fast', 'precise']),
    approved: z.literal(true),
  })
  .strict();
export async function createWorkVisual(input: z.infer<typeof workVisualInput>) {
  const work = await readWork(input.companyId, input.jobId);
  const { client, person } = await studioSession();
  let projectId = work.projectId;
  if (!projectId) {
    const result = await client
      .from('ai_studio_projects')
      .insert({
        id: crypto.randomUUID(),
        person_id: person.id,
        company_id: input.companyId,
        job_id: input.jobId,
        title: work.job.company_name.slice(0, 80),
        creative_type: 'brand',
      })
      .select('id')
      .single();
    if (result.error || !result.data) {
      const refreshed = await readWork(input.companyId, input.jobId);
      if (!refreshed.projectId)
        throw new IntelligenceError('Visual project could not be saved.', 503);
      projectId = refreshed.projectId;
    } else projectId = result.data.id;
  }
  const previous = await client
    .from('ai_studio_versions')
    .select('id,status,prompt,model')
    .eq('id', input.requestId)
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (previous.error) throw new IntelligenceError('Visual receipt unavailable.', 503);
  if (previous.data) {
    const model = input.mode === 'fast' ? 'gpt-image-2.5-flare' : 'gpt-image-2.5-sunburst';
    if (previous.data.prompt !== input.prompt || previous.data.model !== model)
      throw new IntelligenceError('Visual request changed.', 409);
    if (previous.data.status === 'complete') return readWork(input.companyId, input.jobId);
    throw new IntelligenceError(
      'This visual request is pending or failed. Reload its receipt; a new generation needs a new approval.',
      409,
    );
  }
  await generateStudio(
    {
      id: input.requestId,
      projectId,
      parentId: null,
      referenceId: null,
      prompt: input.prompt,
      mode: input.mode,
      size: '1536x1024',
    },
    input.companyId,
  );
  return readWork(input.companyId, input.jobId);
}
export async function workVisualBlob(companyId: string, jobId: string, assetId: string) {
  const work = await readWork(companyId, jobId);
  if (!work.assets.some((asset) => asset.id === assetId && asset.status === 'complete'))
    throw new IntelligenceError('Company visual not found.', 404);
  return imageBlob(assetId, 'version', companyId);
}
