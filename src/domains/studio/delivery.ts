import { z } from 'zod';
import { exportZip } from './export';
import { narrationWave, sceneSubtitles } from './narration';
import { footageMp4 } from './footage-media';
import { campaignCopy, type CampaignScene } from './campaign';
export const deliveryAsset = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('image'), id: z.uuid(), title: z.string().max(80) }).strict(),
  z.object({ kind: z.literal('audio'), id: z.uuid(), title: z.string().max(80) }).strict(),
  z
    .object({
      kind: z.literal('video'),
      id: z.uuid(),
      title: z.string().max(80),
      duration: z.union([z.literal(5), z.literal(10)]),
      ratio: z.enum(['1280:720', '720:1280']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('film'),
      id: z.uuid(),
      title: z.string().max(80),
      durationMs: z.number().int().min(1000).max(60_000),
      width: z.number().int(),
      height: z.number().int(),
    })
    .strict(),
]);
export type DeliveryAsset = z.infer<typeof deliveryAsset>;
export function deliverySource(asset: DeliveryAsset) {
  const item = deliveryAsset.parse(asset);
  return item.kind === 'image'
    ? `/api/studio/image?id=${item.id}&kind=version`
    : item.kind === 'audio'
      ? `/api/studio/narration/audio?id=${item.id}`
      : item.kind === 'film'
        ? `/api/studio/film/file?id=${item.id}&kind=film`
        : `/api/studio/footage/video?id=${item.id}`;
}
async function readAsset(asset: DeliveryAsset, signal: AbortSignal, remaining: number) {
  const response = await fetch(deliverySource(asset), {
    cache: 'no-store',
    credentials: 'same-origin',
    redirect: 'error',
    signal,
  });
  if (!response.ok || !response.body)
    throw new Error(
      'A selected saved asset is unavailable. Nothing was exported; refresh your selection.',
    );
  const limit = Math.min(
    remaining,
    asset.kind === 'video' || asset.kind === 'film'
      ? 80_000_000
      : asset.kind === 'audio'
        ? 3_000_000
        : 10_000_000,
  );
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new Error(
          'This package exceeds the supported size. Select fewer assets or download them individually.',
        );
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  let extension: string;
  if (asset.kind === 'audio') {
    narrationWave(bytes);
    extension = 'wav';
  } else if (asset.kind === 'film') {
    if (bytes.length < 64 || bytes[4] !== 0x66) throw new Error('Finished film is not an MP4.');
    extension = 'mp4';
  } else if (asset.kind === 'video') {
    footageMp4(bytes, asset.duration, asset.ratio);
    extension = 'mp4';
  } else if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    extension = 'png';
  else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    extension = 'jpg';
  else if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
  )
    extension = 'webp';
  else throw new Error('A selected image has an unsupported format. Nothing was exported.');
  return { bytes, extension };
}
export async function deliveryPack(
  input: {
    title: string;
    assets: DeliveryAsset[];
    scenes: CampaignScene[];
    seconds: 2 | 4 | 6;
    approved: true;
  },
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  if (input.approved !== true) throw new Error('Review and approve this handoff first.');
  const assets = z.array(deliveryAsset).min(1).max(8).parse(input.assets);
  if (new Set(assets.map((a) => `${a.kind}:${a.id}`)).size !== assets.length)
    throw new Error('Remove duplicate selected assets.');
  if (input.scenes.length > 8 || ![2, 4, 6].includes(input.seconds) || input.title.length > 120)
    throw new Error('Unsupported campaign handoff.');
  const files: { name: string; bytes: Uint8Array }[] = [];
  const manifest: {
    file: string;
    title: string;
    kind: string;
    bytes: number;
    sha256: string;
    provenance: string;
  }[] = [];
  let total = 0;
  progress(0, assets.length);
  for (const [index, asset] of assets.entries()) {
    signal.throwIfAborted();
    const { bytes, extension } = await readAsset(asset, signal, 49_000_000 - total);
    const name = `asset-${String(index + 1).padStart(2, '0')}.${extension}`;
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    manifest.push({
      file: name,
      title: asset.title,
      kind: asset.kind,
      bytes: bytes.length,
      sha256: Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, '0')).join(''),
      provenance:
        asset.kind === 'audio'
          ? 'AI narration'
          : asset.kind === 'video'
            ? 'AI footage original'
            : asset.kind === 'film'
              ? 'Finished Studio composition render bound to a frozen revision'
              : 'Saved Studio image; review source provenance',
    });
    files.push({ name, bytes });
    total += bytes.length;
    progress(index + 1, assets.length);
  }
  const text = (name: string, value: string) =>
    files.push({ name, bytes: new TextEncoder().encode(value) });
  text(
    'manifest.json',
    JSON.stringify(
      {
        version: 1,
        title: input.title,
        status: 'reviewed handoff draft; not published',
        review:
          'Member confirmed review; rights and factual claims are not independently verified by Aethelios.',
        assets: manifest,
        sceneTiming: {
          seconds: input.seconds,
          alignment: 'Scene timing only; not speech alignment or footage editing.',
        },
      },
      null,
      2,
    ),
  );
  text('campaign.md', campaignCopy(input.title, input.scenes));
  text(
    'readme.md',
    '# AETHELIOS — The Human Ascendance\n\nPrivate campaign handoff. This archive contains the selected original media, not an assembled or synchronized film. Review factual claims, product appearance, usage rights and synthetic-media disclosures before sharing. No publishing, model generation or payment was performed by this export.\n\nmanifest.json lists SHA-256 hashes for checking file integrity. Filenames do not contain private storage paths or provider URLs.\n\nCaptions, when present, describe storyboard scene timing only. Import and retime them in your editor; they do not automatically align with voice or selected footage.\n',
  );
  if (input.scenes.length) {
    text('scene-captions.vtt', sceneSubtitles(input.scenes, input.seconds, 'vtt'));
    text('scene-captions.srt', sceneSubtitles(input.scenes, input.seconds, 'srt'));
  }
  signal.throwIfAborted();
  return exportZip(files, 'delivery');
}
