import { z } from 'zod';
import { readSchedule } from '@/domains/business-connections/service';
import { apiError, privateJson } from '@/domains/intelligence/http';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    const q = z
      .object({
        id: z.uuid(),
        date: z.iso.date(),
        days: z.coerce.number().int().min(1).max(7),
        page: z.coerce.number().int().min(0).max(100).default(0),
      })
      .strict()
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    return privateJson(
      (await readSchedule(q.id, { date: q.date, days: q.days, page: q.page })).schedule,
    );
  } catch (e) {
    return apiError(e);
  }
}
