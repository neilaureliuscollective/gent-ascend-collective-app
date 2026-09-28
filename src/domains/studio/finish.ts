import 'server-only';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { studioSession } from './service';

export const finishInput = z.object({
  projectId: z.uuid(), versionId: z.uuid(), updatedAt: z.iso.datetime({ offset: true }).nullable(),
  format: z.enum(['square', 'portrait', 'landscape']),
  treatment: z.enum(['editorial', 'centered', 'quiet']),
  brand: z.string().trim().max(60), headline: z.string().trim().max(120),
  supporting: z.string().trim().max(180), footer: z.string().trim().max(80),
  focalX: z.number().int().min(0).max(100), focalY: z.number().int().min(0).max(100),
}).strict();

export async function saveFinish(input: z.infer<typeof finishInput>) {
  const { client, person } = await studioSession();
  const version = await client.from('ai_studio_versions').select('id').eq('id', input.versionId)
    .eq('project_id', input.projectId).eq('person_id', person.id).eq('status', 'complete').maybeSingle();
  if (version.error || !version.data) throw new IntelligenceError('Choose a completed image from this project.', 422);
  const fields = { format: input.format, treatment: input.treatment, brand: input.brand,
    headline: input.headline, supporting: input.supporting, footer: input.footer,
    focal_x: input.focalX, focal_y: input.focalY };
  if (input.updatedAt) {
    const result = await client.from('ai_studio_finishes').update({ ...fields, updated_at: new Date().toISOString() })
      .eq('person_id', person.id).eq('project_id', input.projectId).eq('version_id', input.versionId)
      .eq('updated_at', input.updatedAt).select('id,updated_at').maybeSingle();
    if (result.error) throw new IntelligenceError('The composition could not be saved.', 503);
    if (!result.data) throw new IntelligenceError('This composition changed elsewhere. Refresh it before saving.', 409);
    return result.data;
  }
  const result = await client.from('ai_studio_finishes').insert({ person_id: person.id, project_id: input.projectId,
    version_id: input.versionId, ...fields }).select('id,updated_at').single();
  if (result.error || !result.data) throw new IntelligenceError('A composition already exists for this image. Refresh to edit it.', 409);
  return result.data;
}
