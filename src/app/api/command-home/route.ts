import { z } from 'zod';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { readCommandHome } from '@/domains/command-home/service';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const focus = params.get('focus');
    const previous = params.get('previous');
    if (focus && !z.string().max(120).safeParse(focus).success)
      throw new IntelligenceError('Invalid focus.');
    if (previous && !z.string().max(120).safeParse(previous).success)
      throw new IntelligenceError('Invalid selection.');
    return privateJson(await readCommandHome(focus, previous));
  } catch (error) {
    return apiError(error);
  }
}
