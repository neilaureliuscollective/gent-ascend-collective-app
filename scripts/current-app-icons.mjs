// Deterministic installation assets from the current approved full crest.
// No generation, redraw, crop, recoloring, or changes to the source artwork.
import sharp from 'sharp';
const source = 'public/brand/gent-ascend-full-20261003.png';
async function rendition(size, fit, path) {
  const input = await sharp(source)
    .resize(Math.floor(size * fit))
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: '#050706' } })
    .composite([{ input, gravity: 'centre' }])
    .png()
    .toFile(path);
}
for (const size of [192, 512])
  await rendition(size, 0.94, `public/brand/app-crest-20261004-${size}.png`);
// Entire round crest lies inside the central 80% diameter safe circle.
await rendition(512, 0.75, 'public/brand/app-crest-20261004-maskable-512.png');
await rendition(180, 0.94, 'src/app/apple-icon.png');
await rendition(64, 0.94, 'src/app/icon.png');
