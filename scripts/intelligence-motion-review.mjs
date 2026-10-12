// Explicit synthetic fixture screenshots only. No account, conversation or provider data.
import { access } from 'node:fs/promises';
import sharp from 'sharp';
let emitted = 0;
for (const name of [
  'visible-response-waiting-344.png',
  'visible-response-waiting-768.png',
  'visible-response-waiting-1440.png',
  'visible-response-long-768.png',
]) {
  const file = `test-results/${name}`;
  if (
    !(await access(file).then(
      () => true,
      () => false,
    ))
  )
    continue;
  const source = sharp(file);
  const { width, height } = await source.metadata();
  const image = await source
    .extract({ left: 0, top: 0, width, height: Math.min(height, 1300) })
    .resize({ width: Math.min(width, 1000), withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  console.log(`MOTION_REVIEW|${name}|${image.toString('base64')}`);
  emitted++;
}
console.log(
  `Synthetic rendered motion excerpts: ${emitted}. Full captures remain in the artifact.`,
);
