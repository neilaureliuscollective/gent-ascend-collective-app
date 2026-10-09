import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import type { Database } from '@/platform/supabase/database';
import type { z } from 'zod';
import { buildCommand } from './build-schema';
import { renderArtifact, checkArtifact } from './artifact';
import { readImage } from './images';
import { briefSchema } from './schema';
export async function listBuilds() {
  const { client, person } = await intelligenceSession();
  const r = await client
    .from('technology_builds')
    .select(
      'id,project_id,version_id,template,status,lease_until,attempts,sha256,checks,created_at,finished_at',
    )
    .eq('person_id', person.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (r.error) throw new IntelligenceError('Verified builds need their database migration.', 503);
  return r.data;
}
export async function mutateBuild(command: z.infer<typeof buildCommand>) {
  const { client, person } = await intelligenceSession();
  if (command.action === 'queue') {
    const r = await client.rpc('technology_build_queue', {
      p_id: command.id,
      p_project: command.projectId,
      p_version: command.versionId,
    });
    if (r.error)
      throw new IntelligenceError(
        'Build refused. Review the current saved version and reload.',
        409,
      );
    return { id: r.data };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new IntelligenceError('Build verification is not configured.', 503);
  const lease = randomUUID();
  const claim = await client.rpc('technology_build_claim', { p_id: command.id, p_lease: lease });
  if (claim.error)
    throw new IntelligenceError('Build is active or needs review. Reload its saved receipt.', 409);
  if (!claim.data) return { id: command.id };
  const b = await client
    .from('technology_builds')
    .select('*')
    .eq('id', command.id)
    .eq('person_id', person.id)
    .single();
  if (b.error) throw new IntelligenceError('Build source unavailable.', 503);
  const v = await client
    .from('technology_site_versions')
    .select('*')
    .eq('id', b.data.version_id)
    .eq('person_id', person.id)
    .single();
  if (
    v.error ||
    v.data.project_id !== b.data.project_id ||
    v.data.template_version !== 'service-business-v1'
  )
    throw new IntelligenceError('Build source unavailable.', 503);
  const brief = briefSchema.parse(v.data.brief);
  const image = brief.image ? await readImage(brief.image.assetId, b.data.project_id) : undefined;
  const html = renderArtifact(brief, image),
    checks = checkArtifact(html),
    sha256 = createHash('sha256').update(html).digest('hex');
  if (!checks.passed)
    throw new IntelligenceError('Artifact checks failed. Saved requirements are preserved.', 422);
  const broker = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const finish = await broker.rpc('technology_build_finish', {
    p_id: command.id,
    p_owner: person.id,
    p_lease: lease,
    p_html: html,
    p_hash: sha256,
    p_checks: checks,
  });
  if (finish.error)
    throw new IntelligenceError('Build completion uncertain. Reload before resuming.', 503);
  return { id: command.id };
}
export async function exportBuild(id: string) {
  const { client, person } = await intelligenceSession();
  const r = await client
    .from('technology_builds')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .single();
  if (r.error || r.data.status !== 'ready' || !r.data.html)
    throw new IntelligenceError('Ready build not found.', 404);
  const b = r.data;
  if (
    createHash('sha256').update(b.html!).digest('hex') !== b.sha256 ||
    !checkArtifact(b.html!).passed
  )
    throw new IntelligenceError('Artifact verification failed.', 409);
  return { html: b.html!, hash: b.sha256! };
}
