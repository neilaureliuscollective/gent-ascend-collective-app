// Deterministic renditions of the founder's artwork. No generated/redrawn figure.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const master = 'public/brand/gent-ascend-master.png';
// The supplied 1536 square includes a detached wordmark and floor reflection.
const crest = await sharp(master)
  .extract({ left: 178, top: 22, width: 1180, height: 1130 })
  .resize(600, 600, { fit: 'contain', background: '#050706' })
  .png()
  .toBuffer();
await sharp(crest).webp({ quality: 92 }).toFile('public/brand/gent-ascend-crest.webp');
await sharp(master)
  .resize(960)
  .webp({ quality: 92 })
  .toFile('public/brand/gent-ascend-lockup.webp');
for (const size of [192, 512]) {
  // Keep the complete crest inside the central 80% maskable safe circle.
  const inner = Math.floor(size * 0.78);
  const inset = Math.floor((size - inner) / 2);
  const art = await sharp(crest).resize(inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#050706' } })
    .composite([{ input: art, left: inset, top: inset }])
    .png()
    .toFile(`public/brand/icon-${size}.png`);
}
await sharp('public/brand/icon-512.png').resize(180).png().toFile('src/app/apple-icon.png');
// Small native icon uses the crest's eight-point celestial star, not an unrelated monogram.
await writeFile(
  'src/app/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#050706"/><circle cx="32" cy="32" r="25" fill="#0B3B32" stroke="#C4912F" stroke-width="2"/><path d="m32 10 4 16 12-10-10 12 16 4-16 4 10 12-12-10-4 16-4-16-12 10 10-12-16-4 16-4-10-12 12 10Z" fill="#E4BF6A"/><path d="M32 10v44M10 32h44" stroke="#9D6E1F" stroke-width="1"/></svg>`,
);
