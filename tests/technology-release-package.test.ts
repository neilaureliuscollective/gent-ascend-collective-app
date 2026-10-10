import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { renderArtifact } from '../src/domains/technology/artifact';
import {
  createReleasePackage,
  releaseManifestSchema,
} from '../src/domains/technology/release-package';
import { releaseCommand } from '../src/domains/technology/release-schema';
const html = renderArtifact({
  name: 'Synthetic release',
  industry: 'professional-services',
  vision: 'A thoughtful synthetic website.',
  headline: 'Considered work',
  about: 'A synthetic service.',
  services: [{ name: 'Consultation', description: 'Discuss your needs.', price: '' }],
  hours: '',
  contact: '',
  bookingUrl: '',
});
const release = {
  id: 'f7100000-0000-4000-8000-000000000001',
  person_id: 'f7100000-0000-4000-8000-000000000002',
  project_id: 'f7100000-0000-4000-8000-000000000003',
  version_id: 'f7100000-0000-4000-8000-000000000004',
  build_id: 'f7100000-0000-4000-8000-000000000005',
  revision: 2,
  sha256: createHash('sha256').update(html).digest('hex'),
  approved_at: '2026-10-09T04:00:00+00:00',
  revoked_at: null,
};
it('creates a deterministic bounded portable ZIP with exact bytes and a disabled hosting receipt', () => {
  const packet = createReleasePackage(release, html),
    files = unzipSync(packet.bytes);
  expect(Object.keys(files).sort()).toEqual(['README.txt', 'index.html', 'manifest.json']);
  expect(strFromU8(files['index.html']!)).toBe(html);
  const manifest = releaseManifestSchema.parse(JSON.parse(strFromU8(files['manifest.json']!)));
  expect(manifest).toMatchObject({
    revision: 2,
    sha256: release.sha256,
    publishEnabled: false,
    target: 'unconfigured',
    budgetMicros: 0,
  });
  expect(strFromU8(files['manifest.json']!)).not.toContain(release.person_id);
  expect(strFromU8(files['README.txt']!)).toContain('cannot recall');
  expect(createReleasePackage(release, html).bytes).toEqual(packet.bytes);
  expect(packet.bytes.length).toBeLessThan(260000);
  expect(packet.sha256).toBe(createHash('sha256').update(packet.bytes).digest('hex'));
});
it('refuses revoked approvals, tampered bytes, unsafe HTML and oversized artifacts', () => {
  expect(() =>
    createReleasePackage({ ...release, revoked_at: release.approved_at }, html),
  ).toThrow();
  expect(() => createReleasePackage(release, html + ' ')).toThrow();
  const unsafe = html.replace('</body>', '<script>alert(1)</script></body>');
  expect(() =>
    createReleasePackage(
      { ...release, sha256: createHash('sha256').update(unsafe).digest('hex') },
      unsafe,
    ),
  ).toThrow();
  expect(() => createReleasePackage(release, 'x'.repeat(250001))).toThrow();
});
it('accepts only explicit exact-build consent and keeps deployment fields out of customer commands', () => {
  const command = {
    action: 'approve',
    id: release.id,
    buildId: release.build_id,
    sha256: release.sha256,
    consent: true,
  };
  expect(releaseCommand.safeParse(command).success).toBe(true);
  for (const changed of [
    { consent: false },
    { sha256: 'wrong' },
    { target: 'production' },
    { person_id: release.person_id },
  ])
    expect(releaseCommand.safeParse({ ...command, ...changed }).success).toBe(false);
  expect(releaseCommand.safeParse({ action: 'revoke', id: release.id }).success).toBe(true);
});
