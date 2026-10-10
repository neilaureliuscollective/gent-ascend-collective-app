import { z } from 'zod';
import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { commandSchema } from '@/domains/technology/schema';
import { mutateTechnology, readTechnology } from '@/domains/technology/service';
export const maxDuration = 90;
export async function GET(request: Request) {
  try {
    const mission = new URL(request.url).searchParams.get('mission');
    if (mission && !z.uuid().safeParse(mission).success)
      throw new IntelligenceError('Invalid Mission.');
    return privateJson(await readTechnology(mission ?? undefined));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = commandSchema.safeParse(await mutationBody(request));
    if (!parsed.success)
      throw new IntelligenceError('Check the business brief and request fields.');
    return privateJson(await mutateTechnology(parsed.data));
  } catch (error) {
    return apiError(error);
  }
}
