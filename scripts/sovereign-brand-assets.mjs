// Founder-supplied artwork, preserved without redraw or recoloring.
import sharp from 'sharp';
const source = 'public/brand/aethelios-sovereign-20261006.webp';
async function rendition(size, fit, path) {
  let input = await sharp(source)
    .resize(Math.floor(size * fit))
    .png()
    .toBuffer();
  if (path.includes('maskable')) {
    const side = Math.floor(size * fit);
    const mask = Buffer.from(
      `<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2}" fill="white"/></svg>`,
    );
    input = await sharp(input)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }
  await sharp({ create: { width: size, height: size, channels: 3, background: '#080709' } })
    .composite([{ input, gravity: 'centre' }])
    .png()
    .toFile(path);
}
for (const size of [192, 512])
  await rendition(size, 0.94, `public/brand/sovereign-20261006-${size}.png`);
await rendition(512, 0.75, 'public/brand/sovereign-20261006-maskable-512.png');
await rendition(180, 0.94, 'src/app/apple-icon.png');
await rendition(64, 0.94, 'src/app/icon.png');
