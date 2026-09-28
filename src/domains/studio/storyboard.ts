import 'server-only';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { studioSession } from './service';

const fields = z.object({
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().max(300),
  visualDirection: z.string().trim().max(700),
  motionNote: z.string().trim().max(300),
  channel: z.enum(['social', 'website', 'pitch', 'print']),
}).strict();
export const createSceneInput = fields.extend({ projectId: z.uuid() }).strict();
export const updateSceneInput = fields.extend({ projectId: z.uuid(), sceneId: z.uuid(), updatedAt: z.iso.datetime({ offset: true }), assetVersionId: z.uuid().nullable() }).strict();
export const deleteSceneInput = z.object({ projectId: z.uuid(), sceneId: z.uuid() }).strict();

export async function createScene(input: z.infer<typeof createSceneInput>) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_scene_create', {
    p_project: input.projectId, p_title: input.title, p_message: input.message,
    p_visual: input.visualDirection, p_motion: input.motionNote, p_channel: input.channel,
  });
  if (result.error || !result.data) throw new IntelligenceError('Scene could not be added. The project may already have eight scenes.', 409);
  return { id: result.data };
}
export async function updateScene(input: z.infer<typeof updateSceneInput>) {
  const { client, person } = await studioSession();
  if (input.assetVersionId) {
    const asset = await client.from('ai_studio_versions').select('id').eq('id', input.assetVersionId)
      .eq('project_id', input.projectId).eq('person_id', person.id).eq('status', 'complete').maybeSingle();
    if (asset.error || !asset.data) throw new IntelligenceError('Choose a completed image from this project.', 422);
  }
  const result = await client.from('ai_studio_scenes').update({
    title: input.title, message: input.message, visual_direction: input.visualDirection,
    motion_note: input.motionNote, channel: input.channel, asset_version_id: input.assetVersionId,
    updated_at: new Date().toISOString(),
  }).eq('id', input.sceneId).eq('project_id', input.projectId).eq('person_id', person.id)
    .eq('updated_at', input.updatedAt).select('id').maybeSingle();
  if (result.error) throw new IntelligenceError('Scene could not be saved.', 503);
  if (!result.data) throw new IntelligenceError('This scene changed elsewhere. Refresh before saving.', 409);
  return { id: result.data.id };
}
export async function deleteScene(input: z.infer<typeof deleteSceneInput>) {
  const { client, person } = await studioSession();
  const result = await client.from('ai_studio_scenes').delete().eq('id', input.sceneId)
    .eq('project_id', input.projectId).eq('person_id', person.id).select('id').maybeSingle();
  if (result.error) throw new IntelligenceError('Scene could not be removed.', 503);
  if (!result.data) throw new IntelligenceError('Scene not found.', 404);
  return { id: result.data.id };
}
