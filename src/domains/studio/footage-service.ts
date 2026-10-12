import 'server-only';
import { randomUUID } from 'node:crypto';
import { studioSession, verifyStudioProject } from './service';
import { currentAccess } from '@/domains/access/current';
import { IntelligenceError } from '@/domains/intelligence/service';
import { footageItem, footagePolicy, type FootageBrief, type FootageJob } from './footage';
import { footageMp4 } from './footage-media';
import {
  footageConfigured,
  quoteSignature,
  taskSignature,
  validSignature,
} from '@/platform/runway/receipts';
import { submitFootage, inspectFootage, downloadFootage } from '@/platform/runway/footage';
const bucket = 'aethelios-studio-video';
async function owned(id: string, projectId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const result = await client
    .from('ai_studio_footage')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (result.error || !result.data) throw new IntelligenceError('Footage request not found.', 404);
  return { client, person, job: result.data as FootageJob };
}
function verified(job: FootageJob, provider = false) {
  if (
    !validSignature(job.quote_signature, quoteSignature(job)) ||
    (provider &&
      (!job.provider_id ||
        !validSignature(job.provider_signature, taskSignature(job, job.provider_id))))
  )
    throw new IntelligenceError(
      'This footage receipt could not be verified. Contact support; do not submit it again.',
      409,
    );
}
async function creationAccess() {
  if (!(await currentAccess()).has('studio.create'))
    throw new IntelligenceError('Footage creation requires eligible Studio access.', 403);
  if (!footageConfigured())
    throw new IntelligenceError('AI footage is awaiting verified activation.', 503);
}
export async function footageWorkspace(projectId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const result = await client
    .from('ai_studio_footage')
    .select('*')
    .eq('person_id', person.id)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (result.error) {
    if (['42P01', 'PGRST205'].includes(result.error.code))
      return { available: false, enabled: false, canCreate: false, items: [] };
    throw new IntelligenceError('Saved footage could not be loaded.', 503);
  }
  return {
    available: true,
    enabled: footageConfigured(),
    canCreate: (await currentAccess()).has('studio.create'),
    items: (result.data as FootageJob[]).map(footageItem),
  };
}
export async function quoteFootage(input: FootageBrief) {
  await verifyStudioProject(input.projectId);
  await creationAccess();
  const { client, person } = await studioSession();
  const quote = {
    id: randomUUID(),
    person_id: person.id,
    project_id: input.projectId,
    title: input.title,
    prompt: input.prompt,
    duration: input.duration,
    ratio: input.ratio,
    estimate: input.duration * 12,
    policy: footagePolicy,
    expires_at: new Date(Date.now() + 600000).toISOString(),
  };
  const result = await client.rpc('ai_studio_footage_quote', {
    p_id: quote.id,
    p_project: quote.project_id,
    p_title: quote.title,
    p_prompt: quote.prompt,
    p_duration: quote.duration,
    p_ratio: quote.ratio,
    p_expires: quote.expires_at,
    p_signature: quoteSignature(quote),
  });
  if (result.error || !result.data)
    throw new IntelligenceError('The reviewed footage estimate could not be saved.', 503);
  return footageItem((await owned(quote.id, input.projectId)).job);
}
export async function startFootage(id: string, projectId: string, approvedEstimate: number) {
  const { client, job } = await owned(id, projectId);
  await creationAccess();
  verified(job);
  if (job.status !== 'quoted') return footageItem(job); // Retries read receipt, never submit again.
  if (job.estimate !== approvedEstimate || Date.parse(job.expires_at) <= Date.now())
    throw new IntelligenceError('This estimate changed or expired. Review a new quote.', 409);
  const claimed = await client.rpc('ai_studio_footage_begin', { p_id: id });
  if (claimed.error)
    throw new IntelligenceError(
      'Footage allowance or pending request could not be verified.',
      claimed.error.code === 'P0001' ? 429 : 503,
    );
  if (!claimed.data)
    throw new IntelligenceError('This request was already submitted. Refresh saved footage.', 409);
  let accepted: Awaited<ReturnType<typeof submitFootage>>;
  try {
    accepted = await submitFootage(job);
  } catch {
    await client.rpc('ai_studio_footage_receipt', { p_id: id });
    throw new IntelligenceError(
      'Submission could not be confirmed. Your allowance is reserved. Do not generate again; this request needs reconciliation.',
      409,
    );
  }
  // Preserve a known provider ID even when the acknowledgement is lost; one identical receipt retry is safe.
  const receipt = {
    p_id: id,
    p_provider: accepted.id,
    p_signature: taskSignature(job, accepted.id),
  };
  let saved = await client.rpc('ai_studio_footage_receipt', receipt);
  if (saved.error || !saved.data) saved = await client.rpc('ai_studio_footage_receipt', receipt);
  const current = (await owned(id, projectId)).job;
  if (
    current.provider_id !== accepted.id ||
    !validSignature(current.provider_signature, receipt.p_signature)
  )
    throw new IntelligenceError(
      'Provider receipt saving could not be confirmed. Do not generate again; contact support.',
      409,
    );
  return footageItem(current);
}
export async function checkFootage(id: string, projectId: string) {
  const { client, job } = await owned(id, projectId);
  if (job.status === 'complete' || job.status === 'failed' || job.status === 'quoted')
    return footageItem(job);
  if (!job.provider_id)
    throw new IntelligenceError(
      'This submission has no confirmed provider receipt. Contact support for reconciliation; it will not be retried.',
      409,
    );
  verified(job, true);
  const lease = await client.rpc('ai_studio_footage_check', { p_id: id });
  if (lease.error || !lease.data)
    throw new IntelligenceError(
      'A status check is already in progress. Wait briefly and refresh.',
      409,
    );
  const task = await inspectFootage(job.provider_id);
  const credits = task.cost?.credits ?? task.estimatedCost?.credits ?? null;
  if (task.status === 'FAILED' || task.status === 'CANCELLED') {
    const saved = await client.rpc('ai_studio_footage_finish', {
      p_id: id,
      p_status: 'failed',
      p_credits: credits,
    });
    if (saved.error || !saved.data)
      throw new IntelligenceError(
        'The terminal receipt could not be saved. Check status again.',
        409,
      );
  } else if (task.status !== 'SUCCEEDED') {
    await client.rpc('ai_studio_footage_finish', {
      p_id: id,
      p_status: 'queued',
      p_credits: credits,
    });
  } else {
    const authId = (await client.auth.getUser()).data.user?.id;
    if (!authId) throw new IntelligenceError('Session expired.', 401);
    const key = `${authId}/${projectId}/${id}.mp4`;
    const existing = await client.storage.from(bucket).download(key);
    let bytes: Uint8Array;
    if (existing.data && !existing.error) bytes = new Uint8Array(await existing.data.arrayBuffer());
    else {
      if (String((existing.error as { statusCode?: string } | null)?.statusCode) !== '404')
        throw new IntelligenceError(
          'The saved clip could not be checked. Nothing was replaced.',
          503,
        );
      if (!task.output?.[0])
        throw new IntelligenceError('The provider has not returned a clip yet.', 502);
      bytes = await downloadFootage(task.output[0]);
      footageMp4(bytes, job.duration, job.ratio);
      const upload = await client.storage
        .from(bucket)
        .upload(key, bytes, {
          contentType: 'video/mp4',
          upsert: false,
          cacheControl: 'private, no-store',
        });
      if (upload.error)
        throw new IntelligenceError(
          'Clip save could not be confirmed. Check status again to recover; no new render is needed.',
          409,
        );
    }
    footageMp4(bytes, job.duration, job.ratio);
    const saved = await client.rpc('ai_studio_footage_finish', {
      p_id: id,
      p_status: 'complete',
      p_key: key,
      p_credits: credits,
    });
    if (saved.error || !saved.data)
      throw new IntelligenceError(
        'Clip acknowledgement could not be confirmed. Check status again to recover.',
        409,
      );
  }
  return footageItem((await owned(id, projectId)).job);
}
export async function footageBlob(id: string) {
  const { client, person } = await studioSession();
  const item = await client
    .from('ai_studio_footage')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .eq('status', 'complete')
    .maybeSingle();
  if (item.error || !item.data) throw new IntelligenceError('Saved footage not found.', 404);
  const job = item.data as FootageJob;
  await verifyStudioProject(job.project_id);
  const authId = (await client.auth.getUser()).data.user?.id;
  if (!authId || job.storage_key !== `${authId}/${job.project_id}/${id}.mp4`)
    throw new IntelligenceError('Saved footage not found.', 404);
  const file = await client.storage.from(bucket).download(job.storage_key);
  if (file.error || !file.data || file.data.size > 30000000)
    throw new IntelligenceError('Saved footage is unavailable.', 503);
  return file.data;
}
