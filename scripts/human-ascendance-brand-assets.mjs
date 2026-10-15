// In-app Human Ascendance identity only. Do not write install/PWA/Apple/browser icons.
import sharp from 'sharp';

const SOURCE = 'public/brand/aethelios-human-ascendance-20261015-master.png';
const LOCKUP = 'public/brand/aethelios-human-ascendance-20261015-lockup.webp';
const CREST = 'public/brand/aethelios-human-ascendance-20261015-crest.webp';
const OPENGRAPH = 'src/app/opengraph-image.png';
const FIELD = { r: 0, g: 0, b: 0, alpha: 1 };

const master = sharp(SOURCE);
const meta = await master.metadata();
if (meta.width !== 1254 || meta.height !== 1254) {
  throw new Error(
    `Human Ascendance master must remain 1254×1254, received ${meta.width}×${meta.height}.`,
  );
}

await sharp(SOURCE).webp({ quality: 92, alphaQuality: 100 }).toFile(LOCKUP);

// Keep the ascending A, star and Earth; exclude AETHELIOS / THE HUMAN ASCENDANCE lettering
// so compact headers stay legible beside the HTML wordmark.
const emblem = await sharp(SOURCE)
  .extract({ left: 0, top: 90, width: 1254, height: 760 })
  .png()
  .toBuffer();
const emblemMeta = await sharp(emblem).metadata();
const size = 1254;
const fitted = await sharp(emblem)
  .resize({
    width: size,
    height: size,
    fit: 'contain',
    background: FIELD,
  })
  .png()
  .toBuffer();
if (!emblemMeta.width || emblemMeta.height !== 760) {
  throw new Error('Emblem crop height must remain 760px under the globe and above the wordmark.');
}
await sharp(fitted).webp({ quality: 92, alphaQuality: 100 }).toFile(CREST);

const card = 520;
const lockupCard = await sharp(SOURCE)
  .resize({ width: card, height: card, fit: 'contain', background: '#050706' })
  .png()
  .toBuffer();
await sharp({
  create: { width: 1200, height: 630, channels: 3, background: '#050706' },
})
  .composite([
    { input: lockupCard, left: Math.round((1200 - card) / 2), top: Math.round((630 - card) / 2) },
  ])
  .png()
  .toFile(OPENGRAPH);

console.log(
  JSON.stringify(
    {
      source: SOURCE,
      lockup: LOCKUP,
      crest: CREST,
      openGraph: OPENGRAPH,
      master: `${meta.width}x${meta.height}`,
    },
    null,
    2,
  ),
);
