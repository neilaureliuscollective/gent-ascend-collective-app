// Reproduce install-only assets from the official 2026-10-15 gold-A source.
// Extend atmosphere into baked iOS corner cutouts. Do not redraw the emblem.
import sharp from 'sharp';

const SOURCE = 'public/brand/aethelios-official-20261015-source.png';
const PREFIX = 'public/brand/aethelios-official-20261015';
const CORNER_RATIO = 0.29;
const ATMOSPHERE = { r: 3, g: 12, b: 8 };

function isGold(red, green, blue) {
  return red > 90 && red > green + 10 && green > blue + 15;
}

function outsideRoundedRect(x, y, width, height, radius) {
  let dx = 0;
  let dy = 0;
  if (x + 0.5 < radius) dx = radius - (x + 0.5);
  else if (x + 0.5 > width - radius) dx = x + 0.5 - (width - radius);
  if (y + 0.5 < radius) dy = radius - (y + 0.5);
  else if (y + 0.5 > height - radius) dy = y + 0.5 - (height - radius);
  return dx > 0 && dy > 0 && dx * dx + dy * dy > radius * radius;
}

async function extendAtmosphere(input) {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const radius = width * CORNER_RATIO;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!outsideRoundedRect(x, y, width, height, radius)) continue;
      const to = (y * width + x) * channels;
      data[to] = ATMOSPHERE.r;
      data[to + 1] = ATMOSPHERE.g;
      data[to + 2] = ATMOSPHERE.b;
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

function goldRadius(data, width, height, channels) {
  let farthest = 0;
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      if (isGold(data[index], data[index + 1], data[index + 2])) {
        farthest = Math.max(farthest, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
      }
    }
  }
  return farthest;
}

const source = await extendAtmosphere(SOURCE);
const sourceMeta = await sharp(source).metadata();
if (sourceMeta.width !== sourceMeta.height) {
  throw new Error('Official icon source must remain square.');
}

const master = await sharp(source)
  .resize(1024, 1024, { kernel: 'lanczos3' })
  .removeAlpha()
  .png()
  .toBuffer();
await sharp(master).png().toFile(`${PREFIX}-master.png`);

const { data: masterData, info: masterInfo } = await sharp(master)
  .raw()
  .toBuffer({ resolveWithObject: true });
const requiredScale =
  0.4 / (goldRadius(masterData, masterInfo.width, masterInfo.height, masterInfo.channels) / 1024);
const artworkScale = Math.min(0.76, requiredScale * 0.96);
if (artworkScale < 0.55) {
  throw new Error(`Maskable artwork scale ${artworkScale} is unexpectedly small.`);
}

const artworkSize = Math.round(1024 * artworkScale);
const maskableMaster = await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: ATMOSPHERE },
})
  .composite([
    {
      input: await sharp(master)
        .resize(artworkSize, artworkSize, { kernel: 'lanczos3' })
        .png()
        .toBuffer(),
      gravity: 'centre',
    },
  ])
  .removeAlpha()
  .png()
  .toBuffer();
await sharp(maskableMaster).png().toFile(`${PREFIX}-maskable-master.png`);

for (const size of [192, 512]) {
  await sharp(master)
    .resize(size, size, { kernel: 'lanczos3' })
    .removeAlpha()
    .png()
    .toFile(`${PREFIX}-${size}.png`);
  await sharp(maskableMaster)
    .resize(size, size, { kernel: 'lanczos3' })
    .removeAlpha()
    .png()
    .toFile(`${PREFIX}-maskable-${size}.png`);
}

await sharp(master)
  .resize(180, 180, { kernel: 'lanczos3' })
  .removeAlpha()
  .png()
  .toFile('src/app/apple-icon.png');
await sharp(master).resize(64, 64, { kernel: 'lanczos3' }).removeAlpha().png().toFile('src/app/icon.png');

const maskable512 = await sharp(`${PREFIX}-maskable-512.png`)
  .raw()
  .toBuffer({ resolveWithObject: true });
let outside = 0;
let gold = 0;
for (let y = 0; y < maskable512.info.height; y++) {
  for (let x = 0; x < maskable512.info.width; x++) {
    const index = (y * maskable512.info.width + x) * maskable512.info.channels;
    if (isGold(maskable512.data[index], maskable512.data[index + 1], maskable512.data[index + 2])) {
      gold++;
      if (Math.hypot(x + 0.5 - 256, y + 0.5 - 256) > 204.8) outside++;
    }
  }
}
if (outside !== 0 || gold < 1000) {
  throw new Error(`Maskable safe-area check failed: gold=${gold} outside=${outside}`);
}

const corner = await sharp(`${PREFIX}-master.png`)
  .extract({ left: 0, top: 0, width: 24, height: 24 })
  .stats();
if (corner.channels[0].mean + corner.channels[1].mean + corner.channels[2].mean < 6) {
  throw new Error('Standard master still has an empty baked corner.');
}

console.log(
  JSON.stringify(
    {
      source: `${sourceMeta.width}x${sourceMeta.height}`,
      artworkScale,
      gold,
      outside,
      cornerMean: corner.channels.map((channel) => Number(channel.mean.toFixed(2))),
    },
    null,
    2,
  ),
);
