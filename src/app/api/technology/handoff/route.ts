import { z } from 'zod';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { readWebsiteHandoff } from '@/domains/technology/handoff';
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const parsed = z.object({ project: z.uuid(), turn: z.uuid() }).safeParse({
      project: query.get('project'),
      turn: query.get('turn'),
    });
    if (!parsed.success) throw new IntelligenceError('Invalid website source.');
    return privateJson(await readWebsiteHandoff(parsed.data.project, parsed.data.turn));
  } catch (error) {
    return apiError(error);
  }
}
