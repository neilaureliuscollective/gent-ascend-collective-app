import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { Database } from '@/platform/supabase/database';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { normalizeWebsiteImage, verifiedImageBytes } from './image-normalize';
import { imageCommand, imagePolicy } from './image-schema';
export async function readImages(projectId: string) {
  const { client, person } = await intelligenceSession();
  const project = await client
    .from('technology_projects')
    .select('id')
    .eq('id', projectId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (project.error || !project.data) throw new IntelligenceError('Website not found.', 404);
  const images = await client
    .from('technology_images')
    .select('id,project_id,source_id,source_kind,status,attempts,created_at')
    .eq('project_id', projectId)
    .eq('person_id', person.id)
    .order('created_at', { ascending: false })
    .limit(4);
  const projects = await client
    .from('ai_studio_projects')
    .select('id,title')
    .eq('person_id', person.id)
    .is('company_id', null)
    .order('updated_at', { ascending: false })
    .limit(30);
  if (images.error || projects.error)
    throw new IntelligenceError('Website images need their migration.', 503);
  const ids = projects.data.map((p) => p.id);
  const [refs, versions] = ids.length
    ? await Promise.all([
        client
          .from('ai_studio_references')
          .select('id,project_id')
          .eq('person_id', person.id)
          .in('project_id', ids)
          .order('created_at', { ascending: false })
          .limit(30),
        client
          .from('ai_studio_versions')
          .select('id,project_id')
          .eq('person_id', person.id)
          .eq('status', 'complete')
          .in('project_id', ids)
          .order('created_at', { ascending: false })
          .limit(30),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (refs.error || versions.error)
    throw new IntelligenceError('Studio image choices unavailable.', 503);
  const source = (items: NonNullable<typeof refs.data>, kind: 'reference' | 'version') =>
    items.map((v) => ({
      id: v.id,
      kind,
      label: `${projects.data.find((p) => p.id === v.project_id)?.title} · ${kind} ${v.id.slice(0, 8)}`,
    }));
  return {
    images: images.data,
    sources: [...source(refs.data ?? [], 'reference'), ...source(versions.data ?? [], 'version')],
  };
}
export async function importImage(command: z.infer<typeof imageCommand>) {
  const { client, person } = await intelligenceSession();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new IntelligenceError('Website image processing is not configured.', 503);
  const lease = randomUUID();
  const begin = await client.rpc('technology_image_begin', {
    p_id: command.id,
    p_project: command.projectId,
    p_expected: command.expected,
    p_source: command.sourceId,
    p_kind: command.kind,
    p_lease: lease,
  });
  if (begin.error)
    throw new IntelligenceError(
      'Image refused. Check the source, saved revision, allowance or active import.',
      409,
    );
  if (!begin.data) return { id: command.id };
  const broker = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let normalized: Awaited<ReturnType<typeof normalizeWebsiteImage>>;
  try {
    const downloaded = await client.storage.from('aethelios-studio').download(begin.data);
    if (downloaded.error || !downloaded.data || downloaded.data.size > imagePolicy.inputBytes)
      throw new Error('Image unavailable or too large.');
    normalized = await normalizeWebsiteImage(new Uint8Array(await downloaded.data.arrayBuffer()));
  } catch {
    await broker.rpc('technology_image_finish', {
      p_id: command.id,
      p_owner: person.id,
      p_lease: lease,
      p_data: null,
      p_hash: null,
    });
    throw new IntelligenceError(
      'Image could not be prepared. Choose a valid single-frame PNG, JPEG or WebP; simpler images fit the export budget. Reload the saved import before retrying.',
      422,
    );
  }
  const finish = await broker.rpc('technology_image_finish', {
    p_id: command.id,
    p_owner: person.id,
    p_lease: lease,
    p_data: normalized.dataUrl,
    p_hash: normalized.sha256,
  });
  if (finish.error || !finish.data)
    throw new IntelligenceError(
      'Image completion uncertain. Reload its receipt before resuming.',
      503,
    );
  return { id: command.id };
}
export async function readImage(id: string, projectId?: string) {
  const { client, person } = await intelligenceSession();
  let query = client
    .from('technology_images')
    .select('id,project_id,data_url,sha256')
    .eq('person_id', person.id)
    .eq('id', id)
    .eq('status', 'ready');
  if (projectId) query = query.eq('project_id', projectId);
  const r = await query.maybeSingle();
  if (r.error || !r.data?.data_url || !r.data.sha256)
    throw new IntelligenceError('Website image not found.', 404);
  try {
    return {
      assetId: r.data.id,
      dataUrl: r.data.data_url,
      bytes: verifiedImageBytes(r.data.data_url, r.data.sha256),
    };
  } catch {
    throw new IntelligenceError('Website image verification failed.', 409);
  }
}
