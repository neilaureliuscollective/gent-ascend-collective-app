import { z } from 'zod';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { preparePublication } from '@/domains/technology/publication';
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('build');
    if (!z.uuid().safeParse(id).success) throw new IntelligenceError('Choose a ready build.');
    return privateJson(await preparePublication(id!));
  } catch (e) {
    return apiError(e);
  }
}
