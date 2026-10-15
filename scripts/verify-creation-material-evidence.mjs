import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';

const root = resolve(process.argv[2] || 'test-results/creation-materials');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const files = [];
let manifests = 0;
let videos = 0;
for (const folder of await readdir(root, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  const directory = join(root, folder.name);
  const entries = await readdir(directory);
  if (entries.includes('manifest.json')) {
    const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
    if (manifest.commit !== commit) throw new Error('Evidence commit does not match checkout.');
    if (manifest.files.length !== 10) throw new Error('Incomplete before/after surface set.');
    manifests++;
    for (const item of manifest.files) {
      const bytes = await readFile(join(directory, item.path));
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== item.bytes || hash !== item.sha256)
        throw new Error('Screenshot hash mismatch.');
      const png = PNG.sync.read(bytes);
      if (png.width !== manifest.viewport.width)
        throw new Error('Screenshot viewport width mismatch.');
      if (
        item.path.includes('studio-')
          ? png.height < manifest.viewport.height
          : png.height !== manifest.viewport.height
      )
        throw new Error('Screenshot viewport height mismatch.');
      if (item.path.startsWith('before-')) {
        const baseline = await readFile(join('docs/evidence/creation-materials', item.path));
        if (!baseline.equals(bytes)) throw new Error('Screenshot uses a superseded baseline.');
      }
      files.push({ path: `${folder.name}/${item.path}`, bytes: bytes.length, sha256: hash });
    }
  }
  for (const name of entries.filter((name) => name.endsWith('.webm'))) {
    const path = join(directory, name);
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration:stream=codec_name,width,height',
          '-of',
          'json',
          path,
        ],
        { encoding: 'utf8' },
      ),
    );
    const duration = Number(probe.format?.duration);
    if (
      !(duration > 0) ||
      !probe.streams?.some((stream) => ['vp8', 'vp9'].includes(stream.codec_name))
    )
      throw new Error('Video is missing or not finalized.');
    videos++;
    files.push({ path: `${folder.name}/${name}`, duration, streams: probe.streams });
  }
}
if (manifests !== 5 || files.filter((file) => file.sha256).length !== 50 || videos !== 6)
  throw new Error('Incomplete creation-material evidence.');
const index = {
  schema: 'creation-material-evidence/v1',
  commit,
  kind: 'production-build-with-labelled-API-fixtures',
  viewportManifests: manifests,
  screenshots: 50,
  finalizedVideos: videos,
  files,
};
await writeFile(join(root, 'evidence-index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(JSON.stringify(index, null, 2));
