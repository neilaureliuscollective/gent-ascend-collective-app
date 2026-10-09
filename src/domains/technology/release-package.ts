import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { z } from 'zod';
import { checkArtifact } from './artifact';
import type { WebsiteRelease } from './release-schema';
export const releaseManifestSchema = z
  .object({
    contract: z.literal('website-release-package-v1'),
    releaseId: z.uuid(),
    projectId: z.uuid(),
    versionId: z.uuid(),
    buildId: z.uuid(),
    revision: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    approvedAt: z.iso.datetime({ offset: true }),
    entrypoint: z.literal('index.html'),
    publishEnabled: z.literal(false),
    target: z.literal('unconfigured'),
    budgetMicros: z.literal(0),
  })
  .strict();
export function createReleasePackage(release: WebsiteRelease, html: string) {
  if (
    release.revoked_at ||
    Buffer.byteLength(html) > 250000 ||
    !checkArtifact(html).passed ||
    createHash('sha256').update(html).digest('hex') !== release.sha256
  )
    throw new Error('Release artifact verification failed.');
  const manifest = releaseManifestSchema.parse({
    contract: 'website-release-package-v1',
    releaseId: release.id,
    projectId: release.project_id,
    versionId: release.version_id,
    buildId: release.build_id,
    revision: release.revision,
    sha256: release.sha256,
    approvedAt: release.approved_at,
    entrypoint: 'index.html',
    publishEnabled: false,
    target: 'unconfigured',
    budgetMicros: 0,
  });
  const readme =
    'Public Aethelios website release package\n\nOpen index.html to view this exact approved static website. Selected imagery is included.\nThis package is not a live website and authorizes no deployment or spending.\nBefore hosting: verify the current owner approval has not been revoked, compare index.html SHA-256 to manifest.json, verify isolated hosted acceptance, domain ownership, approved hosting budget and founder release decision.\nUse a separate customer-site origin. Preserve the restrictive CSP in index.html and add private-platform-independent security headers. Forms, payments and booking operations are not implemented.\nRevocation blocks future downloads in Aethelios; it cannot recall files already downloaded or shared.\nThe manifest is a consistency receipt, not a digital signature or proof of permission to publish.\n';
  const mtime = new Date('2000-01-01T00:00:00Z');
  const zip = zipSync(
    {
      'index.html': [strToU8(html), { mtime }],
      'manifest.json': [strToU8(JSON.stringify(manifest, null, 2)), { mtime }],
      'README.txt': [strToU8(readme), { mtime }],
    },
    { level: 0 },
  );
  if (zip.byteLength > 260000) throw new Error('Release package exceeds its budget.');
  return { bytes: zip, sha256: createHash('sha256').update(zip).digest('hex'), manifest };
}
