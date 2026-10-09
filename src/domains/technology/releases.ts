import 'server-only';
import type { z } from 'zod';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { exportBuild } from './build-service';
import { preparePublication } from './publication';
import { releaseCommand } from './release-schema';
import { createReleasePackage } from './release-package';
export async function readReleases(buildId: string) {
  const { client, person } = await intelligenceSession();
  const build = await client
    .from('technology_builds')
    .select('id')
    .eq('id', buildId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (build.error || !build.data) throw new IntelligenceError('Website build not found.', 404);
  const r = await client
    .from('technology_releases')
    .select('*')
    .eq('person_id', person.id)
    .eq('build_id', buildId)
    .limit(1);
  if (r.error) throw new IntelligenceError('Release preparation needs its migration.', 503);
  return r.data;
}
export async function mutateRelease(command: z.infer<typeof releaseCommand>) {
  const { client } = await intelligenceSession();
  if (command.action === 'revoke') {
    const r = await client.rpc('technology_release_revoke', { p_id: command.id });
    if (r.error) throw new IntelligenceError('Release unavailable. Reload its receipt.', 409);
    return { id: command.id };
  }
  const manifest = await preparePublication(command.buildId);
  if (manifest.sha256 !== command.sha256)
    throw new IntelligenceError('Build changed. Review it again.', 409);
  const r = await client.rpc('technology_release_approve', {
    p_id: command.id,
    p_build: command.buildId,
    p_hash: command.sha256,
    p_consent: command.consent,
  });
  if (r.error)
    throw new IntelligenceError(
      'Release refused. Review the current build or reload its receipt.',
      409,
    );
  return { id: r.data };
}
export async function downloadRelease(id: string) {
  const { client, person } = await intelligenceSession();
  const r = await client
    .from('technology_releases')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (r.error || !r.data) throw new IntelligenceError('Release not found.', 404);
  if (r.data.revoked_at) throw new IntelligenceError('Release approval revoked.', 409);
  const manifest = await preparePublication(r.data.build_id);
  if (
    manifest.projectId !== r.data.project_id ||
    manifest.versionId !== r.data.version_id ||
    manifest.revision !== r.data.revision ||
    manifest.sha256 !== r.data.sha256
  )
    throw new IntelligenceError('Release source changed.', 409);
  const artifact = await exportBuild(r.data.build_id);
  // Recheck after artifact reads; concurrent revocation cannot be made atomic with delivery.
  const current = await client
    .from('technology_releases')
    .select('revoked_at')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (current.error || !current.data || current.data.revoked_at)
    throw new IntelligenceError('Release approval unavailable.', 409);
  try {
    return createReleasePackage(r.data, artifact.html);
  } catch {
    throw new IntelligenceError('Release artifact verification failed.', 409);
  }
}
