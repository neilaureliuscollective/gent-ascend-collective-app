import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { designExportInput, exportDesign } from '@/domains/studio/design-service';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const input = designExportInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the design export request.');
    const result = await exportDesign(input.data);
    return privateJson({
      id: result.id,
      format: result.format,
      width: result.width,
      height: result.height,
      ppi: result.ppi,
      issues: result.issues,
      prepress: result.prepress,
      color: result.color,
    });
  } catch (error) {
    return apiError(error);
  }
}
