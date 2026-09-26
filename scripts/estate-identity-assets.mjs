// Reproducible renditions from tracked founder master and generated companion.
import sharp from 'sharp';
const master = 'public/brand/gent-ascend-master-20260926.png';
const companion = 'public/brand/ascend-star-v2.webp';
await sharp(master)
  .resize(800)
  .webp({ quality: 94 })
  .toFile('public/brand/gent-ascend-crest-v2.webp');
for (const size of [192, 512]) {
  // Generated symbol occupies ~83% of its image; 88% canvas fit keeps it inside 80% safe circle.
  const inner = Math.floor(size * 0.88);
  const input = await sharp(companion).resize(inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#0B3B32' } })
    .composite([{ input, gravity: 'centre' }])
    .png()
    .toFile(`public/brand/icon-v2-${size}.png`);
}
await sharp(companion).resize(180).png().toFile('src/app/apple-icon.png');
