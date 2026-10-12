import { z } from 'zod';
import { apiError } from '@/domains/intelligence/http';
import { footageBlob } from '@/domains/studio/footage-service';
import { footageRange } from '@/domains/studio/footage';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const blob = await footageBlob(z.uuid().parse(new URL(request.url).searchParams.get('id')));
    let range;
    try {
      range = footageRange(request.headers.get('range'), blob.size);
    } catch {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${blob.size}`, 'Cache-Control': 'private, no-store' },
      });
    }
    const body = range ? blob.slice(range.start, range.end + 1) : blob;
    return new Response(body.stream(), {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(body.size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline; filename="aethelios-ai-footage.mp4"',
        ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${blob.size}` } : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
