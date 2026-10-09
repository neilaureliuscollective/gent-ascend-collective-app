import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { deliverableAction } from '@/domains/missions/deliverable-schema';
import {
  changeDeliverable,
  exportDeliverable,
  readDeliverable,
} from '@/domains/missions/deliverables';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = z.uuid().safeParse(params.get('id'));
    if (!id.success) throw new IntelligenceError('Invalid deliverable.');
    if (params.has('version')) {
      const version = z.uuid().safeParse(params.get('version'));
      if (!version.success) throw new IntelligenceError('Invalid version.');
      return new Response(await exportDeliverable(id.data, version.data), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="aethelios-${version.data}.md"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    return privateJson(await readDeliverable(id.data));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const input = deliverableAction.safeParse(await mutationBody(request, 240000));
    if (!input.success)
      throw new IntelligenceError('Check the deliverable fields and their length.');
    return privateJson(await changeDeliverable(input.data));
  } catch (e) {
    return apiError(e);
  }
}
