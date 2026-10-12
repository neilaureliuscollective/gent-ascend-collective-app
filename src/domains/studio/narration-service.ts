import 'server-only';
import { studioSession, verifyStudioProject } from './service';
import { currentAccess } from '@/domains/access/current';
import { IntelligenceError } from '@/domains/intelligence/service';
import { narrationWave, type NarrationInput } from './narration';
import { renderNarration } from '@/platform/openai/narration';
const bucket = 'aethelios-studio-audio';
export async function narrationWorkspace(projectId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const result = await client
    .from('ai_studio_narrations')
    .select('id,title,script,voice,tone,model,status,duration,created_at')
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (result.error) {
    if (['42P01', 'PGRST205'].includes(result.error.code))
      return { available: false, enabled: false, canCreate: false, items: [] };
    throw new IntelligenceError('Saved narrations could not be loaded.', 503);
  }
  return {
    available: true,
    enabled: process.env.STUDIO_NARRATION_ENABLED === 'true' && Boolean(process.env.OPENAI_API_KEY),
    canCreate: (await currentAccess()).has('studio.create'),
    items: result.data ?? [],
  };
}
export async function generateNarration(input: NarrationInput) {
  await verifyStudioProject(input.projectId);
  const { client, person } = await studioSession();
  if (!(await currentAccess()).has('studio.create'))
    throw new IntelligenceError('Narration creation requires eligible Studio access.', 403);
  if (process.env.STUDIO_NARRATION_ENABLED !== 'true' || !process.env.OPENAI_API_KEY)
    throw new IntelligenceError(
      'Narration generation is not enabled yet. Your script is preserved.',
      503,
    );
  const authId = (await client.auth.getUser()).data.user?.id;
  if (!authId) throw new IntelligenceError('Session expired.', 401);
  const started = await client.rpc('ai_studio_narration_begin', {
    p_id: input.id,
    p_project: input.projectId,
    p_title: input.title,
    p_script: input.script,
    p_voice: input.voice,
    p_tone: input.tone,
  });
  if (started.error)
    throw new IntelligenceError(
      'Narration allowance or project could not be verified.',
      started.error.code === 'P0001' ? 429 : 503,
    );
  if (!started.data)
    throw new IntelligenceError(
      'This request was already submitted. Refresh the project; do not generate it again.',
      409,
    );
  const key = `${authId}/${input.projectId}/${input.id}.wav`;
  let uploadAttempted = false;
  try {
    const audio = await renderNarration(input);
    uploadAttempted = true;
    const saved = await client.storage.from(bucket).upload(key, audio.bytes, {
      contentType: 'audio/wav',
      upsert: false,
      cacheControl: 'private, no-store',
    });
    if (saved.error)
      throw new IntelligenceError(
        'The narration upload could not be confirmed. Refresh before another request.',
        503,
      );
    const complete = await client.rpc('ai_studio_narration_finish', {
      p_id: input.id,
      p_status: 'complete',
      p_key: key,
      p_duration: audio.duration,
    });
    if (complete.error || !complete.data)
      throw new IntelligenceError('Narration save acknowledgement was lost.', 409);
    return { id: input.id };
  } catch (error) {
    if (uploadAttempted) {
      const receipt = await client
        .from('ai_studio_narrations')
        .select('status,storage_key')
        .eq('id', input.id)
        .eq('person_id', person.id)
        .eq('project_id', input.projectId)
        .maybeSingle();
      if (!receipt.error && receipt.data?.status === 'complete' && receipt.data.storage_key === key)
        return { id: input.id };
      throw new IntelligenceError(
        'The narration save could not be confirmed. Refresh and recover this saved request before generating again.',
        409,
      );
    }
    await client.rpc('ai_studio_narration_finish', { p_id: input.id, p_status: 'failed' });
    throw error;
  }
}
export async function narrationBlob(id: string) {
  const { client, person } = await studioSession();
  const item = await client
    .from('ai_studio_narrations')
    .select('project_id,status,storage_key')
    .eq('id', id)
    .eq('person_id', person.id)
    .eq('status', 'complete')
    .maybeSingle();
  if (item.error || !item.data?.storage_key)
    throw new IntelligenceError('Narration not found.', 404);
  await verifyStudioProject(item.data.project_id);
  const authId = (await client.auth.getUser()).data.user?.id;
  if (!authId || item.data.storage_key !== `${authId}/${item.data.project_id}/${id}.wav`)
    throw new IntelligenceError('Narration not found.', 404);
  const audio = await client.storage.from(bucket).download(item.data.storage_key);
  if (audio.error || !audio.data)
    throw new IntelligenceError('This saved narration is unavailable.', 503);
  return audio.data;
}
export async function recoverNarration(id: string, projectId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const item = await client
    .from('ai_studio_narrations')
    .select('*')
    .eq('id', id)
    .eq('project_id', projectId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (item.error || !item.data) throw new IntelligenceError('Narration not found.', 404);
  if (item.data.status !== 'pending') return { id };
  if (Date.now() - Date.parse(item.data.created_at) < 600000)
    throw new IntelligenceError(
      'This request may still be saving. Wait ten minutes from submission before recovery.',
      409,
    );
  const authId = (await client.auth.getUser()).data.user?.id;
  if (!authId) throw new IntelligenceError('Session expired.', 401);
  const key = `${authId}/${projectId}/${id}.wav`;
  const download = await client.storage.from(bucket).download(key);
  if (download.error || !download.data) {
    if (String((download.error as { statusCode?: string } | null)?.statusCode) !== '404')
      throw new IntelligenceError(
        'Recovery could not verify the saved file. Nothing was changed.',
        503,
      );
    const failed = await client.rpc('ai_studio_narration_finish', { p_id: id, p_status: 'failed' });
    if (failed.error || !failed.data)
      throw new IntelligenceError(
        'Recovery save could not be confirmed. Refresh this project.',
        409,
      );
    return { id };
  }
  let duration: number;
  try {
    duration = narrationWave(new Uint8Array(await download.data.arrayBuffer())).duration;
  } catch {
    throw new IntelligenceError('The saved audio could not be verified. Nothing was changed.', 503);
  }
  const saved = await client.rpc('ai_studio_narration_finish', {
    p_id: id,
    p_status: 'complete',
    p_key: key,
    p_duration: duration,
  });
  if (saved.error || !saved.data)
    throw new IntelligenceError('Recovery save could not be confirmed. Refresh this project.', 409);
  return { id };
}
