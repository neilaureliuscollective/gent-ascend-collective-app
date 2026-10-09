import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { referenceType } from '@/domains/studio/image-validation';
import { imagePolicy, imageDataSchema } from './image-schema';
export async function normalizeWebsiteImage(bytes: Uint8Array) {
  if (!referenceType(bytes)) throw new Error('Use a valid bounded PNG, JPEG or WebP image.');
  const pipeline = sharp(bytes, {
    limitInputPixels: imagePolicy.inputPixels,
    failOn: 'warning',
    pages: 1,
  }).timeout({ seconds: imagePolicy.seconds });
  const metadata = await pipeline.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
    throw new Error('Use a single-frame raster image.');
  const { data } = await pipeline
    .rotate()
    .flatten({ background: '#07161b' })
    .resize({
      width: imagePolicy.width,
      height: imagePolicy.width,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 65 })
    .toBuffer({ resolveWithObject: true });
  if (data.length > imagePolicy.outputBytes)
    throw new Error('Image exceeds the website budget. Choose a simpler or smaller image.');
  return {
    dataUrl: imageDataSchema.parse('data:image/jpeg;base64,' + data.toString('base64')),
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}
export function verifiedImageBytes(dataUrl: string, sha256: string) {
  const bytes = Buffer.from(imageDataSchema.parse(dataUrl).split(',')[1]!, 'base64');
  if (
    bytes.length > imagePolicy.outputBytes ||
    createHash('sha256').update(bytes).digest('hex') !== sha256
  )
    throw new Error('Image verification failed.');
  return bytes;
}
