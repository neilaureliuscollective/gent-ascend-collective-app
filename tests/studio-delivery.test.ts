import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { deliveryPack, deliverySource, type DeliveryAsset } from '../src/domains/studio/delivery';
import { exportZip } from '../src/domains/studio/export';
const id = '10000000-0000-4000-8000-000000000001';
const image: DeliveryAsset = { kind: 'image', id, title: 'Selected image' };
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBmcAAAAASUVORK5CYII=',
  'base64',
);
const input = {
  title: 'Campaign',
  assets: [image],
  scenes: [],
  seconds: 4 as const,
  approved: true as const,
};
function contents(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength),
    files: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true),
      nameSize = view.getUint16(at + 26, true),
      name = new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nameSize));
    files[name] = new TextDecoder().decode(
      zip.subarray(at + 30 + nameSize, at + 30 + nameSize + size),
    );
    at += 30 + nameSize + size;
  }
  return files;
}
afterEach(() => vi.unstubAllGlobals());
it('preserves a real PCM narration as a separate original audio asset', async () => {
  const bytes = Buffer.alloc(16044);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(16000, 40);
  const fetch = vi.fn().mockResolvedValue(new Response(bytes));
  vi.stubGlobal('fetch', fetch);
  const files = contents(
    await deliveryPack(
      { ...input, assets: [{ kind: 'audio', id, title: 'Narration' }] },
      new AbortController().signal,
      () => {},
    ),
  );
  expect(files).toHaveProperty('asset-01.wav');
  expect(JSON.parse(files['manifest.json']!).assets[0].provenance).toBe('AI narration');
  expect(fetch.mock.calls[0]![0]).toBe(`/api/studio/narration/audio?id=${id}`);
});
it('creates a real deterministic package with hashes and no automatic private identifiers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(png));
  vi.stubGlobal('fetch', fetch);
  const zip = await deliveryPack(input, new AbortController().signal, () => {}),
    files = contents(zip);
  expect(Object.keys(files)).toEqual(['asset-01.png', 'manifest.json', 'campaign.md', 'readme.md']);
  const manifest = JSON.parse(files['manifest.json']!);
  expect(manifest.assets[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(files['manifest.json']).not.toContain(id);
  expect(files['readme.md']).toContain('not an assembled');
  expect(fetch.mock.calls[0]![0]).toBe(deliverySource(image));
  expect(fetch.mock.calls[0]![1]).toMatchObject({
    credentials: 'same-origin',
    redirect: 'error',
    cache: 'no-store',
  });
});
it('requires reviewed approval, strict asset identities and unique selections', async () => {
  await expect(
    deliveryPack(
      { ...input, approved: false as unknown as true },
      new AbortController().signal,
      () => {},
    ),
  ).rejects.toThrow('approve');
  await expect(
    deliveryPack({ ...input, assets: [image, image] }, new AbortController().signal, () => {}),
  ).rejects.toThrow('duplicate');
  expect(() => deliverySource({ ...image, id: 'https://foreign.test' })).toThrow();
  expect(() =>
    deliverySource({ ...image, url: 'https://foreign.test' } as DeliveryAsset),
  ).toThrow();
  expect(() => exportZip([{ name: '../private.mp4', bytes: png }], 'delivery')).toThrow();
  expect(() => exportZip([{ name: 'a.mp4', bytes: png }])).toThrow();
});
it('does not silently omit unavailable, malformed or cancelled assets', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('private error', { status: 403 }));
  vi.stubGlobal('fetch', fetch);
  await expect(deliveryPack(input, new AbortController().signal, () => {})).rejects.toThrow(
    'Nothing was exported',
  );
  fetch.mockResolvedValue(new Response('html masquerading as a picture'));
  await expect(deliveryPack(input, new AbortController().signal, () => {})).rejects.toThrow(
    'unsupported',
  );
  const abort = new AbortController();
  abort.abort();
  fetch.mockClear();
  await expect(deliveryPack(input, abort.signal, () => {})).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it('includes genuine video and scene captions while distinguishing scene timing from synchronization', async () => {
  const mp4 = Buffer.from(
    readFileSync('tests/fixtures/studio-footage.mp4.base64', 'utf8'),
    'base64',
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(mp4)));
  const zip = await deliveryPack(
    {
      ...input,
      assets: [{ kind: 'video', id, title: 'Film', duration: 5, ratio: '1280:720' }],
      scenes: [
        {
          id,
          position: 0,
          title: 'Opening',
          message: 'Reviewed scene',
          visual_direction: 'Light',
          motion_note: 'Hold',
          channel: 'social',
          asset_version_id: null,
        },
      ],
    },
    new AbortController().signal,
    () => {},
  );
  const files = contents(zip);
  expect(files).toHaveProperty('asset-01.mp4');
  expect(files['scene-captions.vtt']).toContain('not speech alignment');
  expect(files['scene-captions.srt']).toContain('00:00:00,000 --> 00:00:04,000');
});
it('enforces streamed media limits before allocating or completing an archive', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(10_000_001))));
  await expect(deliveryPack(input, new AbortController().signal, () => {})).rejects.toThrow(
    'supported size',
  );
});
