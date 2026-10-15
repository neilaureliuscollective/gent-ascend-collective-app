import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompositionDocument } from '../composition/model';
import type { LocalAsset } from '../composition/compile';

export async function materializeCompositionAssets(input: {
  // Supabase query builders are thenable, not Promise instances.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  personId: string;
  projectId: string;
  document: CompositionDocument;
  dir: string;
  imageBucket: string;
}): Promise<LocalAsset[]> {
  await mkdir(input.dir, { recursive: true });
  const assets: LocalAsset[] = [];
  const used = new Map<string, LocalAsset>();
  const add = async (
    kind: LocalAsset['kind'],
    id: string,
    table: 'ai_studio_versions' | 'ai_studio_references' | 'ai_studio_footage' | 'ai_studio_narrations',
    storageBucket: string,
    media: LocalAsset['media'],
    ext: string,
  ) => {
    const key = `${kind}:${id}`;
    if (used.has(key)) {
      assets.push(used.get(key)!);
      return;
    }
    const row = await input.client
      .from(table)
      .select('id,storage_key,project_id')
      .eq('id', id)
      .eq('person_id', input.personId)
      .eq('project_id', input.projectId)
      .maybeSingle();
    if (row.error || !row.data?.storage_key) throw new Error('A film asset is not available in this project.');
    const file = await input.client.storage.from(storageBucket).download(row.data.storage_key);
    if (file.error || !file.data) throw new Error('A film asset could not be read from private storage.');
    const target = path.join(input.dir, `${kind}-${id}.${ext}`);
    await writeFile(target, Buffer.from(await file.data.arrayBuffer()));
    const asset = { id, kind, path: target, media };
    used.set(key, asset);
    assets.push(asset);
  };
  for (const scene of input.document.scenes) {
    if (scene.kind === 'image')
      await add(
        scene.assetKind,
        scene.assetId,
        scene.assetKind === 'version' ? 'ai_studio_versions' : 'ai_studio_references',
        input.imageBucket,
        'image',
        'png',
      );
    else await add('footage', scene.assetId, 'ai_studio_footage', 'aethelios-studio-video', 'video', 'mp4');
  }
  if (input.document.narration)
    await add('narration', input.document.narration.assetId, 'ai_studio_narrations', 'aethelios-studio-audio', 'wav', 'wav');
  if (input.document.music)
    await add('music', input.document.music.assetId, 'ai_studio_narrations', 'aethelios-studio-audio', 'wav', 'wav');
  return assets;
}
