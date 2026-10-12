// Only signed-out routes and explicitly synthetic fixtures. No member records or credentials.
// Compact rendered excerpts allow connector inspection when binary artifact transfer is blocked.
import { access } from 'node:fs/promises';
import sharp from 'sharp';
const captures = [
  'obsidian--app-aethelios-390.png',
  'obsidian--app-work-1440.png',
  'obsidian--app-studio-1440.png',
  'emerald--lifestyle-1440.png',
  'founder-office-720.png',
  'obsidian---390.png',
];
let emitted = 0;
for (const name of captures) {
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
    .jpeg({ quality: 78 })
    .toBuffer();
  console.log(`IMPERIAL_REVIEW|${name}|${image.toString('base64')}`);
  emitted++;
}
console.log(`Rendered review excerpts: ${emitted}. Full screenshots remain in the artifact.`);
