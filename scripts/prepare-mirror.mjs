// Self-hosted, pinned MediaPipe assets. No camera frames reach an asset provider.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir = 'public/mirror/vision-1.0.1';
await mkdir(dir, { recursive: true });
for (const name of [
  'vision_bundle.js',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js',
  'wasm/vision_wasm_nosimd_internal.wasm',
]) {
  const dest = `${dir}/${name}`;
  await mkdir(dest.slice(0, dest.lastIndexOf('/')), { recursive: true });
  await copyFile(`node_modules/@mediapipe/tasks-vision/${name}`, dest);
}
const model = `${dir}/face_landmarker.task`;
const expected = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
let bytes = await readFile(model).catch(() => null);
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== expected) {
  const response = await fetch(
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    { signal: AbortSignal.timeout(45000) },
  );
  if (!response.ok) throw new Error('Mirror model download failed');
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('Mirror model checksum mismatch');
  await writeFile(model, bytes);
}
