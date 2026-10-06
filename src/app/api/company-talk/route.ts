import { z } from 'zod';
import { readCompanyTalk } from '@/domains/companies/service';
import { apiError, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
const queryInput = z
  .object({
    companyId: z.uuid(),
    conversationId: z.uuid().optional(),
    before: z.iso.datetime({ offset: true }).optional(),
    listBefore: z
      .string()
      .optional()
      .refine((value) => {
        if (!value) return true;
        const parts = value.split('|');
        return (
          parts.length === 2 &&
          z.iso.datetime({ offset: true }).safeParse(parts[0]).success &&
          z.uuid().safeParse(parts[1]).success
        );
      }),
  })
  .strict();
export async function GET(request: Request) {
  try {
    const parsed = queryInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new IntelligenceError('Invalid company conversation or cursor.');
    const { companyId, conversationId, before, listBefore } = parsed.data;
    return privateJson(await readCompanyTalk(companyId, conversationId, before, listBefore));
  } catch (error) {
    return apiError(error);
  }
}
