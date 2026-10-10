// Reproduce install-only assets from the official text-free Imperial Obsidian crest master.
import sharp from 'sharp';
const source = 'public/brand/aethelios-imperial-obsidian-20261010-master.png';
for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size)
    .removeAlpha()
    .png()
    .toFile(`public/brand/aethelios-imperial-obsidian-20261010-${size}.png`);
}
// The maskable master includes seamless obsidian-green and launcher-safe artwork padding.
// Keep essential artwork inside Android's central 80%-diameter safe circle.
await sharp('public/brand/aethelios-imperial-obsidian-20261010-maskable-master.png')
  .resize(512, 512)
  .removeAlpha()
  .png()
  .toFile('public/brand/aethelios-imperial-obsidian-20261010-maskable-512.png');
for (const [size, path] of [
  [180, 'src/app/apple-icon.png'],
  [64, 'src/app/icon.png'],
]) {
  await sharp(source).resize(size, size).removeAlpha().png().toFile(path);
}
