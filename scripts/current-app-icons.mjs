// Reproduce install-only assets from the Imperial Steel icon master.
import sharp from 'sharp';
const source = 'public/brand/aethelios-imperial-steel-20261009-master.png';
for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size)
    .removeAlpha()
    .png()
    .toFile(`public/brand/aethelios-imperial-steel-20261009-${size}.png`);
}
// The maskable master includes seamless steel and launcher-safe artwork padding.
// Keep essential artwork inside Android's central 80%-diameter safe circle.
await sharp('public/brand/aethelios-imperial-steel-20261009-maskable-master.png')
  .resize(512, 512)
  .removeAlpha()
  .png()
  .toFile('public/brand/aethelios-imperial-steel-20261009-maskable-512.png');
for (const [size, path] of [
  [180, 'src/app/apple-icon.png'],
  [64, 'src/app/icon.png'],
]) {
  await sharp(source).resize(size, size).removeAlpha().png().toFile(path);
}
