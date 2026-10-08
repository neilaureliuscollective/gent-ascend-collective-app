// Deterministic production renditions of the founder-approved AI recreation.
// The full-bleed master is opaque; operating systems apply their own icon mask.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const source = 'public/brand/aethelios-app-20261008-master.png';
const prefix = 'public/brand/aethelios-app-20261008';
async function rendition(size, path) {
  await sharp(source).resize(size, size, { kernel: 'lanczos3' }).removeAlpha().png().toFile(path);
}
for (const size of [192, 512]) await rendition(size, `${prefix}-${size}.png`);
await rendition(180, `${prefix}-apple-180.png`);
await rendition(180, 'src/app/apple-icon.png');
await rendition(64, 'src/app/icon.png');
for (const size of [16, 32]) await rendition(size, `${prefix}-favicon-${size}.png`);

// Circular crest and cardinal stars fit the central 80% diameter safe circle.
// The rounded-square ornamental frame is expendable under circular masks.
for (const size of [192, 512]) {
  const inset = Math.round(size * 0.8);
  // Extend the master's blue corner texture rather than introducing a flat mat.
  const background = await sharp(source)
    .extract({ left: 0, top: 0, width: 80, height: 80 })
    .resize(size, size)
    .png()
    .toBuffer();
  const { data } = await sharp(source)
    .resize(inset, inset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const feather = Math.max(2, Math.round(inset * 0.025));
  for (let y = 0; y < inset; y++)
    for (let x = 0; x < inset; x++)
      data[(y * inset + x) * 4 + 3] = Math.round(
        255 * Math.min(1, Math.min(x, y, inset - 1 - x, inset - 1 - y) / feather),
      );
  const input = await sharp(data, { raw: { width: inset, height: inset, channels: 4 } })
    .png()
    .toBuffer();
  await sharp(background)
    .composite([{ input, gravity: 'centre' }])
    .removeAlpha()
    .png()
    .toFile(`${prefix}-maskable-${size}.png`);
}

// Multi-resolution ICO retains the approved artwork without a replacement glyph.
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile('src/app/favicon.ico', Buffer.concat([directory, ...images]));
