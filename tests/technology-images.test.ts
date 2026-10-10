import { vi, it, expect } from 'vitest';
vi.mock('server-only', () => ({}));
import sharp from 'sharp';
import { normalizeWebsiteImage, verifiedImageBytes } from '@/domains/technology/image-normalize';
import { imageCommand, imageRefSchema } from '@/domains/technology/image-schema';
import { renderArtifact, checkArtifact } from '@/domains/technology/artifact';
import { brief } from './technology.test';
it('normalizes raster bytes into a bounded metadata-free JPEG and verifies the digest', async () => {
  const source = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: '#145463' },
  })
    .png()
    .toBuffer();
  const normalized = await normalizeWebsiteImage(source);
  const bytes = verifiedImageBytes(normalized.dataUrl, normalized.sha256);
  const metadata = await sharp(bytes).metadata();
  expect(metadata.format).toBe('jpeg');
  expect(metadata.width).toBe(1000);
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeUndefined();
  expect(bytes.length).toBeLessThanOrEqual(100000);
  expect(() => verifiedImageBytes(normalized.dataUrl, '0'.repeat(64))).toThrow(/verification/);
  const id = crypto.randomUUID();
  const html = renderArtifact(
    { ...brief, image: { assetId: id, alt: 'A considered studio interior' } },
    { assetId: id, dataUrl: normalized.dataUrl },
  );
  expect(html).toContain('img-src data:');
  expect(html).not.toContain('/api/');
  expect(checkArtifact(html).passed).toBe(true);
  expect(() =>
    renderArtifact({ ...brief, image: { assetId: id, alt: 'A studio interior' } }),
  ).toThrow(/Exact/);
  expect(() =>
    renderArtifact(
      { ...brief, image: { assetId: id, alt: 'A studio interior' } },
      { assetId: crypto.randomUUID(), dataUrl: normalized.dataUrl },
    ),
  ).toThrow(/Exact/);
  expect(
    checkArtifact(html.replace(normalized.dataUrl, 'https://evil.test/tracker.png')).passed,
  ).toBe(false);
});
it('rejects SVG, malformed signatures, oversized inputs and pixel bombs', async () => {
  for (const b of [
    Buffer.from('<svg>' + 'x'.repeat(100) + '</svg>'),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]),
    Buffer.alloc(10485761),
  ])
    await expect(normalizeWebsiteImage(b)).rejects.toThrow();
  const bomb = await sharp({
    create: { width: 5000, height: 4000, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await expect(normalizeWebsiteImage(bomb)).rejects.toThrow();
});
it('requires explicit source consent and bounded meaningful alt text', () => {
  const command = {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    expected: 1,
    sourceId: crypto.randomUUID(),
    kind: 'reference',
    consent: true,
  };
  expect(imageCommand.safeParse(command).success).toBe(true);
  expect(imageCommand.safeParse({ ...command, consent: false }).success).toBe(false);
  expect(imageCommand.safeParse({ ...command, owner: 'other' }).success).toBe(false);
  for (const image of [
    { assetId: crypto.randomUUID(), alt: '' },
    { assetId: 'https://evil.test', alt: 'Studio image' },
    { assetId: crypto.randomUUID(), alt: 'x'.repeat(161) },
  ])
    expect(imageRefSchema.safeParse(image).success).toBe(false);
});
