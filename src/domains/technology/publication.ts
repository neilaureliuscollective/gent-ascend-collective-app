import 'server-only';
import { z } from 'zod';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { exportBuild } from './build-service';
export const publicationManifestSchema = z
  .object({
    contract: z.literal('website-publication-review-v1'),
    ownerId: z.uuid(),
    projectId: z.uuid(),
    versionId: z.uuid(),
    revision: z.number().int().positive(),
    buildId: z.uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    target: z.literal('unconfigured'),
    domain: z.null(),
    budgetMicros: z.literal(0),
    publishEnabled: z.literal(false),
    approval: z.literal('required'),
    requiredGates: z
      .array(
        z.enum([
          'isolated-hosted-acceptance',
          'domain-ownership',
          'hosting-budget',
          'founder-release-decision',
        ]),
      )
      .length(4),
  })
  .strict();
export async function preparePublication(id: string) {
  const { client, person } = await intelligenceSession();
  const b = await client
    .from('technology_builds')
    .select('id,project_id,version_id,status')
    .eq('person_id', person.id)
    .eq('id', id)
    .eq('status', 'ready')
    .maybeSingle();
  if (b.error || !b.data) throw new IntelligenceError('Ready website build not found.', 404);
  const v = await client
    .from('technology_site_versions')
    .select('id,revision,reviewed_at')
    .eq('id', b.data.version_id)
    .eq('project_id', b.data.project_id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (v.error || !v.data?.reviewed_at)
    throw new IntelligenceError('Reviewed build source unavailable.', 409);
  const artifact = await exportBuild(id);
  return publicationManifestSchema.parse({
    contract: 'website-publication-review-v1',
    ownerId: person.id,
    projectId: b.data.project_id,
    versionId: b.data.version_id,
    revision: v.data.revision,
    buildId: id,
    sha256: artifact.hash,
    target: 'unconfigured',
    domain: null,
    budgetMicros: 0,
    publishEnabled: false,
    approval: 'required',
    requiredGates: [
      'isolated-hosted-acceptance',
      'domain-ownership',
      'hosting-budget',
      'founder-release-decision',
    ],
  });
}
