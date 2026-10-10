import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { imageCommand } from '@/domains/technology/image-schema';
import { importImage, readImage, readImages } from '@/domains/technology/images';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams,
      id = q.get('id'),
      project = q.get('project');
    if (id) {
      if (!z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid image.');
      const image = await readImage(id);
      return new Response(new Uint8Array(image.bytes), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Content-Disposition': 'inline; filename="website-image.jpg"',
        },
      });
    }
    if (!z.uuid().safeParse(project).success)
      throw new IntelligenceError('Choose a saved website.');
    return privateJson(await readImages(project!));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = imageCommand.safeParse(await mutationBody(request));
    if (!parsed.success) throw new IntelligenceError('Review the image selection and consent.');
    return privateJson(await importImage(parsed.data));
  } catch (e) {
    return apiError(e);
  }
}
