import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import {
  cancelDesignExport,
  designExportInput,
  designExportJob,
  startDesignExport,
} from '@/domains/studio/design-service';
import { z } from 'zod';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const cancel = z.object({ id: z.uuid(), action: z.literal('cancel') }).strict().safeParse(body);
    if (cancel.success) return privateJson(await cancelDesignExport(cancel.data.id));
    const input = designExportInput.safeParse(body);
    if (!input.success) throw new IntelligenceError('Check the design export request.');
    const result = await startDesignExport(input.data, process.env.STUDIO_RENDER_WORKER !== 'true');
    return privateJson(result);
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!z.uuid().safeParse(id).success) throw new IntelligenceError('Invalid design export.');
    return privateJson(await designExportJob(id!));
  } catch (error) {
    return apiError(error);
  }
}
