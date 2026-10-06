// Deterministic color-only correction of the supplied Aethelios emblem.
// Preserve geometry, gold, black and lettering. No generated/redrawn imagery.
import sharp from 'sharp';
const source = 'public/brand/aethelios-sovereign-20261006.webp';
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const r = data[i] / 255,
    g = data[i + 1] / 255,
    b = data[i + 2] / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (!d) continue;
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  // Purple/ruby enamel only; gold hues remain byte-for-byte in the raw buffer.
  if ((hue < 250 && hue > 12) || d / max < 0.18) continue;
  const v = max * 0.72,
    s = Math.min(0.94, Math.max(0.5, d / max)),
    c = v * s,
    m = v - c;
  // Signature green hue 162 degrees; preserve each pixel's lighting variation.
  data[i] = Math.round(m * 255);
  data[i + 1] = Math.round((c + m) * 255);
  data[i + 2] = Math.round((c * 0.7 + m) * 255);
}
const emblem = 'public/brand/aethelios-deep-green-20261006.webp';
await sharp(data, { raw: info }).webp({ quality: 94 }).toFile(emblem);
async function rendition(size, fit, path) {
  const side = Math.floor(size * fit);
  let input = await sharp(emblem).resize(side).png().toBuffer();
  if (path.includes('maskable')) {
    const mask = Buffer.from(
      `<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2}" fill="white"/></svg>`,
    );
    input = await sharp(input)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }
  await sharp({ create: { width: size, height: size, channels: 3, background: '#030806' } })
    .composite([{ input, gravity: 'centre' }])
    .png()
    .toFile(path);
}
for (const size of [192, 512])
  await rendition(size, 0.94, `public/brand/deep-green-20261006-${size}.png`);
await rendition(512, 0.75, 'public/brand/deep-green-20261006-maskable-512.png');
await rendition(180, 0.94, 'src/app/apple-icon.png');
await rendition(64, 0.94, 'src/app/icon.png');
