import { z } from 'zod';
import { readWebsite, proposeWebsiteChange } from '@/domains/business-connections/service';
import { apiError, privateJson, mutationBody } from '@/domains/intelligence/http';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    const query = z
      .object({ id: z.uuid() })
      .strict()
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    return privateJson(await readWebsite(query.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    return privateJson(await proposeWebsiteChange(await mutationBody(req, 12000)));
  } catch (e) {
    return apiError(e);
  }
}
