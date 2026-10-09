// Reproduce install assets from the founder-approved AI-rebuilt icon.
import sharp from 'sharp';
const source = 'public/brand/aethelios-official-20261008-master.png';
for (const size of [192, 512]) {
  await sharp(source).resize(size, size).removeAlpha().png()
    .toFile(`public/brand/aethelios-official-20261008-${size}.png`);
}
// Separate AI-rebuilt circular composition, with seamless edge blending.
const maskSource = 'public/brand/aethelios-official-20261008-maskable-master.png';
const side = 420;
const alpha = Buffer.alloc(side * side * 4, 255);
for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
  alpha[(y * side + x) * 4 + 3] = Math.round(255 * Math.min(1, Math.min(x, y, side - 1 - x, side - 1 - y) / 32));
}
const edgeMask = await sharp(alpha, { raw: { width: side, height: side, channels: 4 } }).png().toBuffer();
const foreground = await sharp(maskSource).resize(side, side).ensureAlpha()
  .composite([{ input: edgeMask, blend: 'dest-in' }]).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#031525' } })
  .composite([{ input: foreground, gravity: 'centre' }]).removeAlpha().png()
  .toFile('public/brand/aethelios-official-20261008-maskable-512.png');
for (const [size, path] of [[180, 'src/app/apple-icon.png'], [64, 'src/app/icon.png']]) {
  await sharp(source).resize(size, size).removeAlpha().png().toFile(path);
}
