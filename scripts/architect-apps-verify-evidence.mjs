import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = 'test-results/architect-apps-connected';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const receipt = JSON.parse(readFileSync('docs/evidence/architect-apps/connected-journey.json', 'utf8'));
if (receipt.commit !== commit || receipt.kind !== 'connected-local-acceptance')
  throw new Error('Connected receipt must belong to this tested commit.');
const files = [];
for (const phase of ['arrival', 'selected-path', 'shaping', 'compiled', 'precise-edit', 'comparison', 'recovered', 'reopened']) {
  for (const viewport of ['desktop', 'fold', 'phone']) {
    const path = `${root}/workbench-${phase}-${viewport}.png`;
    const bytes = readFileSync(path);
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.length < 1000)
      throw new Error(`Invalid screenshot: ${path}`);
    files.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
for (const name of ['connected-journey.webm', 'reopened-journey.webm']) {
  const path = `${root}/${name}`;
  const bytes = readFileSync(path);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', path], { encoding: 'utf8' }));
  if (!(Number(probe.format?.duration) > 0) || !probe.streams?.some((stream) => stream.codec_type === 'video'))
    throw new Error(`Video is not finalized and playable: ${path}`);
  files.push({ path, bytes: bytes.length, duration: Number(probe.format.duration), sha256: createHash('sha256').update(bytes).digest('hex') });
}
const manifest = { commit, kind: receipt.kind, generation: receipt.generation, files };
writeFileSync(`${root}/evidence-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
